"""Synapse Knowledge API (FastAPI).

All routes live under /api/knowledge. Management routes require a Guard token with an
admin role; /query requires a chat role (student or admin) and runs Guard's sensitivity check.
"""
from __future__ import annotations

import hashlib
import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime

from fastapi import APIRouter, Depends, FastAPI, File, Form, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from starlette.exceptions import HTTPException as StarletteHTTPException

from .auth import User, require_admin, require_chat
from .config import Settings, load_settings
from .db import Database
from .embeddings import EmbeddingProvider, build_embedder
from .errors import ApiError
from .guard_client import GuardClient, GuardUnavailable
from .models import AuditLog, Document, DocumentChunk, ProcessingJob, Status
from .processing import FileStorage, Processor, embedding_signature, stored_signature
from .rag import answer_question, build_llm
from .ratelimit import RateLimiter
from .retrieval import retrieve, validate_query
from .validation import UploadRejected, display_name_from, validate_upload

log = logging.getLogger("knowledge.api")


@dataclass
class AppContext:
    settings: Settings
    db: Database
    storage: FileStorage
    embedder: EmbeddingProvider | None
    llm: object | None
    guard: GuardClient
    vectors: object
    limiter: RateLimiter = field(default_factory=RateLimiter)
    sync_processing: bool = False
    executor: ThreadPoolExecutor = field(default_factory=lambda: ThreadPoolExecutor(max_workers=2, thread_name_prefix="kb-process"))
    processor: Processor | None = None

    def submit(self, document_id: str, job_id: str) -> None:
        assert self.processor
        if self.sync_processing:
            self.processor.run(document_id, job_id)
        else:
            self.executor.submit(self.processor.run, document_id, job_id)


# ---------------------------------------------------------------- helpers
def iso(d: datetime | None) -> str | None:
    return d.isoformat() if d else None


def doc_dict(d: Document) -> dict:
    return {
        "id": d.id, "filename": d.filename, "display_name": d.display_name, "file_type": d.file_type, "mime_type": d.mime_type,
        "file_size": d.file_size, "checksum": d.checksum, "uploaded_by": d.uploaded_by, "uploaded_by_name": d.uploaded_by_name,
        "created_at": iso(d.created_at), "updated_at": iso(d.updated_at), "processing_status": d.processing_status,
        "processing_error": d.processing_error, "page_count": d.page_count, "chunk_count": d.chunk_count,
        "processed_at": iso(d.processed_at), "version": d.version,
    }


def job_dict(j: ProcessingJob) -> dict:
    return {"id": j.id, "status": j.status, "trigger": j.trigger, "created_at": iso(j.created_at), "started_at": iso(j.started_at),
            "completed_at": iso(j.completed_at), "error_message": j.error_message, "retry_count": j.retry_count}


def audit(s, user: User, action: str, document_id: str | None = None, **meta) -> None:  # noqa: ANN001
    s.add(AuditLog(actor_id=user.id, actor_role=user.role, action=action, document_id=document_id, metadata_json=meta))
    log.info("audit %s by %s (%s) doc=%s", action, user.id, user.role, document_id)


def get_ctx(request: Request) -> AppContext:
    return request.app.state.ctx


class SearchBody(BaseModel):
    query: str = Field(max_length=2000)
    top_k: int | None = Field(default=None, ge=1, le=50)
    document_ids: list[str] | None = Field(default=None, max_length=50)


class QueryBody(BaseModel):
    question: str = Field(max_length=2000)
    history: list[str] = Field(default_factory=list, max_length=20)
    top_k: int | None = Field(default=None, ge=1, le=50)


# ---------------------------------------------------------------- routes
router = APIRouter(prefix="/api/knowledge")


@router.get("/health")
def health(ctx: AppContext = Depends(get_ctx)) -> dict:
    db_ok = ctx.db.ping()
    compatible = True
    if db_ok and ctx.embedder is not None:
        with ctx.db.session() as s:
            sig = stored_signature(s)
        compatible = sig is None or sig == embedding_signature(ctx.embedder)
    s = ctx.settings
    ready = db_ok and ctx.embedder is not None and compatible and bool(s.jwt_secret)
    return {
        "status": "ok" if ready else "degraded",
        "database": "ok" if db_ok else "error",
        "vector_store": ctx.vectors.kind,
        "auth_configured": bool(s.jwt_secret),
        "guard_configured": ctx.guard.configured,
        "embedding": {"configured": ctx.embedder is not None, "provider": ctx.embedder.name if ctx.embedder else s.embedding_provider or None,
                      "model": ctx.embedder.model if ctx.embedder else None, "index_compatible": compatible},
        "llm": {"configured": ctx.llm is not None, "provider": getattr(ctx.llm, "name", None), "model": getattr(ctx.llm, "model", None),
                "mode": "llm" if ctx.llm else "extractive"},
    }


