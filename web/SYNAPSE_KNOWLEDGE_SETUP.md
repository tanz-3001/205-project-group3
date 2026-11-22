# Synapse Knowledge — Architecture, Setup & Operations Guide

**Synapse Knowledge** is the document intelligence and Retrieval-Augmented Generation (RAG) module for the Synapse university student services platform. It allows authorised administrators to upload approved university policy and FAQ documents (PDF, DOCX, TXT), extracts and chunks their contents, indexes them using semantic embeddings in a persistent vector store, and provides grounded, citation-verified answers to both the administrator playground and the student-facing **Synapse Assist** chatbot.

---

## 1. Architecture Overview

```mermaid
flowchart TD
    subgraph Frontend["Synapse Web Frontend (React 19 + TypeScript + Vite)"]
        Login["Login Page (#login)\nStudent ID or Guard Email"]
        AssistUI["Synapse Assist (#assist)\nStudent Chat + Verified Citations"]
        AdminUI["Synapse Knowledge (#knowledge)\nOverview, Upload, Library, Details, Playground"]
    end

    subgraph Guard["Synapse Guard Service (Node / Express :4000)"]
        GuardAuth["POST /api/auth/login\nHS256 JWT Issuance + Lockout"]
        GuardCheck["POST /api/guard/check\nSensitivity Detection + PII Redaction"]
    end

    subgraph Knowledge["Synapse Knowledge Service (Python / FastAPI :8000)"]
        AuthMW["Guard JWT Verification & RBAC\n(admin vs student/admin)"]
        UploadAPI["Document Management API\nUpload, List, Detail, Reprocess, Delete"]
        Pipeline["Document Processing Pipeline\nValidate -> Extract -> Clean -> Chunk -> Embed"]
        SearchAPI["POST /api/knowledge/search\nSemantic Vector Retrieval"]
        QueryAPI["POST /api/knowledge/query\nGuard Check -> Retrieve -> Grounded RAG -> Citation Validation"]
    end

    subgraph Storage["Persistent Storage & AI Providers"]
        DB[("Database & Vector Store\nPostgreSQL + pgvector (prod)\nor SQLite + float32 vectors (local)")]
        Files[("Isolated File Store\nknowledge/data/uploads/")]
        EmbedAPI["Embedding Provider\nGemini (gemini-embedding-001)\nOpenAI / Local FastEmbed"]
        LLMAPI["Generation Provider\nGemini Flash / Anthropic Claude\n(with Extractive Fallback)"]
    end

    Login -->|Email + Password| GuardAuth
    AdminUI -->|Bearer JWT (admin)| AuthMW
    AssistUI -->|Bearer JWT (student/admin)| AuthMW

    AuthMW --> UploadAPI
    AuthMW --> SearchAPI
    AuthMW --> QueryAPI

    UploadAPI --> Files
    UploadAPI --> Pipeline
    Pipeline --> EmbedAPI
    Pipeline --> DB

    SearchAPI --> EmbedAPI
    SearchAPI --> DB

    QueryAPI -->|1. Sensitivity & PII Check| GuardCheck
    QueryAPI -->|2. Query Embedding| EmbedAPI
    QueryAPI -->|3. Top-K Cosine Search| DB
    QueryAPI -->|4. Grounded Generation| LLMAPI
```

### Key Architectural Decisions
1. **Isolated FastAPI Knowledge Microservice (`knowledge/`)**:
   The existing repository consists of a Vite + React SPA (`web/`), a single Vercel serverless function (`web/api/assist.ts`), and a standalone Express security reference service (`guard/`). Because reliable PDF/DOCX extraction (`PyMuPDF`, `python-docx`), token-aware chunking, background indexing jobs, and persistent vector storage require a stateful backend runtime, Synapse Knowledge is implemented as a cleanly isolated Python FastAPI service under `knowledge/`.
2. **Single Authentication & Sensitivity Authority (`guard/`)**:
   No second authentication system or duplicate sensitivity regexes were introduced. `knowledge/` verifies the exact HS256 JWTs (`sub`, `role`, `exp`) issued by `guard/src/auth.js` using the shared `JWT_SECRET`, and delegates runtime sensitivity detection and PII masking to `POST /api/guard/check` (`guard/src/sensitivity.js`).
