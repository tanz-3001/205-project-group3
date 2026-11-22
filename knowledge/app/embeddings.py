"""Embedding providers behind one interface.

Supported: Gemini (gemini-embedding-001), OpenAI (text-embedding-3-*), and a
local ONNX model via fastembed. There is deliberately NO fake/hash fallback:
if no provider is configured, indexing fails with a clear error.
"""
from __future__ import annotations

import logging
import time
from typing import Protocol

import httpx
import numpy as np

from .config import Settings

log = logging.getLogger("knowledge.embeddings")


class EmbeddingError(Exception):
    """Safe-to-display embedding failure."""


class EmbeddingProvider(Protocol):
    name: str
    model: str
    dimensions: int

    def embed_documents(self, texts: list[str]) -> np.ndarray: ...
    def embed_query(self, text: str) -> np.ndarray: ...


def _normalise(m: np.ndarray) -> np.ndarray:
    m = np.asarray(m, dtype=np.float32)
    norms = np.linalg.norm(m, axis=-1, keepdims=True)
    norms[norms == 0] = 1.0
    return m / norms


def _post_with_retry(client: httpx.Client, url: str, **kw) -> dict:
    delay = 1.0
    for attempt in range(4):
        try:
            r = client.post(url, **kw)
        except httpx.HTTPError as exc:
            if attempt == 3:
                raise EmbeddingError("The embedding service could not be reached.") from exc
        else:
            if r.status_code == 200:
                return r.json()
            if r.status_code in (401, 403):
                raise EmbeddingError("The embedding service rejected the API key.")
            if r.status_code not in (429, 500, 502, 503, 504) or attempt == 3:
                log.warning("embedding HTTP %s: %s", r.status_code, r.text[:300])
                raise EmbeddingError(f"The embedding service returned an error (HTTP {r.status_code}).")
        time.sleep(delay)
        delay *= 2
    raise EmbeddingError("The embedding service is unavailable.")


class GeminiEmbeddings:
    name = "gemini"
    BATCH = 100

    def __init__(self, api_key: str, model: str, dimensions: int, timeout: float = 60.0):
        self.model, self.dimensions, self._key = model, dimensions, api_key
        self._client = httpx.Client(timeout=timeout)

    def _embed(self, texts: list[str], task: str) -> np.ndarray:
        out: list[list[float]] = []
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:batchEmbedContents"
        for i in range(0, len(texts), self.BATCH):
            batch = texts[i : i + self.BATCH]
            body = {"requests": [{"model": f"models/{self.model}", "content": {"parts": [{"text": t}]}, "taskType": task, "outputDimensionality": self.dimensions} for t in batch]}
            data = _post_with_retry(self._client, url, json=body, headers={"x-goog-api-key": self._key})
            vecs = [e.get("values", []) for e in data.get("embeddings", [])]
            if len(vecs) != len(batch) or any(len(v) != self.dimensions for v in vecs):
                raise EmbeddingError("The embedding service returned an unexpected response.")
            out.extend(vecs)
        return _normalise(np.array(out))  # reduced-dimension Gemini vectors must be re-normalised

    def embed_documents(self, texts: list[str]) -> np.ndarray:
        return self._embed(texts, "RETRIEVAL_DOCUMENT")

    def embed_query(self, text: str) -> np.ndarray:
        return self._embed([text], "RETRIEVAL_QUERY")[0]


class OpenAIEmbeddings:
    name = "openai"
    BATCH = 100

    def __init__(self, api_key: str, model: str, dimensions: int, timeout: float = 60.0):
        self.model, self.dimensions, self._key = model, dimensions, api_key
        self._client = httpx.Client(timeout=timeout)

    def _embed(self, texts: list[str]) -> np.ndarray:
        out: list[list[float]] = []
        for i in range(0, len(texts), self.BATCH):
            batch = texts[i : i + self.BATCH]
            data = _post_with_retry(self._client, "https://api.openai.com/v1/embeddings", json={"model": self.model, "input": batch, "dimensions": self.dimensions}, headers={"Authorization": f"Bearer {self._key}"})
            rows = sorted(data.get("data", []), key=lambda d: d.get("index", 0))
            if len(rows) != len(batch):
                raise EmbeddingError("The embedding service returned an unexpected response.")
            out.extend(r["embedding"] for r in rows)
        return _normalise(np.array(out))

    def embed_documents(self, texts: list[str]) -> np.ndarray:
        return self._embed(texts)

    def embed_query(self, text: str) -> np.ndarray:
        return self._embed([text])[0]


class LocalEmbeddings:
    """Runs an ONNX sentence-embedding model locally with fastembed (no API key)."""
    name = "local"

    def __init__(self, model: str, dimensions: int):
        try:
            from fastembed import TextEmbedding
        except ImportError as exc:
            raise EmbeddingError("EMBEDDING_PROVIDER=local requires `pip install fastembed`.") from exc
        self.model = model
        self._m = TextEmbedding(model_name=model)
        probe = next(iter(self._m.embed(["probe"])))
        self.dimensions = len(probe)
        if dimensions and dimensions != self.dimensions:
            log.warning("EMBEDDING_DIMENSIONS=%s ignored; %s produces %s", dimensions, model, self.dimensions)

    def embed_documents(self, texts: list[str]) -> np.ndarray:
        return _normalise(np.array(list(self._m.embed(texts))))

    def embed_query(self, text: str) -> np.ndarray:
        return _normalise(np.array(list(self._m.query_embed([text]))))[0]


def build_embedder(s: Settings) -> EmbeddingProvider | None:
    """Return the configured provider, or None if embeddings are not configured."""
    p = s.embedding_provider
    if p == "gemini" and s.embedding_api_key:
        return GeminiEmbeddings(s.embedding_api_key, s.embedding_model, s.embedding_dimensions)
    if p == "openai" and s.embedding_api_key:
        return OpenAIEmbeddings(s.embedding_api_key, s.embedding_model, s.embedding_dimensions)
    if p == "local":
        return LocalEmbeddings(s.embedding_model, s.embedding_dimensions)
    return None