@router.get("/stats")
def stats(user: User = Depends(require_admin), ctx: AppContext = Depends(get_ctx)) -> dict:
    with ctx.db.session() as s:
        counts = dict(s.execute(select(Document.processing_status, func.count()).group_by(Document.processing_status)).all())
        chunks = s.scalar(select(func.count()).select_from(DocumentChunk).join(Document).where(Document.processing_status == Status.INDEXED)) or 0
        last = s.scalar(select(func.max(Document.processed_at)).where(Document.processing_status == Status.INDEXED))
    return {
        "total_documents": sum(counts.values()), "indexed": counts.get(Status.INDEXED, 0),
        "processing": counts.get(Status.PROCESSING, 0) + counts.get(Status.QUEUED, 0) + counts.get(Status.UPLOADED, 0),
        "failed": counts.get(Status.FAILED, 0), "indexed_chunks": chunks, "last_indexed_at": iso(last),
    }


@router.post("/documents/upload", status_code=201)
async def upload(request: Request, file: UploadFile = File(...), display_name: str | None = Form(default=None),
                 user: User = Depends(require_admin), ctx: AppContext = Depends(get_ctx)) -> dict:
    ctx.limiter.check(f"admin:{user.id}", ctx.settings.rate_limit_admin_per_min)
    max_bytes = ctx.settings.max_upload_bytes
    data = await file.read(max_bytes + 1)
    try:
        v = validate_upload(file.filename, file.content_type, data, max_bytes)
    except UploadRejected as e:
        with ctx.db.session() as s:
            audit(s, user, "upload_rejected", None, filename=(file.filename or "")[:150], reason=e.code)
        raise ApiError(e.status, e.code, e.message)

    checksum = hashlib.sha256(data).hexdigest()
    with ctx.db.session() as s:
        existing = s.scalar(select(Document).where(Document.checksum == checksum))
        if existing:
            raise ApiError(409, "duplicate_document", f"This file has already been uploaded as “{existing.display_name}”.", {"existing_document_id": existing.id})
    key = ctx.storage.save(data, v.file_type)
    name = " ".join((display_name or "").split())[:200] or display_name_from(v.filename)
    try:
        with ctx.db.session() as s:
            doc = Document(filename=v.filename, display_name=name, file_type=v.file_type, mime_type=v.mime_type, file_size=len(data),
                           checksum=checksum, storage_key=key, uploaded_by=user.id, uploaded_by_name=user.name or user.id)
            s.add(doc)
            s.flush()
            job = ctx.processor.enqueue(s, doc, "upload")  # type: ignore[union-attr]
            audit(s, user, "upload", doc.id, filename=v.filename, size=len(data), checksum=checksum)
            s.flush()
            doc_id, job_id = doc.id, job.id
    except Exception:
        ctx.storage.delete(key)  # no orphaned files when the DB write fails (e.g. a racing duplicate)
        raise
    ctx.submit(doc_id, job_id)
    with ctx.db.session() as s:
        return {"document": doc_dict(s.get(Document, doc_id))}


@router.get("/documents")
def list_documents(q: str | None = Query(default=None, max_length=200), status: str | None = Query(default=None),
                   user: User = Depends(require_admin), ctx: AppContext = Depends(get_ctx)) -> dict:
    stmt = select(Document).order_by(Document.created_at.desc())
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Document.display_name.ilike(like), Document.filename.ilike(like)))
    if status:
        if status not in Status.ALL:
            raise ApiError(422, "invalid_status", "Unknown status filter.")
        stmt = stmt.where(Document.processing_status == status)
    with ctx.db.session() as s:
        return {"documents": [doc_dict(d) for d in s.scalars(stmt)]}


def _get_doc(s, doc_id: str) -> Document:  # noqa: ANN001
    doc = s.get(Document, doc_id) if len(doc_id) <= 32 else None
    if doc is None:
        raise ApiError(404, "not_found", "Document not found.")
    return doc