3. **Backwards-Compatible Assist Integration**:
   `web/src/lib/assist.ts` preserves the existing local sensitivity check, conversation history format, and FAQ keyword fallback. When a user is signed in with a Synapse Guard account, `answerChat()` queries `POST /api/knowledge/query` and renders expandable document citations (`Document Name · Page X · Section Y`) with exact source excerpts. If the knowledge service is unreachable or the user signed in with the offline Student-ID demo mode, Assist seamlessly falls back to the built-in FAQ flow.

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, Lucide Icons | Knowledge administration portal (`#/knowledge`) and Assist citation UI (`#/assist`) |
| Knowledge Backend | Python 3.11+, FastAPI, Uvicorn, Pydantic v2 | REST API, validation, background job processing, RBAC, rate limiting |
| Document Extraction | `PyMuPDF` (`fitz`), `python-docx`, UTF-8/CP1252 normaliser | Page-aware PDF extraction, DOCX heading & table extraction, safe TXT decoding |
| Embeddings | Provider abstraction (`GeminiEmbeddings`, `OpenAIEmbeddings`, `LocalEmbeddings`) | Default: Google `gemini-embedding-001` (768 dimensions, L2-normalised) |
| Database & Vectors | SQLAlchemy 2.0 — PostgreSQL + `pgvector` (HNSW) or persistent SQLite + NumPy float32 BLOBs | Persistent storage for documents, chunks, embeddings, processing jobs, and audit logs |
| Answer Generation | `GeminiLLM` (`gemini-flash-latest`), `AnthropicLLM` (`claude-sonnet-5-5`), plus deterministic extractive fallback | Strict source-grounded RAG with post-generation citation and lexical support verification |
| Security & Auth | Synapse Guard (`guard/`), `PyJWT` (HS256) | Role-based access control (`admin` vs `student`), PII redaction, sensitivity escalation |

---

## 3. Data Flow & Document Processing Pipeline

### 3.1 Upload & Validation (`knowledge/app/validation.py`)
Every uploaded file passes five checks before touching disk or the database:
1. **Filename sanitisation**: Strips directory paths, control characters, and unsafe symbols.
2. **Extension & size validation**: Only `.pdf`, `.docx`, and `.txt` up to `MAX_UPLOAD_MB` (default 20 MB) are accepted.
3. **MIME & magic-byte verification**: Client `Content-Type` is cross-checked against actual file magic bytes (`%PDF-`, ZIP central directory containing `word/document.xml` and `[Content_Types].xml`, or printable UTF-8/CP1252 text without null bytes). Extension spoofing (e.g., an executable renamed to `.pdf`) is rejected with `415 Unsupported Media Type`.
4. **Structural integrity check**: Opens the byte stream with PyMuPDF / `python-docx` to reject corrupted, zero-page, or password-protected files (`422 Unprocessable Entity`).
5. **SHA-256 duplicate prevention**: Computes the content SHA-256 checksum and rejects duplicates with `409 Conflict` (`duplicate_document`), returning the existing document ID.
6. **Atomic storage**: Files are written to a temporary file and atomically moved into `KNOWLEDGE_STORAGE_PATH` under an internal UUID key (`<uuid>.<ext>`). Raw filesystem paths are never exposed in API responses.

### 3.2 Extraction & Cleaning (`knowledge/app/extraction.py`)
- **PDF (`extract_pdf`)**: Uses PyMuPDF `page.get_text("dict", sort=True)` to inspect font sizes and bold flags across spans, automatically identifying section headings relative to the document's median body font size, stripping repeated running headers/footers and standalone page numbers, and preserving 1-based `page` metadata on every block.
- **DOCX (`extract_docx`)**: Iterates document body children in order (paragraphs and tables), preserving `Heading 1..6` hierarchy (`Section › Subsection`) and formatting tables with pipe-separated cells so table rows retain their column context.
- **TXT (`extract_txt`)**: Safely decodes UTF-8 (with BOM), UTF-16, CP1252, or Latin-1, detecting Markdown (`# Heading`) and uppercase section headings.
- **Cleaning (`clean_text`)**: Normalises Unicode (`NFKC`), removes control characters, rejoins words hyphenated across line breaks, collapses intra-paragraph single line breaks, and rejects empty/scanned textless documents with a clear administrator-facing error message.

### 3.3 Intelligent Chunking (`knowledge/app/chunking.py`)
- **Configurable window**: Defaults to `CHUNK_TARGET_TOKENS=500` (configurable 500–800+) and `CHUNK_OVERLAP_TOKENS=100` (configurable 100–150).
- **Sentence & section preservation**: Splits paragraphs on sentence boundaries (`split_sentences`), never cutting a sentence mid-way unless a single sentence exceeds the target token budget.
- **Section boundary awareness**: Carries the active heading path (`section_heading`) and page span (`page_number` to `page_end`) onto every chunk. When a new section starts and the current chunk is at least 35% full, a clean chunk boundary is emitted without bleeding overlap across unrelated sections.

