import { AlertTriangle, CheckCircle2, Clock3, Database, Eye, FileText, Library, Loader2, RefreshCw, Search, Sparkles, Trash2, UploadCloud, XCircle } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { DragEvent, FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { isKnowledgeAdmin, useAuth } from "@/lib/auth"
import { ACCEPTED, KnowledgeError, MAX_MB, knowledge, uploadDocument } from "@/lib/knowledge"
import type { DocStatus, Health, KChunk, KDocument, KJob, KStats, Passage, QueryResult, SearchResult } from "@/lib/knowledge"

const card = "rounded-2xl border border-line bg-white p-5 sm:p-6"
const input = "min-h-11 w-full rounded-lg border border-[#A9BDB9] bg-white px-3 text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-soft"
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—")
const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)
const errMsg = (e: unknown) => (e instanceof KnowledgeError ? e.message : "Something went wrong. Please try again.")

const STATUS: Record<DocStatus, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  uploaded: { label: "Uploaded", cls: "bg-[#DCE5EC] text-[#27415A]", icon: Clock3 },
  queued: { label: "Queued", cls: "bg-[#F6E9C8] text-[#5A4300]", icon: Clock3 },
  processing: { label: "Processing", cls: "bg-[#DCE6F7] text-[#0B4A63]", icon: Loader2 },
  indexed: { label: "Indexed", cls: "bg-[#D3EBE0] text-[#0B5240]", icon: CheckCircle2 },
  failed: { label: "Failed", cls: "bg-[#F4DAD3] text-[#8A2414]", icon: XCircle },
}

function StatusBadge({ s }: { s: DocStatus }) {
  const { label, cls, icon: Icon } = STATUS[s] ?? STATUS.uploaded
  return <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold " + cls}><Icon aria-hidden="true" className={"size-3.5" + (s === "processing" ? " animate-spin" : "")} />{label}</span>
}

type UploadItem = { key: string; name: string; size: number; pct: number; state: "uploading" | "done" | "error"; message?: string }

