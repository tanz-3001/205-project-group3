"""Document storage and the processing pipeline:

    claim job -> load file -> extract -> clean -> chunk -> embed -> store (one transaction) -> indexed

A document is only marked `indexed` after its chunks and embeddings are committed.
Concurrent processing of the same document is prevented by an atomic status claim.
"""
from __future__ import annotations

import logging
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import delete, select, update

from .chunking import chunk_blocks
from .embeddings import EmbeddingError
from .extraction import ExtractionError, extract
from .models import Document, DocumentChunk, KbSetting, ProcessingJob, Status, new_id

log = logging.getLogger("knowledge.processing")
SIGNATURE_KEY = "embedding_signature"


def now() -> datetime:
    return datetime.now(timezone.utc)


# ------------------------------------------------------------------ storage
class FileStorage:
    """Stores uploads under random keys outside any web root. Paths are never exposed."""

    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        if not key.replace(".", "").isalnum():
            raise ValueError("invalid storage key")
        return self.root / key

    def save(self, data: bytes, ext: str) -> str:
        key = f"{new_id()}.{ext}"
        fd, tmp = tempfile.mkstemp(dir=self.root, prefix=".upload-")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(data)
            os.replace(tmp, self._path(key))  # atomic: no half-written files
        except Exception:
            Path(tmp).unlink(missing_ok=True)
            raise
        return key

    def read(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)


def embedding_signature(embedder) -> str:  # noqa: ANN001
    return f"{embedder.name}:{embedder.model}:{embedder.dimensions}"


def stored_signature(session) -> str | None:  # noqa: ANN001
    row = session.get(KbSetting, SIGNATURE_KEY)
    return row.value if row else None


# ----------------------------------------------------------------- pipeline
class Processor:
    def __init__(self, ctx):  # noqa: ANN001  (AppContext; avoids an import cycle)
        self.ctx = ctx

    def enqueue(self, session, doc: Document, trigger: str) -> ProcessingJob:  # noqa: ANN001
        retries = sum(1 for j in doc.jobs if j.status == Status.FAILED) if doc.jobs else 0
        doc.processing_status = Status.QUEUED
        doc.processing_error = None
        job = ProcessingJob(document_id=doc.id, status=Status.QUEUED, trigger=trigger, retry_count=retries)
        session.add(job)
        return job

    def run(self, document_id: str, job_id: str) -> None:
        """Process one document. Safe to call from a background thread."""
        db = self.ctx.db
        with db.session() as s:
            claimed = s.execute(
                update(Document).where(Document.id == document_id, Document.processing_status == Status.QUEUED)
                .values(processing_status=Status.PROCESSING, updated_at=now())
            ).rowcount
            if claimed != 1:
                log.info("document %s is not queued; skipping job %s", document_id, job_id)
                s.execute(update(ProcessingJob).where(ProcessingJob.id == job_id, ProcessingJob.status == Status.QUEUED)
                          .values(status="skipped", completed_at=now()))
                return
            s.execute(update(ProcessingJob).where(ProcessingJob.id == job_id).values(status=Status.PROCESSING, started_at=now()))

        try:
            self._process(document_id)
        except (ExtractionError, EmbeddingError) as exc:
            self._fail(document_id, job_id, str(exc))
        except Exception:
            log.exception("unexpected failure processing %s", document_id)
            self._fail(document_id, job_id, "Processing failed because of an internal error. Try again, or contact support if it keeps failing.")
        else:
            with db.session() as s:
                s.execute(update(ProcessingJob).where(ProcessingJob.id == job_id).values(status=Status.INDEXED, completed_at=now()))

    def _process(self, document_id: str) -> None:
        ctx = self.ctx
        with ctx.db.session() as s:
            doc = s.get(Document, document_id)
            if doc is None:
                return  # deleted while queued
            file_type, key, display = doc.file_type, doc.storage_key, doc.display_name
        if ctx.embedder is None:
            raise EmbeddingError("No embedding provider is configured. Set EMBEDDING_PROVIDER and its API key, then retry.")

        try:
            data = ctx.storage.read(key)
        except FileNotFoundError:
            raise ExtractionError("The stored file is missing. Delete this document and upload it again.")
        extracted = extract(file_type, data)
        chunks = chunk_blocks(extracted.blocks, ctx.settings.chunk_target_tokens, ctx.settings.chunk_overlap_tokens, display)
        if not chunks:
            raise ExtractionError("No text could be indexed from this document.")

        # Section and title context improve retrieval for short passages.
        inputs = [f"{display}\n{c.section_heading or ''}\n{c.content}".strip() for c in chunks]
        vectors = ctx.embedder.embed_documents(inputs)
        signature = embedding_signature(ctx.embedder)

        with ctx.db.session() as s:  # single transaction: old chunks out, new chunks in, status indexed
            doc = s.get(Document, document_id)
            if doc is None:
                return
            existing = stored_signature(s)
            if existing and existing != signature:
                others = s.scalar(select(DocumentChunk.id).where(DocumentChunk.document_id != document_id).limit(1))
                if others:
                    raise EmbeddingError("The embedding model changed since the index was built. Run scripts/reindex_all.py to rebuild the whole index.")
            s.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document_id))
            s.flush()
            for c, vec in zip(chunks, vectors):
                row = DocumentChunk(document_id=document_id, chunk_index=c.index, content=c.content, page_number=c.page_number,
                                    page_end=c.page_end, section_heading=c.section_heading, token_count=c.token_count, metadata_json=c.metadata)
                s.add(row)
                s.flush()
                ctx.vectors.set_embedding(s, row.id, vec)
            setting = s.get(KbSetting, SIGNATURE_KEY)
            if setting:
                setting.value = signature
            else:
                s.add(KbSetting(key=SIGNATURE_KEY, value=signature))
            doc.processing_status = Status.INDEXED
            doc.processing_error = None
            doc.page_count = extracted.page_count
            doc.chunk_count = len(chunks)
            doc.processed_at = now()
            doc.version = (doc.version or 0) + 1
        log.info("indexed document %s: %s chunks", document_id, len(chunks))

    def _fail(self, document_id: str, job_id: str, message: str) -> None:
        with self.ctx.db.session() as s:
            s.execute(update(Document).where(Document.id == document_id).values(processing_status=Status.FAILED, processing_error=message, updated_at=now()))
            s.execute(update(ProcessingJob).where(ProcessingJob.id == job_id).values(status=Status.FAILED, error_message=message, completed_at=now()))
        log.warning("processing failed for %s: %s", document_id, message)

    def recover_interrupted(self) -> list[tuple[str, str]]:
        """On startup: documents stuck mid-processing are marked failed; queued ones are re-run."""
        pending: list[tuple[str, str]] = []
        with self.ctx.db.session() as s:
            for doc in s.scalars(select(Document).where(Document.processing_status == Status.PROCESSING)):
                doc.processing_status = Status.FAILED
                doc.processing_error = "Processing was interrupted (service restart). Use Retry to process it again."
            s.execute(update(ProcessingJob).where(ProcessingJob.status == Status.PROCESSING)
                      .values(status=Status.FAILED, error_message="interrupted", completed_at=now()))
            for job in s.scalars(select(ProcessingJob).where(ProcessingJob.status == Status.QUEUED)):
                pending.append((job.document_id, job.id))
        return pending
