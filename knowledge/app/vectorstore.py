"""Persistent vector storage.

* PostgreSQL + pgvector (preferred, production): cosine distance via `<=>` with an HNSW index.
* SQLite (local development / tests): float32 BLOBs, exact cosine search with NumPy.

Both are persistent. Chunks and embeddings are written in the caller's transaction,
so a document is either fully indexed or not indexed at all.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

from .models import Status


@dataclass
class Hit:
    chunk_id: str
    document_id: str
    score: float


class VectorStore:
    def __init__(self, postgres: bool):
        self.postgres = postgres
        self.kind = "pgvector" if postgres else "sqlite"

    def set_embedding(self, s: Session, chunk_id: str, vec: np.ndarray) -> None:
        if self.postgres:
            lit = "[" + ",".join(f"{float(x):.7f}" for x in vec) + "]"
            s.execute(text("UPDATE document_chunks SET embedding = CAST(:v AS vector) WHERE id = :id"), {"v": lit, "id": chunk_id})
        else:
            s.execute(text("UPDATE document_chunks SET embedding = :v WHERE id = :id"), {"v": np.asarray(vec, dtype=np.float32).tobytes(), "id": chunk_id})

    def search(self, s: Session, query: np.ndarray, k: int, document_ids: list[str] | None = None) -> list[Hit]:
        """Top-k chunks from INDEXED documents only, highest cosine similarity first."""
        params: dict = {"k": k, "st": Status.INDEXED}
        doc_filter = ""
        if document_ids:
            names = [f"d{i}" for i in range(len(document_ids))]
            doc_filter = f" AND c.document_id IN ({', '.join(':' + n for n in names)})"
            params.update(dict(zip(names, document_ids)))
        if self.postgres:
            params["q"] = "[" + ",".join(f"{float(x):.7f}" for x in query) + "]"
            rows = s.execute(text(
                "SELECT c.id, c.document_id, 1 - (c.embedding <=> CAST(:q AS vector)) AS score "
                "FROM document_chunks c JOIN documents d ON d.id = c.document_id "
                f"WHERE d.processing_status = :st AND c.embedding IS NOT NULL{doc_filter} "
                "ORDER BY c.embedding <=> CAST(:q AS vector) LIMIT :k"), params).all()
            return [Hit(r[0], r[1], float(r[2])) for r in rows]

        params.pop("k")
        rows = s.execute(text(
            "SELECT c.id, c.document_id, c.embedding FROM document_chunks c JOIN documents d ON d.id = c.document_id "
            f"WHERE d.processing_status = :st AND c.embedding IS NOT NULL{doc_filter}"), params).all()
        if not rows:
            return []
        q = np.asarray(query, dtype=np.float32)
        matrix = np.vstack([np.frombuffer(r[2], dtype=np.float32) for r in rows])
        if matrix.shape[1] != q.shape[0]:
            raise ValueError("Stored embeddings have a different dimension from the query embedding. Reindex required.")
        scores = matrix @ q  # vectors are L2-normalised, so dot product == cosine similarity
        order = np.argsort(-scores)[:k]
        return [Hit(rows[i][0], rows[i][1], float(scores[i])) for i in order]