@router.get("/documents/{doc_id}")
def get_document(doc_id: str, chunk_offset: int = Query(default=0, ge=0), chunk_limit: int = Query(default=20, ge=1, le=100),
                 user: User = Depends(require_admin), ctx: AppContext = Depends(get_ctx)) -> dict:
    with ctx.db.session() as s:
        doc = _get_doc(s, doc_id)
        chunks = s.scalars(select(DocumentChunk).where(DocumentChunk.document_id == doc_id).order_by(DocumentChunk.chunk_index)
                           .offset(chunk_offset).limit(chunk_limit)).all()
        return {
            "document": doc_dict(doc),
            "jobs": [job_dict(j) for j in doc.jobs],
            "chunks": [{"id": c.id, "chunk_index": c.chunk_index, "page_number": c.page_number, "page_end": c.page_end,
                        "section_heading": c.section_heading, "token_count": c.token_count, "content": c.content} for c in chunks],
            "chunk_offset": chunk_offset,
        }


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str, user: User = Depends(require_admin), ctx: AppContext = Depends(get_ctx)) -> dict:
    ctx.limiter.check(f"admin:{user.id}", ctx.settings.rate_limit_admin_per_min)
    with ctx.db.session() as s:
        doc = _get_doc(s, doc_id)
        key, name, chunks = doc.storage_key, doc.display_name, doc.chunk_count
        s.delete(doc)  # chunks, embeddings and jobs are removed by ON DELETE CASCADE in the same transaction
        audit(s, user, "delete", doc_id, display_name=name, chunk_count=chunks)
    ctx.storage.delete(key)  # after commit: the worst case is an orphaned file, never orphaned index rows
    return {"deleted": doc_id}


@router.post("/documents/{doc_id}/reprocess", status_code=202)
def reprocess(doc_id: str, user: User = Depends(require_admin), ctx: AppContext = Depends(get_ctx)) -> dict:
    ctx.limiter.check(f"admin:{user.id}", ctx.settings.rate_limit_admin_per_min)
    with ctx.db.session() as s:
        doc = _get_doc(s, doc_id)
        if doc.processing_status in (Status.QUEUED, Status.PROCESSING):
            raise ApiError(409, "already_processing", "This document is already being processed.")
        trigger = "retry" if doc.processing_status == Status.FAILED else "reprocess"
        job = ctx.processor.enqueue(s, doc, trigger)  # type: ignore[union-attr]
        audit(s, user, trigger, doc_id)
        s.flush()
        job_id = job.id
    ctx.submit(doc_id, job_id)
    with ctx.db.session() as s:
        return {"document": doc_dict(s.get(Document, doc_id))}


@router.post("/search")
def search(body: SearchBody, user: User = Depends(require_admin), ctx: AppContext = Depends(get_ctx)) -> dict:
    ctx.limiter.check(f"admin:{user.id}", ctx.settings.rate_limit_admin_per_min)
    q = validate_query(body.query)
    passages = retrieve(ctx, q, body.top_k or ctx.settings.top_k_default, body.document_ids)
    from .retrieval import evidence
    return {"query": q, "results": [p.to_dict() for p in passages], "evidence": evidence(passages, ctx.settings.strong_relevance),
            "min_score": ctx.settings.min_relevance}


GUARD_LABELS = {
    "mental_health": "Wellbeing", "harassment_safety": "Wellbeing", "academic_integrity_discipline": "Academic appeals",
    "grades_and_records": "Academic appeals", "financial": "Financial help", "visa_immigration": "Legal and complaints",
    "complaint": "Legal and complaints",
}


@router.post("/query")
def query(body: QueryBody, request: Request, user: User = Depends(require_chat), ctx: AppContext = Depends(get_ctx)) -> dict:
    ctx.limiter.check(f"query:{user.id}", ctx.settings.rate_limit_query_per_min)
    question = validate_query(body.question)

    # 1. Sensitive enquiry detection is delegated to Synapse Guard (not duplicated here).
    try:
        verdict = ctx.guard.check(question, request.headers.get("authorization", ""))
    except GuardUnavailable as exc:
        log.warning("guard unavailable: %s", exc)
        if ctx.settings.guard_fail_closed:
            raise ApiError(503, "guard_unavailable", "The safety check is unavailable, so the question was not answered automatically.")
        verdict = None
    if verdict and verdict.action == "escalate":
        return {"status": "escalate", "category": GUARD_LABELS.get(verdict.category, "General enquiry"), "guard_category": verdict.category,
                "urgent": verdict.urgent, "answer": None, "citations": [], "passages": [], "evidence": None}
    safe_q = verdict.safe_text if verdict else question  # personal data masked by Guard before embedding / LLM

    # 2. Retrieval. Very short follow-ups borrow the previous question for context.
    earlier = [" ".join(str(h).split())[:300] for h in body.history[-3:] if str(h).strip()]
    retrieval_q = f"{earlier[-1]} {safe_q}" if earlier and len(safe_q.split()) < 5 else safe_q
    passages = retrieve(ctx, retrieval_q, body.top_k or ctx.settings.top_k_default)

    # 3. Grounded generation + citation validation.
    result = answer_question(safe_q, passages, earlier, ctx.llm, ctx.settings)
    return result.to_dict(getattr(ctx.llm, "name", None), getattr(ctx.llm, "model", None))