### 3.4 Embeddings & Persistent Vector Storage (`knowledge/app/embeddings.py`, `vectorstore.py`)
- **Provider Abstraction**: `EmbeddingProvider` protocol implemented by:
  - `GeminiEmbeddings`: Calls `batchEmbedContents` on `gemini-embedding-001` with `taskType="RETRIEVAL_DOCUMENT"` for chunks and `taskType="RETRIEVAL_QUERY"` for search queries, using `outputDimensionality=768` and L2 re-normalisation.
  - `OpenAIEmbeddings`: Calls `/v1/embeddings` (`text-embedding-3-small`).
  - `LocalEmbeddings`: Runs local ONNX models (`BAAI/bge-small-en-v1.5`) via `fastembed`.
  - **No fake fallback**: If no embedding provider is configured, indexing fails transparently with `processing_status="failed"` and `/api/knowledge/health` reports `status="degraded"`.
- **Index compatibility lock**: The active `provider:model:dimensions` signature is stored in `kb_settings`. If the embedding model is changed later, search and partial indexing alert the administrator to run `python scripts/reindex_all.py` rather than mixing incompatible vector spaces.
- **Persistent Vector Database**:
  - **PostgreSQL + `pgvector` (Production)**: When `DATABASE_URL` points to PostgreSQL, migration `001` runs `CREATE EXTENSION IF NOT EXISTS vector`, adds `embedding vector(768)`, and builds an HNSW cosine index (`vector_cosine_ops`). Search uses `1 - (c.embedding <=> CAST(:q AS vector))`.
  - **SQLite + NumPy float32 BLOBs (Local Dev / CI)**: When PostgreSQL is not installed locally, embeddings are stored persistently in SQLite `BLOB` columns and searched with exact L2-normalised cosine similarity over `INDEXED` documents.
  - **Transactional integrity**: Re-indexing or deleting a document updates/removes chunks and embeddings inside a single database transaction (`ON DELETE CASCADE`).

---

## 4. Semantic Retrieval, Grounded RAG & Citation Verification

### 4.1 Semantic Search (`knowledge/app/retrieval.py`)
1. Validates query length (3–1,000 characters).
2. Generates a query embedding (`RETRIEVAL_QUERY`).
3. Searches only chunks belonging to `processing_status = 'indexed'` documents (optionally filtered by `document_ids`).
4. Filters out any chunk below `RETRIEVAL_MIN_SCORE` (default `0.62`) so irrelevant passages are never returned just to fill `top_k`.
5. Computes a retrieval-based **Evidence Assessment** (`high`, `medium`, `low`, or `none`) based on top similarity score and number of strong supporting passages (`>= RETRIEVAL_STRONG_SCORE`), explicitly stating its basis rather than fabricating an LLM probability percentage.

### 4.2 RAG Pipeline & Prompt-Injection Defence (`knowledge/app/rag.py`)
```
Student Question
  -> Query Validation
  -> Synapse Guard Sensitivity & PII Check (POST /api/guard/check)
  -> Query Embedding
  -> Vector Similarity Search + Relevance Threshold
  -> Untrusted-Data XML Context Construction (<sources><source id="S1" ...>)
  -> LLM Grounded Generation (or Extractive Fallback)
  -> Citation & Lexical Support Verification
  -> Final Answer + Verifiable Citations
```
- **Prompt-Injection Protection**: Retrieved passages are XML-escaped (`&lt;`, `&gt;`, `&amp;`) so an uploaded document cannot break out of `<sources>` tags. Passages matching instruction-override patterns (`ignore previous instructions`, `system prompt`, `act as`, etc.) are logged and flagged with a warning, while the system prompt strictly instructs the model to treat `<sources>` as untrusted data.
- **Citation Verification**:
  - Only citation markers (`[S1]`, `[S2]`, …) that match actually retrieved passages are kept; any fabricated marker is stripped.
  - If the model returns `sufficient: false`, produces no valid citation, or fails the lexical support ratio check (`support_ratio < 0.50` against cited passages), the pipeline abstains or falls back to verbatim extractive quoting from the top retrieved passage.

---

## 5. API Reference

All endpoints are prefixed with `/api/knowledge`. Protected endpoints require an `Authorization: Bearer <GUARD_JWT>` header.

