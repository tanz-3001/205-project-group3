"""Central configuration for the Synapse Knowledge service.

All values come from environment variables (optionally loaded from knowledge/.env).
Secrets are never logged or returned by the API.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader (KEY=VALUE lines). Existing environment variables win."""
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


def _list(name: str, default: str) -> list[str]:
    return [x.strip() for x in os.environ.get(name, default).split(",") if x.strip()]


@dataclass
class Settings:
    database_url: str = ""
    database_schema: str = "synapse"
    storage_path: Path = field(default_factory=lambda: BASE_DIR / "data" / "uploads")

    # Auth: tokens are issued by Synapse Guard (guard/src/auth.js). Same secret, same algorithm.
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    admin_roles: list[str] = field(default_factory=lambda: ["admin"])
    chat_roles: list[str] = field(default_factory=lambda: ["student", "admin"])

    # Guard sensitivity check (POST {GUARD_API_URL}/api/guard/check)
    guard_api_url: str = ""
    guard_fail_closed: bool = True

    # Embeddings
    embedding_provider: str = ""  # gemini | openai | local
    embedding_model: str = ""
    embedding_dimensions: int = 768
    embedding_api_key: str = ""

    # Answer generation
    llm_provider: str = ""  # gemini | anthropic | none
    llm_model: str = ""
    llm_api_key: str = ""
    llm_timeout_s: float = 30.0

    # Chunking (token counts are estimates, see chunking.py)
    chunk_target_tokens: int = 500
    chunk_overlap_tokens: int = 100

    # Retrieval
    top_k_default: int = 6
    top_k_max: int = 10
    min_relevance: float = 0.62
    strong_relevance: float = 0.72

    # Limits
    max_upload_mb: int = 20
    rate_limit_query_per_min: int = 20
    rate_limit_admin_per_min: int = 60
    cors_origins: list[str] = field(default_factory=list)

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def is_postgres(self) -> bool:
        return self.database_url.startswith(("postgresql", "postgres"))


def _normalize_db_url(raw: str) -> str:
    url = raw.strip()
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


def _clean_schema(raw: str) -> str:
    val = raw.strip() or "synapse"
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", val):
        raise ValueError("DATABASE_SCHEMA must be a valid SQL identifier.")
    return val


def load_settings() -> Settings:
    _load_dotenv(BASE_DIR / ".env")
    env = os.environ
    provider = env.get("EMBEDDING_PROVIDER", "").strip().lower()
    if not provider and env.get("GEMINI_API_KEY"):
        provider = "gemini"
    default_models = {"gemini": "gemini-embedding-001", "openai": "text-embedding-3-small", "local": "BAAI/bge-small-en-v1.5"}
    default_dims = {"gemini": 768, "openai": 768, "local": 384}

    llm = env.get("LLM_PROVIDER", "").strip().lower()
    if not llm:
        llm = "gemini" if env.get("GEMINI_API_KEY") else ("anthropic" if env.get("ANTHROPIC_API_KEY") else "none")
    llm_defaults = {"gemini": "gemini-flash-lite-latest", "anthropic": env.get("ANTHROPIC_MODEL", "claude-sonnet-5-5")}

    def provider_key(p: str, explicit: str) -> str:
        if env.get(explicit):
            return env[explicit].strip()
        return {"gemini": env.get("GEMINI_API_KEY", ""), "openai": env.get("OPENAI_API_KEY", ""), "anthropic": env.get("ANTHROPIC_API_KEY", "")}.get(p, "").strip()

    storage = env.get("KNOWLEDGE_STORAGE_PATH")
    is_vercel = bool(env.get("VERCEL"))
    default_db = "sqlite:////tmp/synapse_knowledge.db" if is_vercel else f"sqlite:///{(BASE_DIR / 'data' / 'knowledge.db').as_posix()}"
    default_storage = Path("/tmp/synapse_uploads") if is_vercel else (BASE_DIR / "data" / "uploads")
    default_jwt = env.get("JWT_SECRET") or ("dev-only-secret-change-me" if is_vercel else "")
    raw_db = env.get("DATABASE_URL", "").strip()
    db_url = _normalize_db_url(raw_db) if raw_db else default_db
    return Settings(
        database_url=db_url,
        database_schema=_clean_schema(env.get("DATABASE_SCHEMA", "synapse")),
        storage_path=Path(storage) if storage else default_storage,
        jwt_secret=default_jwt,
        admin_roles=_list("KNOWLEDGE_ADMIN_ROLES", "admin"),
        chat_roles=_list("KNOWLEDGE_CHAT_ROLES", "student,admin"),
        guard_api_url=env.get("GUARD_API_URL", "").rstrip("/"),
        guard_fail_closed=env.get("GUARD_FAIL_MODE", "closed").lower() != "open",
        embedding_provider=provider,
        embedding_model=env.get("EMBEDDING_MODEL", default_models.get(provider, "")).strip(),
        embedding_dimensions=_int("EMBEDDING_DIMENSIONS", default_dims.get(provider, 768)),
        embedding_api_key=provider_key(provider, "EMBEDDING_API_KEY"),
        llm_provider=llm,
        llm_model=env.get("LLM_MODEL", llm_defaults.get(llm, "")).strip(),
        llm_api_key=provider_key(llm, "LLM_API_KEY"),
        llm_timeout_s=_float("LLM_TIMEOUT_S", 30.0),
        chunk_target_tokens=_int("CHUNK_TARGET_TOKENS", 500),
        chunk_overlap_tokens=_int("CHUNK_OVERLAP_TOKENS", 100),
        top_k_default=_int("RETRIEVAL_TOP_K", 6),
        top_k_max=_int("RETRIEVAL_TOP_K_MAX", 10),
        min_relevance=_float("RETRIEVAL_MIN_SCORE", 0.62),
        strong_relevance=_float("RETRIEVAL_STRONG_SCORE", 0.72),
        max_upload_mb=_int("MAX_UPLOAD_MB", 20),
        rate_limit_query_per_min=_int("RATE_LIMIT_QUERY_PER_MIN", 20),
        rate_limit_admin_per_min=_int("RATE_LIMIT_ADMIN_PER_MIN", 60),
        cors_origins=_list("KNOWLEDGE_CORS_ORIGINS", "http://localhost:5173"),
    )
