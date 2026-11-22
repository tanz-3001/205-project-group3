"""Database engine, sessions and versioned schema migrations."""
from __future__ import annotations

import logging
from contextlib import contextmanager
from pathlib import Path
from typing import Callable, Iterator

from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from .config import Settings
from .models import Base

log = logging.getLogger("knowledge.db")


class Database:
    def __init__(self, settings: Settings):
        self.settings = settings
        url = settings.database_url
        kwargs: dict = {"pool_pre_ping": True}
        if url.startswith("sqlite"):
            path = url.replace("sqlite:///", "", 1)
            if path and path != ":memory:":
                Path(path).parent.mkdir(parents=True, exist_ok=True)
            kwargs["connect_args"] = {"check_same_thread": False, "timeout": 30}
        self.engine: Engine = create_engine(url, **kwargs)
        if url.startswith("sqlite"):
            @event.listens_for(self.engine, "connect")
            def _sqlite_pragmas(conn, _):  # noqa: ANN001
                cur = conn.cursor()
                cur.execute("PRAGMA foreign_keys=ON")  # enables ON DELETE CASCADE
                cur.execute("PRAGMA journal_mode=WAL")
                cur.close()
        self.SessionLocal = sessionmaker(bind=self.engine, expire_on_commit=False)

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
        with self.engine.begin() as c:
            c.execute(text("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)"))
            done = {r[0] for r in c.execute(text("SELECT version FROM schema_migrations"))}
        for version, fn in MIGRATIONS:
            if version in done:
                continue
            log.info("applying migration %s", version)
            with self.engine.begin() as c:
                fn(self, c)
                c.execute(text("INSERT INTO schema_migrations (version) VALUES (:v)"), {"v": version})
        return max(v for v, _ in MIGRATIONS)


def _m001_initial(db: Database, c) -> None:  # noqa: ANN001
    Base.metadata.create_all(c)
    if db.settings.is_postgres:
        dim = int(db.settings.embedding_dimensions)
        c.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        c.execute(text(f"ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding vector({dim})"))
        c.execute(text("CREATE INDEX IF NOT EXISTS ix_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops)"))
    else:
        c.execute(text("ALTER TABLE document_chunks ADD COLUMN embedding BLOB"))


MIGRATIONS: list[tuple[int, Callable]] = [(1, _m001_initial)]
