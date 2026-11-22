"""Semantic retrieval with relevance thresholds and evidence assessment."""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select

from .embeddings import EmbeddingError
from .errors import ApiError
from .models import Document, DocumentChunk
from .processing import embedding_signature, stored_signature


@dataclass
class Passage:
    ref: str  # S1, S2 ... (citation label, stable within one response)
    chunk_id: str
    document_id: str
    document_name: str
    file_type: str
    chunk_index: int
    page_number: int | None
    page_end: int | None
    section: str | None
    score: float
    content: str

    @property
    def excerpt(self) -> str:
        return self.content if len(self.content) <= 600 else self.content[:597].rsplit(" ", 1)[0] + "…"

    def location(self) -> str:
        parts = []
        if self.page_number:
            parts.append(f"Page {self.page_number}" if not self.page_end or self.page_end == self.page_number else f"Pages {self.page_number}–{self.page_end}")
        if self.section:
            parts.append(f"Section: {self.section}")
        return ", ".join(parts)

    def to_dict(self) -> dict:
        return {
            "id": self.ref, "chunk_id": self.chunk_id, "document_id": self.document_id, "document_name": self.document_name,
            "file_type": self.file_type, "chunk_index": self.chunk_index, "page_number": self.page_number, "page_end": self.page_end,
            "section": self.section, "location": self.location(), "score": round(self.score, 4), "excerpt": self.excerpt,
        }


def validate_query(q: object) -> str:
    if not isinstance(q, str):
        raise ApiError(422, "invalid_query", "The query must be text.")
    q = " ".join(q.split())
    if len(q) < 3:
        raise ApiError(422, "invalid_query", "The query is too short.")
    if len(q) > 1000:
        raise ApiError(422, "invalid_query", "The query must be at most 1000 characters.")
    return q


def evidence(passages: list[Passage], strong: float) -> dict:
    """Retrieval-based evidence quality. NOT a probability that the answer is correct."""
    if not passages:
        return {"level": "none", "top_score": None, "supporting_passages": 0, "documents": 0,
                "basis": "No indexed passage passed the relevance threshold."}
    top = passages[0].score
    strong_n = sum(p.score >= strong for p in passages)
    level = "high" if top >= strong and strong_n >= 2 else "medium" if top >= strong else "low"
    return {"level": level, "top_score": round(top, 4), "supporting_passages": len(passages), "documents": len({p.document_id for p in passages}),
            "basis": "Cosine similarity between the question and indexed passages; reflects how closely sources match, not verified correctness."}


def retrieve(ctx, query: str, top_k: int, document_ids: list[str] | None = None) -> list[Passage]:  # noqa: ANN001
    s_cfg = ctx.settings
    if ctx.embedder is None:
        raise ApiError(503, "embeddings_not_configured", "Semantic search is not available: no embedding provider is configured.")
    top_k = max(1, min(int(top_k or s_cfg.top_k_default), s_cfg.top_k_max))
    with ctx.db.session() as s:
        sig = stored_signature(s)
        if sig and sig != embedding_signature(ctx.embedder):
            raise ApiError(503, "index_incompatible", "The knowledge index was built with a different embedding model. An administrator must rebuild it.")
    try:
        qvec = ctx.embedder.embed_query(query)
    except EmbeddingError as exc:
        raise ApiError(502, "embedding_failed", str(exc))
    with ctx.db.session() as s:
        hits = ctx.vectors.search(s, qvec, k=top_k * 2, document_ids=document_ids)
        hits = [h for h in hits if h.score >= s_cfg.min_relevance][:top_k]  # never pad with irrelevant passages
        if not hits:
            return []
        rows = {c.id: (c, d) for c, d in s.execute(
            select(DocumentChunk, Document).join(Document, Document.id == DocumentChunk.document_id)
            .where(DocumentChunk.id.in_([h.chunk_id for h in hits]))).all()}
    out: list[Passage] = []
    for h in hits:
        if h.chunk_id not in rows:
            continue
        c, d = rows[h.chunk_id]
        out.append(Passage(f"S{len(out) + 1}", c.id, d.id, d.display_name, d.file_type, c.chunk_index, c.page_number, c.page_end, c.section_heading, h.score, c.content))
    return out