export default function Knowledge() {
  const { student } = useAuth()
  const token = student?.token ?? ""
  const admin = isKnowledgeAdmin(student)
  const [health, setHealth] = useState<Health | null>(null)
  const [stats, setStats] = useState<KStats | null>(null)
  const [docs, setDocs] = useState<KDocument[] | null>(null)
  const [loadErr, setLoadErr] = useState("")
  const [filter, setFilter] = useState("")
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [drag, setDrag] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<KDocument | null>(null)
  const [notice, setNotice] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    if (!admin) return
    try {
      const [st, list] = await Promise.all([knowledge.stats(token), knowledge.list(token)])
      setStats(st)
      setDocs(list.documents)
      setLoadErr("")
    } catch (e) {
      setLoadErr(errMsg(e))
    }
  }, [admin, token])

  useEffect(() => {
    if (!admin) return
    let live = true
    Promise.all([knowledge.stats(token), knowledge.list(token)])
      .then(([st, list]) => {
        if (!live) return
        setStats(st)
        setDocs(list.documents)
        setLoadErr("")
      })
      .catch((e) => live && setLoadErr(errMsg(e)))
    knowledge.health().then((h) => live && setHealth(h)).catch(() => live && setHealth(null))
    return () => {
      live = false
    }
  }, [admin, token])

  // Poll while the backend reports work in progress; statuses only change when the server says so.
  const busy = docs?.some((d) => d.processing_status === "queued" || d.processing_status === "processing" || d.processing_status === "uploaded")
  useEffect(() => {
    if (!busy) return
    const t = window.setInterval(() => void refresh(), 2500)
    return () => window.clearInterval(t)
  }, [busy, refresh])

  if (!admin) {
    return (
      <section className={card} aria-labelledby="kn-denied">
        <h1 id="kn-denied" className="text-2xl font-bold text-navy">Synapse Knowledge</h1>
        <p className="mt-2 max-w-[60ch] text-muted-ink">This area is for knowledge administrators. Sign in with an administrator account from Synapse Guard to manage university documents.</p>
      </section>
    )
  }

  const flash = (m: string) => {
    setNotice(m)
    window.setTimeout(() => setNotice(""), 3500)
  }

  const startUploads = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, 10)
    for (const file of list) {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`
      const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
      const base: UploadItem = { key, name: file.name, size: file.size, pct: 0, state: "uploading" }
      if (!["pdf", "docx", "txt"].includes(ext)) {
        setUploads((u) => [{ ...base, state: "error", message: "Only PDF, DOCX and TXT files are supported." }, ...u])
        continue
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        setUploads((u) => [{ ...base, state: "error", message: `Files must be smaller than ${MAX_MB} MB.` }, ...u])
        continue
      }
      setUploads((u) => [base, ...u])
      try {
        await uploadDocument(token, file, (pct) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, pct } : x))))
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, pct: 100, state: "done", message: "Uploaded. Processing status is shown in the library." } : x)))
      } catch (e) {
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, state: "error", message: errMsg(e) } : x)))
      }
      void refresh()
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    if (e.dataTransfer.files.length) void startUploads(e.dataTransfer.files)
  }

  const reprocess = async (d: KDocument) => {
    try {
      await knowledge.reprocess(token, d.id)
      flash(`“${d.display_name}” was queued for processing.`)
    } catch (e) {
      flash(errMsg(e))
    }
    void refresh()
  }

  const doDelete = async () => {
    if (!confirmDel) return
    const d = confirmDel
    setConfirmDel(null)
    try {
      await knowledge.remove(token, d.id)
      flash(`“${d.display_name}” and its indexed passages were deleted.`)
      if (detailId === d.id) setDetailId(null)
    } catch (e) {
      flash(errMsg(e))
    }
    void refresh()
  }

  const f = filter.trim().toLowerCase()
  const shown = (docs ?? []).filter((d) => !f || (d.display_name + " " + d.filename).toLowerCase().includes(f))

  return (
    <div className="grid gap-6">
      <header className={card + " flex flex-wrap items-center justify-between gap-4"}>
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-[14px] bg-[#1e615e] text-white"><Library aria-hidden="true" className="size-5" /></span>
          <div>
            <h1 className="text-2xl font-bold leading-tight text-navy">Synapse Knowledge</h1>
            <p className="text-sm text-muted-ink">Approved university documents that power Synapse Assist answers and citations.</p>
          </div>
        </div>
        <Button variant="outline" className="min-h-11" onClick={() => void refresh()}><RefreshCw className="size-4" />Refresh</Button>
      </header>

      {health && health.status !== "ok" && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-[#E7C66B] bg-[#FBEFD0] px-4 py-3 text-sm text-[#5C4300]">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>
            The knowledge service is running in a degraded state:
            {!health.embedding.configured && " no embedding provider is configured, so documents cannot be indexed."}
            {health.embedding.configured && !health.embedding.index_compatible && " the embedding model changed; the index must be rebuilt."}
            {!health.auth_configured && " authentication is not configured."}
            {health.database !== "ok" && " the database is unavailable."}
          </p>
        </div>
      )}
      {loadErr && <p role="alert" className="rounded-xl border border-[#E8B4A8] bg-[#FBEAE5] px-4 py-3 text-sm font-semibold text-[#8A2414]">{loadErr}</p>}
      {notice && <p role="status" className="rounded-xl border border-line bg-brand-soft px-4 py-3 text-sm font-semibold text-brand">{notice}</p>}

      {/* A. Overview — values come from GET /api/knowledge/stats */}
      <section aria-labelledby="kn-overview">
        <h2 id="kn-overview" className="sr-only">Overview</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            ["Documents", stats?.total_documents],
            ["Indexed", stats?.indexed],
            ["In progress", stats?.processing],
            ["Failed", stats?.failed],
            ["Indexed passages", stats?.indexed_chunks],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-ink">{label}</p>
              <p className="mt-1 text-3xl font-bold text-navy">{stats ? String(value) : "…"}</p>
            </div>
          ))}
          <div className="col-span-2 rounded-2xl border border-line bg-white p-4 md:col-span-1">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-ink">Last indexed</p>
            <p className="mt-2 text-sm font-semibold text-navy">{stats ? fmtDate(stats.last_indexed_at) : "…"}</p>
          </div>
        </div>
      </section>

      {/* B. Upload */}
      <section className={card} aria-labelledby="kn-upload">
        <h2 id="kn-upload" className="text-lg font-bold text-navy">Upload documents</h2>
        <p className="mb-4 text-sm text-muted-ink">PDF, DOCX or TXT, up to {MAX_MB} MB each. Files are validated, text is extracted and indexed automatically. Only upload approved, non-confidential content.</p>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={"flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition " + (drag ? "border-brand bg-brand-soft" : "border-[#A9BDB9] bg-page/60")}
        >
          <UploadCloud aria-hidden="true" className="size-8 text-brand" />
          <p className="font-semibold text-navy">Drag and drop files here</p>
          <Button type="button" className="min-h-11 bg-brand text-white hover:bg-brand-dark" onClick={() => fileRef.current?.click()}>Browse files</Button>
          <input ref={fileRef} type="file" accept={ACCEPTED} multiple className="sr-only" aria-label="Choose documents to upload" onChange={(e) => { if (e.target.files) void startUploads(e.target.files); e.target.value = "" }} />
        </div>
        {uploads.length > 0 && (
          <ul className="mt-4 grid gap-2" aria-live="polite">
            {uploads.slice(0, 8).map((u) => (
              <li key={u.key} className="rounded-lg border border-line px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-semibold text-navy"><FileText aria-hidden="true" className="size-4 shrink-0" /><span className="truncate">{u.name}</span><span className="font-normal text-muted-ink">{fmtSize(u.size)}</span></span>
                  <span className={u.state === "error" ? "font-semibold text-[#8A2414]" : u.state === "done" ? "font-semibold text-[#0B5240]" : "text-muted-ink"}>{u.state === "uploading" ? `${u.pct}%` : u.state === "done" ? "Uploaded" : "Rejected"}</span>
                </div>
                {u.state === "uploading" && <div className="mt-2 h-1.5 overflow-hidden rounded bg-page" role="progressbar" aria-valuenow={u.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${u.name}`}><div className="h-full bg-brand transition-all" style={{ width: `${u.pct}%` }} /></div>}
                {u.message && <p className={"mt-1 text-xs " + (u.state === "error" ? "text-[#8A2414]" : "text-muted-ink")}>{u.message}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* C. Library */}
      <section className={card} aria-labelledby="kn-library">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="kn-library" className="text-lg font-bold text-navy">Document library</h2>
          <label className="relative w-full sm:w-72">
            <span className="sr-only">Search documents</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-ink" />
            <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search documents" className={input + " pl-9"} />
          </label>
        </div>
        {docs === null && !loadErr && <p className="flex items-center gap-2 text-muted-ink"><Loader2 className="size-4 animate-spin" />Loading documents…</p>}
        {docs?.length === 0 && <div className="rounded-xl border border-dashed border-[#A9BDB9] px-4 py-8 text-center text-muted-ink"><Database aria-hidden="true" className="mx-auto mb-2 size-6" />No documents yet. Upload your first approved policy or FAQ above.</div>}
        {docs && docs.length > 0 && shown.length === 0 && <p className="text-muted-ink">No documents match “{filter}”.</p>}
        {shown.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted-ink">
                  <th scope="col" className="py-2 pr-3">Document</th><th scope="col" className="px-3">Type</th><th scope="col" className="px-3">Uploaded</th><th scope="col" className="px-3">By</th><th scope="col" className="px-3">Status</th><th scope="col" className="px-3 text-right">Passages</th><th scope="col" className="pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((d) => (
                  <tr key={d.id} className="border-b border-line/70 align-middle">
                    <td className="max-w-[260px] py-3 pr-3"><p className="truncate font-semibold text-navy">{d.display_name}</p>{d.processing_status === "failed" && d.processing_error && <p className="truncate text-xs text-[#8A2414]" title={d.processing_error}>{d.processing_error}</p>}</td>
                    <td className="px-3 uppercase text-muted-ink">{d.file_type}</td>
                    <td className="whitespace-nowrap px-3 text-muted-ink">{fmtDate(d.created_at)}</td>
                    <td className="px-3 text-muted-ink">{d.uploaded_by_name || d.uploaded_by}</td>
                    <td className="px-3"><StatusBadge s={d.processing_status} /></td>
                    <td className="px-3 text-right font-semibold text-navy">{d.processing_status === "indexed" ? d.chunk_count : "—"}</td>
                    <td className="pl-3">
                      <div className="flex justify-end gap-1">
                        <button className="grid size-11 place-items-center rounded-md text-muted-ink hover:bg-page hover:text-brand" aria-label={`View details: ${d.display_name}`} onClick={() => setDetailId(d.id)}><Eye className="size-4" /></button>
                        <button className="grid size-11 place-items-center rounded-md text-muted-ink hover:bg-page hover:text-brand disabled:opacity-40" aria-label={`${d.processing_status === "failed" ? "Retry" : "Reprocess"}: ${d.display_name}`} disabled={d.processing_status === "queued" || d.processing_status === "processing"} onClick={() => void reprocess(d)}><RefreshCw className="size-4" /></button>
                        <button className="grid size-11 place-items-center rounded-md text-muted-ink hover:bg-[#FBEAE5] hover:text-[#B4281B]" aria-label={`Delete: ${d.display_name}`} onClick={() => setConfirmDel(d)}><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* E. Playground */}
      <Playground token={token} />

      {/* D. Details */}
      <DocumentDetails key={detailId ?? "none"} token={token} id={detailId} onClose={() => setDetailId(null)} />

      <Dialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-navy">Delete this document?</DialogTitle>
            <DialogDescription>“{confirmDel?.display_name}” and all {confirmDel?.chunk_count ?? 0} indexed passages will be removed. Synapse Assist will stop using it immediately. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setConfirmDel(null)}>Cancel</Button>
            <Button className="min-h-11 bg-[#B4281B] text-white hover:bg-[#8A2414]" onClick={() => void doDelete()}>Delete document</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DocumentDetails({ token, id, onClose }: { token: string; id: string | null; onClose: () => void }) {
  const [data, setData] = useState<{ document: KDocument; jobs: KJob[]; chunks: KChunk[] } | null>(null)
  const [err, setErr] = useState("")
  useEffect(() => {
    if (!id) return
    let live = true
    const load = () => knowledge.get(token, id).then((d) => live && setData(d)).catch((e) => live && setErr(errMsg(e)))
    void load()
    const t = window.setInterval(() => void load(), 3000)
    return () => {
      live = false
      window.clearInterval(t)
    }
  }, [id, token])
  const d = data?.document
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-navy">{d?.display_name ?? "Document details"}</DialogTitle>
          <DialogDescription>{d ? d.filename : "Loading…"}</DialogDescription>
        </DialogHeader>
        {err && <p role="alert" className="text-sm font-semibold text-[#8A2414]">{err}</p>}
        {d && (
          <div className="grid gap-5 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {[
                ["Status", <StatusBadge key="s" s={d.processing_status} />],
                ["Type", d.file_type.toUpperCase()],
                ["Size", fmtSize(d.file_size)],
                ["Pages", d.page_count ?? "—"],
                ["Indexed passages", d.chunk_count],
                ["Version", d.version],
                ["Uploaded", fmtDate(d.created_at)],
                ["Uploaded by", d.uploaded_by_name || d.uploaded_by],
                ["Processed", fmtDate(d.processed_at)],
              ].map(([k, v]) => <div key={k as string}><dt className="text-xs font-bold uppercase tracking-wide text-muted-ink">{k}</dt><dd className="mt-0.5 text-navy">{v}</dd></div>)}
              <div className="col-span-2 sm:col-span-3"><dt className="text-xs font-bold uppercase tracking-wide text-muted-ink">Checksum (SHA-256)</dt><dd className="mt-0.5 break-all font-mono text-xs text-navy">{d.checksum}</dd></div>
            </dl>
            {d.processing_error && <p role="alert" className="rounded-lg bg-[#FBEAE5] px-3 py-2 font-semibold text-[#8A2414]">{d.processing_error}</p>}
            <div>
              <h3 className="mb-2 font-bold text-navy">Processing history</h3>
              <ul className="grid gap-1.5">
                {data.jobs.map((j) => (
                  <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                    <span className="capitalize text-navy">{j.trigger}{j.retry_count > 0 ? ` (attempt ${j.retry_count + 1})` : ""}</span>
                    <span className="text-muted-ink">{fmtDate(j.started_at ?? j.created_at)}</span>
                    <span className="font-semibold capitalize">{j.status}</span>
                    {j.error_message && <span className="w-full text-xs text-[#8A2414]">{j.error_message}</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-bold text-navy">Extracted passages {data.chunks.length > 0 && <span className="font-normal text-muted-ink">(first {data.chunks.length} of {d.chunk_count})</span>}</h3>
              {data.chunks.length === 0 && <p className="text-muted-ink">No indexed passages{d.processing_status === "indexed" ? "." : " yet."}</p>}
              <ol className="grid gap-2">
                {data.chunks.map((c) => (
                  <li key={c.id} className="rounded-lg border border-line bg-page/60 p-3">
                    <p className="mb-1 text-xs font-bold text-muted-ink">#{c.chunk_index + 1}{c.page_number ? ` · Page ${c.page_number}${c.page_end && c.page_end !== c.page_number ? `–${c.page_end}` : ""}` : ""}{c.section_heading ? ` · ${c.section_heading}` : ""} · ~{c.token_count} tokens</p>
                    <p className="line-clamp-6 whitespace-pre-line text-ink">{c.content}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PassageCard({ p }: { p: Passage }) {
  return (
    <li className="rounded-lg border border-line p-3 text-sm">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold text-navy"><span className="rounded bg-brand-soft px-1.5 text-xs font-bold text-brand">{p.id}</span>{p.document_name}</span>
        <span className="text-xs font-semibold text-muted-ink">Similarity {p.score.toFixed(3)}</span>
      </div>
      {p.location && <p className="mb-1 text-xs text-muted-ink">{p.location}</p>}
      <p className="whitespace-pre-line text-ink">{p.excerpt}</p>
    </li>
  )
}

function Playground({ token }: { token: string }) {
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [search, setSearch] = useState<SearchResult | null>(null)
  const [answer, setAnswer] = useState<QueryResult | null>(null)
  const run = async (e: FormEvent) => {
    e.preventDefault()
    const query = q.trim()
    if (query.length < 3 || busy) return
    setBusy(true)
    setErr("")
    setSearch(null)
    setAnswer(null)
    try {
      const [s, a] = await Promise.all([knowledge.search(token, query, 6), knowledge.query(token, query)])
      setSearch(s)
      setAnswer(a)
    } catch (e2) {
      setErr(errMsg(e2))
    }
    setBusy(false)
  }
  const ev = search?.evidence
  return (
    <section className={card} aria-labelledby="kn-play">
      <h2 id="kn-play" className="text-lg font-bold text-navy">Knowledge search playground</h2>
      <p className="mb-4 text-sm text-muted-ink">Test what Synapse Assist will retrieve and answer before students rely on it. Uses the same retrieval, safety check and answer generation as Assist.</p>
      <form onSubmit={run} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="kn-q" className="sr-only">Question</label>
        <input id="kn-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={1000} placeholder="e.g. What is the late submission penalty?" className={input} />
        <Button type="submit" disabled={busy || q.trim().length < 3} className="min-h-11 bg-brand text-white hover:bg-brand-dark">{busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}Search</Button>
      </form>
      {err && <p role="alert" className="mt-3 text-sm font-semibold text-[#8A2414]">{err}</p>}
      {answer && (
        <div className="mt-5 rounded-xl border border-line bg-page/60 p-4" aria-live="polite">
          <h3 className="mb-2 flex items-center gap-2 font-bold text-navy"><Sparkles aria-hidden="true" className="size-4" />Grounded answer</h3>
          {answer.status === "escalate" ? (
            <p className="text-ink">Synapse Guard classified this as sensitive (<b>{answer.category}</b>). Assist would hand it to staff instead of answering.</p>
          ) : (
            <>
              <p className={"whitespace-pre-line " + (answer.status === "answered" ? "text-ink" : "font-semibold text-[#5C4300]")}>{answer.answer}</p>
              <p className="mt-2 text-xs text-muted-ink">
                {answer.status === "answered" ? "Answered" : "Insufficient evidence"} · generation: {answer.generation.mode}{answer.generation.model ? ` (${answer.generation.model})` : ""} · evidence: {answer.evidence.level}
              </p>
              {answer.warnings.map((w) => <p key={w} className="mt-1 text-xs font-semibold text-[#5C4300]">{w}</p>)}
              {answer.citations.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-ink">Citations</p>
                  <ul className="grid gap-1 text-sm">{answer.citations.map((c) => <li key={c.id}><span className="mr-1 rounded bg-brand-soft px-1.5 text-xs font-bold text-brand">{c.id}</span><b className="text-navy">{c.document_name}</b>{c.location ? `, ${c.location}` : ""}</li>)}</ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {search && (
        <div className="mt-5">
          <h3 className="mb-1 font-bold text-navy">Retrieved passages</h3>
          <p className="mb-2 text-xs text-muted-ink">Minimum similarity {search.min_score} · evidence {ev?.level}{ev?.top_score != null ? ` (top ${ev.top_score})` : ""}. {ev?.basis}</p>
          {search.results.length === 0 ? <p className="rounded-lg border border-dashed border-[#A9BDB9] px-3 py-4 text-center text-muted-ink">No passage passed the relevance threshold. The knowledge base does not appear to cover this question.</p> : <ol className="grid gap-2">{search.results.map((p) => <PassageCard key={p.chunk_id} p={p} />)}</ol>}
        </div>
      )}
    </section>
  )
}