| Method | Path | Auth Role | Description |
|---|---|---|---|
| `GET` | `/api/knowledge/health` | Public | Database, vector store, auth, Guard, embedding, and LLM readiness |
| `GET` | `/api/knowledge/stats` | `admin` | Real-time counts: total documents, indexed, processing, failed, total chunks, last indexed timestamp |
| `POST` | `/api/knowledge/documents/upload` | `admin` | Multipart upload (`file`, optional `display_name`). Validates, stores, and queues indexing (`201 Created`) |
| `GET` | `/api/knowledge/documents` | `admin` | List documents with optional `?q=` search and `?status=` filter |
| `GET` | `/api/knowledge/documents/{id}` | `admin` | Document metadata, processing job history, and paginated extracted chunks |
| `POST` | `/api/knowledge/documents/{id}/reprocess` | `admin` | Re-run extraction, chunking, and embedding (`202 Accepted`) |
| `DELETE` | `/api/knowledge/documents/{id}` | `admin` | Transactionally delete document, chunks, embeddings, jobs, and stored file |
| `POST` | `/api/knowledge/search` | `admin` | Semantic search (`{"query": "...", "top_k": 5, "document_ids": [...]}`) |
| `POST` | `/api/knowledge/query` | `student`, `admin` | Full Guard-checked RAG pipeline (`{"question": "...", "history": [...], "top_k": 6}`) |
| `GET` | `/api/knowledge/audit` | `admin` | Administrative audit trail (`upload`, `upload_rejected`, `reprocess`, `retry`, `delete`, `request_update`) |
| `GET` | `/api/knowledge/portal/state/{student_id}` | `student`, `admin` | Retrieve persisted student portal state (`log`, `requests`, `ratings`); redacts raw transcripts for non-admin callers |
| `PUT` | `/api/knowledge/portal/state/{student_id}` | `student`, `admin` | Persist student queries, requests, ratings, and chats to `portal_student_states` |
| `GET` | `/api/knowledge/portal/records` | `admin` | Retrieve all persisted student activity & escalated requests (including shared conversation transcripts) |
| `PATCH` | `/api/knowledge/portal/requests/{student_id}/{request_id}` | `admin` | Update an escalated request's `status` (`Waiting for staff`, `In progress`, `Resolved`) and staff `reply` |

---

## 6. Environment Variables

See `knowledge/.env.example` and `web/.env.example`.

| Variable | Service | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | `knowledge` | `sqlite:///./data/knowledge.db` | SQLAlchemy URL (`postgresql+psycopg://...` for PostgreSQL + pgvector) |
| `KNOWLEDGE_STORAGE_PATH` | `knowledge` | `./data/uploads` | Directory outside web root for raw uploaded files |
| `JWT_SECRET` | `guard` & `knowledge` | `dev-only-secret-change-me` | Shared HS256 secret between Synapse Guard and Synapse Knowledge |
| `GUARD_API_URL` | `knowledge` | `http://localhost:4000` | Base URL of Synapse Guard for `/api/guard/check` |
| `GUARD_FAIL_MODE` | `knowledge` | `closed` | `closed` rejects queries if Guard is down; `open` allows fallback |
| `EMBEDDING_PROVIDER` | `knowledge` | `gemini` (if key set) | `gemini`, `openai`, or `local` |
| `EMBEDDING_MODEL` | `knowledge` | `gemini-embedding-001` | Embedding model identifier |
| `EMBEDDING_DIMENSIONS` | `knowledge` | `768` | Vector dimensionality |
| `GEMINI_API_KEY` | `knowledge` | — | Google Gemini API key (used for Gemini embeddings and/or Gemini Flash LLM) |
| `LLM_PROVIDER` | `knowledge` | `gemini` (if key set) | `gemini`, `anthropic`, or `none` (extractive mode) |
| `LLM_MODEL` | `knowledge` | `gemini-flash-latest` | Model for grounded RAG answer synthesis |
| `CHUNK_TARGET_TOKENS` | `knowledge` | `500` | Target chunk size in tokens |
| `CHUNK_OVERLAP_TOKENS` | `knowledge` | `100` | Inter-chunk sentence overlap in tokens |
| `RETRIEVAL_TOP_K` | `knowledge` | `6` | Default number of chunks retrieved |
| `RETRIEVAL_MIN_SCORE` | `knowledge` | `0.62` | Minimum cosine similarity threshold |

---

## 7. Local Setup, Running & Testing

### 7.1 Prerequisites
- **Node.js** 20+ and **npm**
- **Python** 3.11+
- A `GEMINI_API_KEY` (or OpenAI key / `fastembed` for local embeddings)

### 7.2 Install Dependencies
```bash
# 1. Synapse Guard (authentication & sensitivity service)
cd guard
npm ci

# 2. Synapse Knowledge backend (FastAPI)
cd ../knowledge
python -m pip install -r requirements-dev.txt

# 3. Synapse Web frontend (React + Vite)
cd ../web
npm ci
```

