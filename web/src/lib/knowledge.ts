/** Client for the Synapse Knowledge service (knowledge/). All authorisation is enforced server-side. */

const env = import.meta.env as Record<string, string | undefined>
export const KNOWLEDGE_API = (env.VITE_KNOWLEDGE_API_URL ?? "/api/knowledge").replace(/\/$/, "")
export const GUARD_API = (env.VITE_GUARD_API_URL ?? "/api").replace(/\/$/, "")

export type DocStatus = "uploaded" | "queued" | "processing" | "indexed" | "failed"
export type KDocument = {
  id: string
  filename: string
  display_name: string
  file_type: "pdf" | "docx" | "txt"
  mime_type: string
  file_size: number
  checksum: string
  uploaded_by: string
  uploaded_by_name: string
  created_at: string
  updated_at: string
  processing_status: DocStatus
  processing_error: string | null
  page_count: number | null
  chunk_count: number
  processed_at: string | null
  version: number
}
export type KJob = { id: string; status: string; trigger: string; created_at: string; started_at: string | null; completed_at: string | null; error_message: string | null; retry_count: number }
export type KChunk = { id: string; chunk_index: number; page_number: number | null; page_end: number | null; section_heading: string | null; token_count: number; content: string }
export type KStats = { total_documents: number; indexed: number; processing: number; failed: number; indexed_chunks: number; last_indexed_at: string | null }
export type Passage = {
  id: string
  chunk_id: string
  document_id: string
  document_name: string
  file_type: string
  chunk_index: number
  page_number: number | null
  page_end: number | null
  section: string | null
  location: string
  score: number
  excerpt: string
}
export type Evidence = { level: "none" | "low" | "medium" | "high"; top_score: number | null; supporting_passages: number; documents: number; basis: string }
export type SearchResult = { query: string; results: Passage[]; evidence: Evidence; min_score: number }
export type QueryResult =
  | { status: "answered" | "insufficient_evidence"; answer: string; citations: Passage[]; passages: Passage[]; evidence: Evidence; generation: { mode: string; provider: string | null; model: string | null }; warnings: string[] }
  | { status: "escalate"; category: string; urgent: boolean; answer: null; citations: []; passages: []; evidence: null }
export type Health = {
  status: "ok" | "degraded"
  database: string
  vector_store: string
  auth_configured: boolean
  guard_configured: boolean
  embedding: { configured: boolean; provider: string | null; model: string | null; index_compatible: boolean }
  llm: { configured: boolean; provider: string | null; model: string | null; mode: string }
}

export class KnowledgeError extends Error {
  status: number
  code: string
  extra: Record<string, unknown>
  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.extra = extra
  }
}

async function parse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as ({ error?: { code?: string; message?: string } } & Record<string, unknown>) | null
  if (!res.ok) {
    const e = data?.error ?? {}
    throw new KnowledgeError(res.status, e.code ?? "http_" + res.status, e.message ?? (res.status >= 500 ? "The knowledge service is unavailable." : "Request failed."), e as Record<string, unknown>)
  }
  return data as T
}

async function call<T>(token: string | undefined, path: string, init: RequestInit = {}, timeoutMs = 30000): Promise<T> {
  const ctl = new AbortController()
  const timer = window.setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(KNOWLEDGE_API + path, {
      ...init,
      signal: ctl.signal,
      headers: { ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    })
    return await parse<T>(res)
  } catch (e) {
    if (e instanceof KnowledgeError) throw e
    throw new KnowledgeError(0, "network_error", "Could not reach the knowledge service. Check your connection and that the service is running.")
  } finally {
    window.clearTimeout(timer)
  }
}

export const knowledge = {
  health: () => call<Health>(undefined, "/health"),
  stats: (t: string) => call<KStats>(t, "/stats"),
  list: (t: string, q = "") => call<{ documents: KDocument[] }>(t, "/documents" + (q ? `?q=${encodeURIComponent(q)}` : "")),
  get: (t: string, id: string, offset = 0) => call<{ document: KDocument; jobs: KJob[]; chunks: KChunk[]; chunk_offset: number }>(t, `/documents/${encodeURIComponent(id)}?chunk_offset=${offset}&chunk_limit=20`),
  remove: (t: string, id: string) => call<{ deleted: string }>(t, `/documents/${encodeURIComponent(id)}`, { method: "DELETE" }),
  reprocess: (t: string, id: string) => call<{ document: KDocument }>(t, `/documents/${encodeURIComponent(id)}/reprocess`, { method: "POST" }),
  search: (t: string, query: string, top_k = 6) => call<SearchResult>(t, "/search", { method: "POST", body: JSON.stringify({ query, top_k }) }),
  query: (t: string, question: string, history: string[] = []) => call<QueryResult>(t, "/query", { method: "POST", body: JSON.stringify({ question, history }) }, 45000),
}

/** Upload one file with real byte-level progress (XMLHttpRequest exposes upload progress; fetch does not). */
export function uploadDocument(token: string, file: File, onProgress: (pct: number) => void): Promise<{ document: KDocument }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", `${KNOWLEDGE_API}/documents/upload`)
    xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onerror = () => reject(new KnowledgeError(0, "network_error", "The upload was interrupted. Check your connection and try again."))
    xhr.onload = () => {
      let data: { error?: { code?: string; message?: string } } & Record<string, unknown> = {}
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        /* non-JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as unknown as { document: KDocument })
      else reject(new KnowledgeError(xhr.status, data.error?.code ?? "http_" + xhr.status, data.error?.message ?? "Upload failed.", (data.error ?? {}) as Record<string, unknown>))
    }
    const form = new FormData()
    form.append("file", file)
    xhr.send(form)
  })
}

export const ACCEPTED = ".pdf,.docx,.txt"
export const MAX_MB = 20
