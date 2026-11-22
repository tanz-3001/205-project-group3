"""Live end-to-end verification against Google Gemini API (gemini-embedding-001 + Gemini Flash).

Runs automatically when GEMINI_API_KEY is present in the environment; skipped otherwise.
Verifies real semantic embeddings, vector persistence, semantic search ranking, grounded RAG
answer generation, citation validation, and insufficient-evidence abstention.
"""
from __future__ import annotations

import os
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from conftest import FakeGuard, auth, sample, upload

KB = "/api/knowledge"
HAS_GEMINI = bool(os.environ.get("GEMINI_API_KEY"))


@pytest.mark.skipif(not HAS_GEMINI, reason="GEMINI_API_KEY not set")
def test_live_gemini_embeddings_search_and_rag(tmp_path):
    key = os.environ["GEMINI_API_KEY"]
    settings = Settings(
        database_url=f"sqlite:///{(tmp_path / 'live.db').as_posix()}",
        storage_path=tmp_path / "uploads",
        jwt_secret="test-secret",
        guard_api_url="http://guard.test",
        embedding_provider="gemini",
        embedding_model="gemini-embedding-001",
        embedding_dimensions=768,
        embedding_api_key=key,
        llm_provider="gemini",
        llm_model="gemini-flash-latest",
        llm_api_key=key,
        min_relevance=0.55,
        strong_relevance=0.68,
        chunk_target_tokens=300,
        chunk_overlap_tokens=60,
        cors_origins=[],
    )
    client = TestClient(create_app(settings, guard=FakeGuard(), sync_processing=True))

    # 1. Health check reports live Gemini embedding & LLM providers configured
    h = client.get(f"{KB}/health").json()
    assert h["status"] == "ok"
    assert h["embedding"]["provider"] == "gemini" and h["embedding"]["model"] == "gemini-embedding-001"
    assert h["llm"]["provider"] == "gemini"

    # 2. Upload all 3 sample university documents (PDF, DOCX, TXT) and verify real indexing
    for name, mime in [
        ("Academic_Regulations_2026.pdf", "application/pdf"),
        ("Student_Handbook_2026.docx", ""),
        ("IT_Help_Desk_FAQ.txt", "text/plain"),
    ]:
        r = upload(client, name, sample(name), mime)
        assert r.status_code == 201, r.text
        doc = r.json()["document"]
        assert doc["processing_status"] == "indexed", doc
        assert doc["chunk_count"] >= 2

    # 3. Semantic search retrieves the right policy even when phrased without exact keywords
    sr = client.post(
        f"{KB}/search",
        json={"query": "What happens if I hand in my assignment three days after the due date?", "top_k": 5},
        headers=auth("admin"),
    ).json()
    assert sr["results"], sr
    assert sr["results"][0]["document_name"] == "Academic Regulations 2026"
    assert any("10 percent" in p["excerpt"] for p in sr["results"])

    # 4. RAG query generates a grounded answer with verifiable citations
    qr = client.post(
        f"{KB}/query",
        json={"question": "What is the penalty for submitting coursework late, and after how many days does it get zero?"},
        headers=auth("student"),
    ).json()
    assert qr["status"] == "answered", qr
    assert "10" in qr["answer"] and "5" in qr["answer"]
    assert qr["citations"], qr
    assert qr["citations"][0]["document_name"] == "Academic Regulations 2026"
    assert qr["citations"][0]["page_number"] is not None

    # 5. Out-of-scope question abstains cleanly
    unrel = client.post(
        f"{KB}/query",
        json={"question": "What are the opening hours of the campus swimming pool and sauna?"},
        headers=auth("student"),
    ).json()
    assert unrel["status"] == "insufficient_evidence", unrel
