"""Database engine, sessions and versioned schema migrations."""
from __future__ import annotations

import logging
import os
from contextlib import contextmanager
from pathlib import Path
from typing import Callable, Iterator

from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from .config import Settings
from .models import Base

log = logging.getLogger("knowledge.db")


class Database:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.schema: str | None = settings.database_schema if settings.is_postgres else None
        url = settings.database_url
        kwargs: dict = {"pool_pre_ping": True}
        if url.startswith("sqlite"):
            path = url.replace("sqlite:///", "", 1)
            if path and path != ":memory:":
                Path(path).parent.mkdir(parents=True, exist_ok=True)
            kwargs["connect_args"] = {"check_same_thread": False, "timeout": 30}
        elif settings.is_postgres:
            kwargs["connect_args"] = {"prepare_threshold": None}
            if self.schema:
                kwargs["execution_options"] = {"schema_translate_map": {None: self.schema}}
            if os.environ.get("VERCEL"):
                kwargs.pop("pool_pre_ping", None)
                kwargs["poolclass"] = NullPool
        self.engine: Engine = create_engine(url, **kwargs)
        if url.startswith("sqlite"):
            @event.listens_for(self.engine, "connect")
            def _sqlite_pragmas(conn, _):  # noqa: ANN001
                cur = conn.cursor()
                cur.execute("PRAGMA foreign_keys=ON")  # enables ON DELETE CASCADE
                cur.execute("PRAGMA journal_mode=WAL")
                cur.close()
        self.SessionLocal = sessionmaker(bind=self.engine, expire_on_commit=False)

    def _q(self, table: str) -> str:
        return f"{self.schema}.{table}" if self.schema else table

    @contextmanager
    def session(self) -> Iterator[Session]:
        s = self.SessionLocal()
        try:
            yield s
            s.commit()
        except Exception:
            s.rollback()
            raise
        finally:
            s.close()

    def ping(self) -> bool:
        try:
            with self.engine.connect() as c:
                c.execute(text("SELECT 1"))
            return True
        except Exception:  # pragma: no cover - reported via /health
            log.exception("database ping failed")
            return False

    # ---------------------------------------------------------------- migrations
    def migrate(self) -> int:
        """Apply pending migrations in order. Returns the resulting schema version."""
        migrations_tbl = self._q("schema_migrations")
        with self.engine.begin() as c:
            if self.settings.is_postgres and self.schema:
                c.execute(text(f"CREATE SCHEMA IF NOT EXISTS {self.schema}"))
            c.execute(text(f"CREATE TABLE IF NOT EXISTS {migrations_tbl} (version INTEGER PRIMARY KEY)"))
            done = {r[0] for r in c.execute(text(f"SELECT version FROM {migrations_tbl}"))}
        for version, fn in MIGRATIONS:
            if version in done:
                continue
            log.info("applying migration %s", version)
            with self.engine.begin() as c:
                fn(self, c)
                c.execute(text(f"INSERT INTO {migrations_tbl} (version) VALUES (:v)"), {"v": version})
        return max(v for v, _ in MIGRATIONS)


def _m001_initial(db: Database, c) -> None:  # noqa: ANN001
    Base.metadata.create_all(c)
    if db.settings.is_postgres:
        dim = int(db.settings.embedding_dimensions)
        chunks_tbl = db._q("document_chunks")
        c.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        c.execute(text(f"ALTER TABLE {chunks_tbl} ADD COLUMN IF NOT EXISTS embedding vector({dim})"))
        c.execute(text(f"CREATE INDEX IF NOT EXISTS ix_chunks_embedding ON {chunks_tbl} USING hnsw (embedding vector_cosine_ops)"))
    else:
        c.execute(text("ALTER TABLE document_chunks ADD COLUMN embedding BLOB"))


def _m002_portal_state(db: Database, c) -> None:  # noqa: ANN001
    Base.metadata.create_all(c)


def _m003_document_files_and_rls(db: Database, c) -> None:  # noqa: ANN001
    Base.metadata.create_all(c)
    if db.settings.is_postgres:
        for tbl in (
            "documents",
            "document_chunks",
            "document_files",
            "processing_jobs",
            "audit_logs",
            "kb_settings",
            "portal_student_states",
            "schema_migrations",
        ):
            c.execute(text(f"ALTER TABLE {db._q(tbl)} ENABLE ROW LEVEL SECURITY"))


MIGRATIONS: list[tuple[int, Callable]] = [
    (1, _m001_initial),
    (2, _m002_portal_state),
    (3, _m003_document_files_and_rls),
]
