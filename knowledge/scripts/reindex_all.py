"""Rebuild all document chunks and embeddings using the currently configured embedding provider.

Run this when EMBEDDING_PROVIDER, EMBEDDING_MODEL or EMBEDDING_DIMENSIONS has changed:

    python scripts/reindex_all.py
"""
from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import delete, select

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.config import load_settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models import Document, DocumentChunk, KbSetting, Status  # noqa: E402
from app.processing import SIGNATURE_KEY  # noqa: E402


def main() -> None:
    app = create_app(load_settings(), sync_processing=True)
    ctx = app.state.ctx
    if ctx.embedder is None:
        raise SystemExit("ERROR: No embedding provider is configured. Set EMBEDDING_PROVIDER and its API key first.")

    with ctx.db.session() as s:
        s.execute(delete(DocumentChunk))
        setting = s.get(KbSetting, SIGNATURE_KEY)
        if setting:
            s.delete(setting)
        docs = s.scalars(select(Document).order_by(Document.created_at)).all()
        queued = []
        for d in docs:
            job = ctx.processor.enqueue(s, d, "reprocess")
            s.flush()
            queued.append((d.id, d.display_name, job.id))

    for doc_id, name, job_id in queued:
        print(f"Re-indexing {name} ({doc_id})...")
        ctx.submit(doc_id, job_id)
        with ctx.db.session() as s:
            d = s.get(Document, doc_id)
            print(f"  -> {d.processing_status} ({d.chunk_count} chunks)" + (f" ERROR: {d.processing_error}" if d.processing_error else ""))


if __name__ == "__main__":
    main()