@router.get("/audit")
def audit_log(limit: int = Query(default=100, ge=1, le=500), user: User = Depends(require_admin), ctx: AppContext = Depends(get_ctx)) -> dict:
    with ctx.db.session() as s:
        rows = s.scalars(select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)).all()
        return {"entries": [{"id": r.id, "actor_id": r.actor_id, "actor_role": r.actor_role, "action": r.action, "document_id": r.document_id,
                             "timestamp": iso(r.timestamp), "metadata": r.metadata_json} for r in rows]}


def _auto_seed_sample_docs(ctx: AppContext) -> None:
    """On Vercel cold start with an empty SQLite DB, seed the bundled sample university documents."""
    from .config import BASE_DIR
    sample_dir = BASE_DIR / "sample_docs"
    if not sample_dir.is_dir() or ctx.embedder is None:
        return
    with ctx.db.session() as s:
        if (s.scalar(select(func.count()).select_from(Document)) or 0) > 0:
            return
    for path in sorted(sample_dir.iterdir()):
        if not path.is_file():
            continue
        try:
            data = path.read_bytes()
            v = validate_upload(path.name, None, data, ctx.settings.max_upload_bytes)
            checksum = hashlib.sha256(data).hexdigest()
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
                job = ctx.processor.enqueue(s, doc, "upload")  # type: ignore[union-attr]
                s.add(AuditLog(actor_id="u_2", actor_role="admin", action="seed_upload", document_id=doc.id, metadata_json={"filename": v.filename}))
                s.flush()
                doc_id, job_id = doc.id, job.id
            ctx.submit(doc_id, job_id)
        except Exception:
            log.exception("failed to auto-seed %s", path.name)


# ---------------------------------------------------------------- app factory
def create_app(settings: Settings | None = None, *, embedder: EmbeddingProvider | None | str = "auto", llm: object | None | str = "auto",
               guard: GuardClient | None = None, sync_processing: bool | None = None) -> FastAPI:
    import os
    from .vectorstore import VectorStore

    settings = settings or load_settings()
    if sync_processing is None:
        sync_processing = bool(os.environ.get("VERCEL"))
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    db = Database(settings)
    db.migrate()
    emb = build_embedder(settings) if embedder == "auto" else embedder
    gen = build_llm(settings) if llm == "auto" else llm
    ctx = AppContext(settings=settings, db=db, storage=FileStorage(settings.storage_path), embedder=emb, llm=gen,  # type: ignore[arg-type]
                     guard=guard or GuardClient(settings.guard_api_url), vectors=VectorStore(settings.is_postgres), sync_processing=sync_processing)
    ctx.processor = Processor(ctx)

    app = FastAPI(title="Synapse Knowledge", version="1.0.0", docs_url="/api/knowledge/docs", openapi_url="/api/knowledge/openapi.json")
    app.state.ctx = ctx
    if settings.cors_origins:
        app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["GET", "POST", "DELETE"], allow_headers=["Authorization", "Content-Type"])

    _seeded = False

    @app.middleware("http")
    async def limit_body(request: Request, call_next):  # noqa: ANN001, ANN202
        nonlocal _seeded
        if not _seeded and os.environ.get("VERCEL") and not request.url.path.endswith("/health"):
            _seeded = True
            _auto_seed_sample_docs(ctx)
        cl = request.headers.get("content-length")
        if cl and cl.isdigit() and int(cl) > settings.max_upload_bytes + 1024 * 1024:
            return JSONResponse(status_code=413, content={"error": {"code": "file_too_large", "message": f"Files must be smaller than {settings.max_upload_mb} MB."}})
        return await call_next(request)

    @app.exception_handler(ApiError)
    async def _api_error(_: Request, e: ApiError):  # noqa: ANN202
        return JSONResponse(status_code=e.status, content={"error": {"code": e.code, "message": e.message, **e.extra}})

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, e: RequestValidationError):  # noqa: ANN202
        fields = [".".join(str(x) for x in err.get("loc", [])[1:]) for err in e.errors()]
        return JSONResponse(status_code=422, content={"error": {"code": "invalid_request", "message": "The request is missing or has invalid fields.", "fields": fields}})

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, e: StarletteHTTPException):  # noqa: ANN202
        return JSONResponse(status_code=e.status_code, content={"error": {"code": "http_error", "message": str(e.detail)}})

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, e: Exception):  # noqa: ANN202
        log.exception("unhandled error")
        return JSONResponse(status_code=500, content={"error": {"code": "internal_error", "message": "Something went wrong. Please try again."}})

    app.include_router(router)

    for doc_id, job_id in ctx.processor.recover_interrupted():
        ctx.submit(doc_id, job_id)
    return app
