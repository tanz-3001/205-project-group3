"""Shared fixtures.

The embedding provider used here is a TEST DOUBLE (hashed bag-of-words). It exists only
in the test suite so unit/integration tests run offline and deterministically. The
application itself has no fake embedding provider; real semantic quality is verified by
tests/test_live_gemini.py when GEMINI_API_KEY is available.
"""
from __future__ import annotations

import hashlib
import re
import sys
import time
from pathlib import Path

import httpx
import jwt
import numpy as np
import pytest

# Compatibility shim for environments with starlette < 0.37.2 alongside httpx >= 0.28
_orig_httpx_init = httpx.Client.__init__
def _compat_httpx_init(self, *args, **kwargs):
    kwargs.pop("app", None)
    return _orig_httpx_init(self, *args, **kwargs)
httpx.Client.__init__ = _compat_httpx_init

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.config import Settings  # noqa: E402
from app.guard_client import GuardUnavailable, GuardVerdict  # noqa: E402
from app.main import create_app  # noqa: E402

SECRET = "test-secret"
SAMPLES = ROOT / "sample_docs"


class BagOfWordsTestEmbedder:
    name, model, dimensions = "test", "bow-256", 256
    _stop = set("the a an and or of to in on for is are be by as at it this that with what how do i my can".split())

    def _vec(self, text: str) -> np.ndarray:
        v = np.zeros(self.dimensions, dtype=np.float32)
        for w in re.findall(r"[a-z0-9]+", text.lower()):
            if w in self._stop:
                continue
            w = w[:6]  # crude stemming
            v[int(hashlib.md5(w.encode()).hexdigest(), 16) % self.dimensions] += 1.0
        n = np.linalg.norm(v)
        return v / n if n else v

    def embed_documents(self, texts):
        self.calls = getattr(self, "calls", 0) + 1
        return np.vstack([self._vec(t) for t in texts])

    def embed_query(self, text):
        return self._vec(text)


class FailingEmbedder(BagOfWordsTestEmbedder):
    def embed_documents(self, texts):
        from app.embeddings import EmbeddingError
        raise EmbeddingError("The embedding service could not be reached.")


class FakeGuard:
    """Mimics guard/src/sensitivity.js responses for a few phrases."""
    configured = True

    def __init__(self, available: bool = True):
        self.available = available
        self.calls: list[str] = []

    def check(self, message: str, bearer: str) -> GuardVerdict:
        self.calls.append(message)
        if not self.available:
            raise GuardUnavailable("down")
        if re.search(r"depress|suicid|harass", message, re.I):
            return GuardVerdict("escalate", "mental_health", message, True)
        if re.search(r"refund|scholarship", message, re.I):
            return GuardVerdict("escalate", "financial", message, False)
        if re.search(r"\b\d{7,8}\b", message):
            return GuardVerdict("redact", "personal_data", re.sub(r"\b\d{7,8}\b", "[STUDENT_ID]", message), False)
        return GuardVerdict("allow", "general", message, False)


class ScriptedLLM:
    name, model = "scripted", "scripted-1"

    def __init__(self, reply: str | Exception):
        self.reply = reply
        self.prompts: list[str] = []

    def generate(self, system: str, prompt: str) -> str:
        self.prompts.append(prompt)
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply


def token(role: str, sub: str = "u_1", secret: str = SECRET, exp_delta: int = 3600) -> str:
    return jwt.encode({"sub": sub, "role": role, "exp": int(time.time()) + exp_delta}, secret, algorithm="HS256")


def auth(role: str, **kw) -> dict:
    return {"Authorization": f"Bearer {token(role, **kw)}"}


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(database_url=f"sqlite:///{(tmp_path / 'kb.db').as_posix()}", storage_path=tmp_path / "uploads", jwt_secret=SECRET,
                    guard_api_url="http://guard.test", min_relevance=0.2, strong_relevance=0.4, chunk_target_tokens=120, chunk_overlap_tokens=30,
                    cors_origins=[])


@pytest.fixture
def guard() -> FakeGuard:
    return FakeGuard()


@pytest.fixture
def make_client(settings, guard):
    def _make(embedder=None, llm=None, guard_obj=None):
        app = create_app(settings, embedder=embedder or BagOfWordsTestEmbedder(), llm=llm, guard=guard_obj or guard, sync_processing=True)
        return TestClient(app)
    return _make


@pytest.fixture
def client(make_client):
    return make_client()


def upload(client, name: str, data: bytes, mime: str = "application/octet-stream", role: str = "admin"):
    return client.post("/api/knowledge/documents/upload", files={"file": (name, data, mime)}, headers=auth(role))


def sample(name: str) -> bytes:
    return (SAMPLES / name).read_bytes()