### 7.3 Generate & Seed Sample University Documents
Three realistic, fictional university documents are included and can be regenerated at any time:
- `Academic_Regulations_2026.pdf` (multi-page PDF with numbered sections on attendance, late penalties, extensions, mitigating circumstances, exams, add/drop, progression)
- `Student_Handbook_2026.docx` (Word document with headings and a 3-column tuition instalment table)
- `IT_Help_Desk_FAQ.txt` (Markdown-structured text FAQ covering password resets, `SynapseDemo-Secure` Wi-Fi, MFA, and student software)

```bash
cd knowledge
python scripts/make_sample_docs.py
# Optional: seed and index them directly into knowledge/data/knowledge.db
python scripts/seed_demo.py
```

### 7.4 Start All Three Services Locally
Run each service in its own terminal:

```bash
# Terminal 1 — Synapse Guard (:4000)
cd guard
npm start

# Terminal 2 — Synapse Knowledge (:8000)
cd knowledge
# Ensure GEMINI_API_KEY and JWT_SECRET=dev-only-secret-change-me are set in your environment or knowledge/.env
python -m uvicorn app.asgi:app --host 0.0.0.0 --port 8000

# Terminal 3 — Synapse Web (:5173, proxies /api/knowledge -> :8000 and /api/auth,/api/guard -> :4000)
cd web
npm run dev
```

Open `http://localhost:5173`:
- **Administrator sign-in**: `admin@demo.ac.ae` / `Admin#123` → opens **Synapse Knowledge** (`#/knowledge`) in the sidebar to upload documents, inspect chunks, and test queries in the playground.
- **Student sign-in**: `student@demo.ac.ae` / `Student#123` → opens **Synapse Assist** (`#/assist`) to ask questions backed by the indexed university documents with expandable citations, while `#/knowledge` and all admin endpoints are blocked (`403 Forbidden`).

### 7.5 Run Automated Tests, Lint & Build
```bash
# Guard unit & integration tests (8 tests)
cd guard && npm test

# Knowledge backend unit, security, pipeline, API & live Gemini tests (67 tests)
cd ../knowledge && python -m pytest -v

# Frontend lint & production TypeScript/Vite build
cd ../web && npm run lint && npm run build
```

---

## 8. Deployment Instructions

Because the frontend (`web/`) is configured as a static Vite SPA (deployed on Vercel) while `knowledge/` and `guard/` are stateful services (requiring persistent disk for uploaded files and a persistent database):

1. **Database**: Provision a managed PostgreSQL instance with the `pgvector` extension enabled (e.g. Supabase, Neon, RDS, or Cloud SQL). Set `DATABASE_URL=postgresql+psycopg://...`. On startup, `knowledge` automatically runs `CREATE EXTENSION IF NOT EXISTS vector` and creates all tables and HNSW indexes.
2. **Knowledge Service (`knowledge/`)**: Deploy as a container or Python web service (e.g. Cloud Run, Render, Railway, Fly.io) running:
   ```bash
   uvicorn app.asgi:app --host 0.0.0.0 --port $PORT
   ```
   Mount a persistent volume at `KNOWLEDGE_STORAGE_PATH` (or back it with object storage) and configure `JWT_SECRET`, `GUARD_API_URL`, `GEMINI_API_KEY`, `DATABASE_URL`, and `KNOWLEDGE_CORS_ORIGINS=https://your-vercel-domain.vercel.app`.
3. **Synapse Guard (`guard/`)**: Deploy as a Node service with the same `JWT_SECRET`.
4. **Web Frontend (`web/`)**: In Vercel Project Settings → Environment Variables, set:
   - `VITE_KNOWLEDGE_API_URL=https://your-knowledge-service.example.com/api/knowledge`
   - `VITE_GUARD_API_URL=https://your-guard-service.example.com/api`

---

## 9. Known Limitations & Future Improvements

- **Scanned image-only PDFs**: PyMuPDF extracts embedded digital text. Image-only scanned PDFs without an OCR text layer are cleanly rejected with an actionable message (`No readable text was found. If this is a scanned PDF, upload a text-based version.`). Future versions can add an optional OCR pass (e.g., Tesseract or Gemini multimodal page transcription).
- **Single-instance background worker & rate limiter**: Document processing uses an in-process `ThreadPoolExecutor` with atomic database status claims, and rate limiting uses an in-memory sliding window. For multi-replica horizontal scaling, move job queueing and rate limiting to Redis / Celery.
- **Object storage**: Uploaded files are stored on the local/mounted filesystem under `KNOWLEDGE_STORAGE_PATH`. For stateless container platforms, replace `FileStorage` with an S3/GCS bucket adapter.
