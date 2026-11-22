"""Seed the knowledge base with the sample documents in knowledge/sample_docs/.

Idempotent: skips any file whose SHA-256 checksum is already in the database.

    python scripts/seed_demo.py
"""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

from sqlalchemy import select

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.config import load_settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models import AuditLog, Document  # noqa: E402
from app.validation import display_name_from, validate_upload  # noqa: E402
from scripts.make_sample_docs import OUT as SAMPLE_DIR, main as make_samples  # noqa: E402


def main() -> None:
    if not SAMPLE_DIR.exists() or not list(SAMPLE_DIR.iterdir()):
        make_samples()

    app = create_app(load_settings(), sync_processing=True)
    ctx = app.state.ctx
    for path in sorted(SAMPLE_DIR.iterdir()):
        if not path.is_file():
            continue
        data = path.read_bytes()
        checksum = hashlib.sha256(data).hexdigest()
        with ctx.db.session() as s:
            existing = s.scalar(select(Document).where(Document.checksum == checksum))
            if existing:
                print(f"Skipping {path.name}: already present as '{existing.display_name}' ({existing.processing_status})")
                continue
        v = validate_upload(path.name, None, data, ctx.settings.max_upload_bytes)
        key = ctx.storage.save(data, v.file_type)
        with ctx.db.session() as s:
            doc = Document(
                filename=v.filename,
                display_name=display_name_from(v.filename),
                file_type=v.file_type,
                mime_type=v.mime_type,
                file_size=len(data),
                checksum=checksum,
                storage_key=key,
                uploaded_by="u_2",
                uploaded_by_name="Demo Admin",
            )
            s.add(doc)
            s.flush()
            job = ctx.processor.enqueue(s, doc, "upload")
            s.add(AuditLog(actor_id="u_2", actor_role="admin", action="seed_upload", document_id=doc.id, metadata_json={"filename": v.filename}))
            s.flush()
            doc_id, job_id = doc.id, job.id
        ctx.submit(doc_id, job_id)
        with ctx.db.session() as s:
            d = s.get(Document, doc_id)
            print(f"Indexed {d.display_name}: status={d.processing_status}, chunks={d.chunk_count}" + (f", error={d.processing_error}" if d.processing_error else ""))


if __name__ == "__main__":
    main()
