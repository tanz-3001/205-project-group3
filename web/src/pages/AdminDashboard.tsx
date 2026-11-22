import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import ActivityChart from "@/components/ActivityChart"
import AdminTopBar from "@/components/AdminTopBar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import type { Status } from "@/lib/app-context"
import type { Admin } from "@/lib/auth"
import { OUTCOME, ago, computeMetrics, fmtMs, fmtPct, span, stamp, updateStudentRequest, useAdminData } from "@/lib/admin-data"
import type { AdminReq, Query, Range } from "@/lib/admin-data"
import { TINTS } from "@/lib/data"

const REQ_STATUSES: Status[] = ["Waiting for staff", "In progress", "Resolved"]

const label = (t: string) => (t === "IT" ? "IT Support" : t)
const RANGES: { id: Range; text: string }[] = [
  { id: "24h", text: "24 hours" },
  { id: "7d", text: "7 days" },
  { id: "30d", text: "30 days" },
]
const FILTERS = [{ id: "all", text: "All" }, { id: "answered", text: "Answered" }, { id: "escalated", text: "Need a person" }, { id: "unknown", text: "Unanswered" }] as const
const BADGE = { answered: ["#ddf0ec", "#0b6b63"], escalated: ["#FBEFD0", "#5C4300"], unknown: ["#F4DAD3", "#6A2B1A"] } as const

function Panel({ title, note, aside, children, className = "" }: { title: string; note?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={"min-w-0 rounded-xl border border-line bg-white p-5 sm:p-6 " + className}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-navy">{title}</h2>
          {note && <p className="mt-0.5 text-sm text-muted-ink">{note}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Stat({ value, name, sub, color }: { value: string | number; name: string; sub: string; color?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-5 py-5">
      <p className="text-[2.6rem] font-bold leading-none tracking-tight text-brand tabular-nums">{value}</p>
      <p className="mt-3 flex items-center gap-2 font-medium text-navy">{color && <i aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: color }} />}{name}</p>
      <p className="mt-0.5 text-xs text-muted-ink">{sub}</p>
    </div>
  )
}

function Meter({ name, value, hint }: { name: string; value: number | null; hint: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3"><span className="font-medium text-navy">{name}</span><b className="tabular-nums text-brand">{fmtPct(value)}</b></div>
      <div role="meter" aria-label={name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((value ?? 0) * 100)} className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#e3ebe8]">
        <div className="h-full rounded-full bg-brand transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${(value ?? 0) * 100}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-ink">{hint}</p>
    </div>
  )
}

function Topic({ tag }: { tag: string }) {
  const t = TINTS[tag] ?? ["#E6E9EF", "#1A2233"]
  return <span className="inline-block whitespace-nowrap rounded-md px-2.5 py-0.5 text-[0.78rem] font-bold" style={{ background: t[0], color: t[1] }}>{label(tag)}</span>
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-muted-ink">{children}</p>
}

function QueryStatus({ q }: { q: Query }) {
  const b = BADGE[q.type]
  return (
    <div className="grid gap-0.5">
      <span className="inline-block w-fit whitespace-nowrap rounded-md px-2.5 py-0.5 text-[0.78rem] font-bold" style={{ background: b[0], color: b[1] }}>{OUTCOME[q.type].label}</span>
      {q.type !== "answered" && <span className="text-xs text-muted-ink">{q.request ? `Request: ${q.request}` : "No request sent"}</span>}
    </div>
  )
}

export default function AdminDashboard({ admin }: { admin: Admin }) {
  const { records, at, changedAt } = useAdminData(admin.token)
  const [range, setRange] = useState<Range>("7d")
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all")
  const [reqFilter, setReqFilter] = useState<"open" | "all">("open")
  const [activeReq, setActiveReq] = useState<AdminReq | null>(null)
  const [notice, setNotice] = useState("")
  const [shown, setShown] = useState(10)
  const m = useMemo(() => computeMetrics(records, range, at), [records, range, at])

  const rows = m.queries.filter((q) => filter === "all" || q.type === filter)
  const topMax = Math.max(...m.topics.map((t) => t.count), 1)
  const r = m.response
  const updated = new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })

  return (
    <div className="app-canvas min-h-screen bg-page text-ink">
      <AdminTopBar admin={admin} />
      <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-8 sm:px-7 lg:px-10 lg:pt-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">Admin dashboard</h1>
            <p className="mt-1 max-w-[62ch] text-muted-ink">What students are asking, how the portal is answering, and where people need help.</p>
          </div>
          <p key={changedAt} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-muted-ink animate-in fade-in duration-700 motion-reduce:animate-none">
            <i aria-hidden="true" className="size-2 rounded-full bg-[#2f9e6b] shadow-[0_0_0_3px_rgba(47,158,107,0.15)]" />
            Live · updated {updated}
          </p>
        </div>
        <p role="status" className="sr-only">{m.total} questions recorded from {m.activeStudents} students.</p>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat value={m.total} name="Questions" sub={`${m.last24h} in the last 24 hours`} />
          <Stat value={m.answered} name="Answered" color={OUTCOME.answered.color} sub={m.total ? `${fmtPct(m.answeredShare)} handled without staff` : "Handled without staff"} />
          <Stat value={m.unanswered} name="Unanswered" color={OUTCOME.unknown.color} sub="No matching answer found" />
          <Stat value={m.escalated} name="Need a person" color={OUTCOME.escalated.color} sub={`${m.requests.open} open ${m.requests.open === 1 ? "request" : "requests"}`} />
          <Stat value={fmtMs(r.avg)} name="Average response time" sub={r.n ? `Across ${r.n} timed ${r.n === 1 ? "answer" : "answers"}` : "No timed answers yet"} />
          <Stat value={fmtPct(m.helpful.share)} name="Found it helpful" sub={`${m.helpful.total} ${m.helpful.total === 1 ? "rating" : "ratings"}, all time`} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panel
            title="Query activity"
            note={`Questions per ${range === "24h" ? "hour" : "day"}, by outcome`}
            aside={
              <div role="group" aria-label="Time range" className="inline-flex rounded-xl border border-line bg-page p-1">
                {RANGES.map((x) => (
                  <button key={x.id} type="button" aria-pressed={range === x.id} onClick={() => setRange(x.id)} className={"min-h-9 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand " + (range === x.id ? "bg-brand text-white" : "text-muted-ink hover:text-brand")}>{x.text}</button>
                ))}
              </div>
            }
          >
            <ActivityChart data={m.series} range={range} />
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-ink">
              {(Object.keys(OUTCOME) as (keyof typeof OUTCOME)[]).map((k) => <li key={k} className="inline-flex items-center gap-2"><i aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: OUTCOME[k].color }} />{OUTCOME[k].label}</li>)}
            </ul>
          </Panel>

          <Panel title="Outcomes" note={`${m.activeStudents} ${m.activeStudents === 1 ? "student has" : "students have"} asked a question`}>
            {m.total === 0 ? (
              <Empty>Outcomes appear once students start asking questions.</Empty>
            ) : (
              <>
                <div role="img" aria-label={`${m.answered} answered, ${m.escalated} need a person, ${m.unanswered} unanswered`} className="flex h-3 overflow-hidden rounded-full bg-[#e3ebe8]">
                  {(["answered", "escalated", "unknown"] as const).map((k) => {
                    const n = k === "answered" ? m.answered : k === "escalated" ? m.escalated : m.unanswered
                    return <span key={k} className="h-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${(n / m.total) * 100}%`, background: OUTCOME[k].color }} />
                  })}
                </div>
                <ul className="mt-5 grid gap-3">
                  {(["answered", "escalated", "unknown"] as const).map((k) => {
                    const n = k === "answered" ? m.answered : k === "escalated" ? m.escalated : m.unanswered
                    return (
                      <li key={k} className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2 font-medium text-navy"><i aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: OUTCOME[k].color }} />{OUTCOME[k].label}</span>
                        <span className="tabular-nums text-muted-ink"><b className="text-ink">{n}</b> · {fmtPct(n / m.total)}</span>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </Panel>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Top topics">
            {m.topics.length === 0 ? (
              <Empty>Ask a few questions to see topics.</Empty>
            ) : (
              <ul className="grid gap-3">
                {m.topics.slice(0, 8).map((t) => (
                  <li key={t.tag} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_2rem] items-center gap-3">
                    <span className="truncate text-navy">{label(t.tag)}</span>
                    <span className="h-3 overflow-hidden rounded-full bg-[#e3ebe8]"><span className="block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${(t.count / topMax) * 100}%`, background: TINTS[t.tag]?.[1] ?? "#0b3c49" }} /></span>
                    <b className="text-right tabular-nums text-navy">{t.count}</b>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="System performance" note="How well the portal answers without staff">
            <div className="grid gap-4">
              <Meter name="Handled without staff" value={m.answeredShare} hint={`${m.answered} of ${m.total} questions answered by the portal`} />
              <Meter name="Found it helpful" value={m.helpful.share} hint={`${m.helpful.yes} of ${m.helpful.total} ${m.helpful.total === 1 ? "rating was" : "ratings were"} positive`} />
              <Meter name="Answered in under 1 second" value={r.underSecondShare} hint={r.n ? `${r.n} timed ${r.n === 1 ? "response" : "responses"}` : "Appears after the next question is asked"} />
              <Meter name="Staff requests resolved" value={m.requests.resolvedShare} hint={`${m.requests.resolved} of ${m.requests.total} ${m.requests.total === 1 ? "request" : "requests"}, ${m.requests.open} still open`} />
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
              {[["Average", r.avg], ["Median", r.median], ["Slowest", r.max]].map(([k, v]) => (
                <div key={k as string}><dt className="text-muted-ink">{k as string}</dt><dd className="mt-0.5 text-lg font-semibold tabular-nums text-navy">{fmtMs(v as number | null)}</dd></div>
              ))}
            </dl>
            {r.byChannel.length > 0 && (
              <ul className="mt-3 grid gap-1 text-sm text-muted-ink">
                {r.byChannel.map((c) => <li key={c.via} className="flex justify-between gap-3"><span>{c.via === "assist" ? "Synapse Assist" : "Overview search"}</span><span className="tabular-nums"><b className="text-ink">{fmtMs(c.avg)}</b> average · {c.n} {c.n === 1 ? "answer" : "answers"}</span></li>)}
              </ul>
            )}
          </Panel>
        </div>

        <Panel
          className="mt-4"
          title="Recent student queries"
          note="Newest first, with the outcome of each question"
          aside={
            <div role="group" aria-label="Filter by outcome" className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-page p-1">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => { setFilter(f.id); setShown(10) }} className={"min-h-9 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand " + (filter === f.id ? "bg-brand text-white" : "text-muted-ink hover:text-brand")}>{f.text}</button>
              ))}
            </div>
          }
        >
          {rows.length === 0 ? (
            <Empty>{m.total === 0 ? "No questions yet. They appear here as students ask them." : "No questions with this outcome."}</Empty>
          ) : (
            <>
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-muted-ink">
                      {["When", "Student", "Question", "Topic", "Status", "Response"].map((h) => <th key={h} scope="col" className="py-2 pr-4 font-semibold">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, shown).map((q) => (
                      <tr key={q.studentId + q.at + q.q} className="border-b border-line/70 align-top last:border-0">
                        <td className="whitespace-nowrap py-3 pr-4 text-muted-ink"><time dateTime={new Date(q.at).toISOString()} title={stamp(q.at)}>{ago(q.at, at)}</time></td>
                        <td className="whitespace-nowrap py-3 pr-4 font-medium tabular-nums text-navy">{q.studentId}</td>
                        <td className="max-w-[34ch] py-3 pr-4 text-ink">{q.q}</td>
                        <td className="py-3 pr-4"><Topic tag={q.tag} /></td>
                        <td className="py-3 pr-4"><QueryStatus q={q} /></td>
                        <td className="whitespace-nowrap py-3 tabular-nums text-muted-ink">{fmtMs(typeof q.ms === "number" ? q.ms : null)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > shown && <button type="button" onClick={() => setShown((n) => n + 10)} className="mt-3 min-h-10 rounded-xl border border-line px-4 text-sm font-semibold text-navy hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Show more ({rows.length - shown} left)</button>}
            </>
          )}
        </Panel>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Unanswered questions" note="No matching official answer was found">
            {m.unansweredList.length === 0 ? (
              <Empty>None so far.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {m.unansweredList.map((q) => (
                  <li key={q.studentId + q.at + q.q} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-ink">{q.q}</p>
                    <p className="mt-0.5 text-xs text-muted-ink">{q.studentId} · {ago(q.at, at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title={`Staff requests${m.requests.open ? ` (${m.requests.open} open)` : ""}`}
            note="Manage escalated requests, read transcripts, update status and send replies"
            aside={
              <div role="group" aria-label="Filter requests" className="inline-flex rounded-xl border border-line bg-page p-1">
                {([["open", `Open (${m.requests.open})`], ["all", `All (${m.requests.total})`]] as const).map(([id, txt]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={reqFilter === id}
                    onClick={() => setReqFilter(id)}
                    className={"min-h-9 rounded-lg px-3 text-xs font-semibold transition-colors " + (reqFilter === id ? "bg-brand text-white" : "text-muted-ink hover:text-brand")}
                  >
                    {txt}
                  </button>
                ))}
              </div>
            }
          >
            {notice && <p role="status" className="mb-3 rounded-lg bg-brand-soft px-3 py-2 text-xs font-semibold text-brand">{notice}</p>}
            {(reqFilter === "open" ? m.requests.openList : m.requests.allList).length === 0 ? (
              <Empty>{reqFilter === "open" ? "No open requests." : "No requests submitted yet."}</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {(reqFilter === "open" ? m.requests.openList : m.requests.allList).slice(0, 12).map((q) => (
                  <li key={q.studentId + q.id} className="flex flex-wrap items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Topic tag={q.tag} />
                        <span className="text-xs font-semibold text-navy">{q.studentId}</span>
                        <span className="text-xs text-muted-ink">· #{q.id} · sent {stamp(q.at)}</span>
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-ink">{q.q}</p>
                      {q.reply && (
                        <p className="mt-1 rounded-md border border-line bg-page px-2.5 py-1 text-xs text-muted-ink">
                          <b className="text-navy">Reply:</b> {q.reply}
                        </p>
                      )}
                      {q.transcript && q.transcript.length > 0 && (
                        <details className="mt-2 rounded-lg border border-dashed border-[#A9BDB9] bg-page/60 text-xs">
                          <summary className="cursor-pointer px-3 py-1.5 font-semibold text-brand hover:underline">
                            Shared conversation transcript ({q.transcript.length} {q.transcript.length === 1 ? "line" : "lines"})
                          </summary>
                          <div className="max-h-48 overflow-y-auto border-t border-line px-3 py-2 space-y-1 text-ink">
                            {q.transcript.map((line, idx) => (
                              <p key={idx} className="leading-relaxed">{line}</p>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2 text-right text-xs">
                      <div>
                        <p className={"font-semibold " + (q.status === "Resolved" ? "text-brand" : "text-navy")}>{q.status}</p>
                        <p className="text-muted-ink">{q.status === "Resolved" ? "completed" : `waiting ${span(at - q.at)}`}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-9 px-3 text-xs font-semibold"
                        onClick={() => setActiveReq(q)}
                      >
                        {q.status === "Resolved" ? "Reopen / Edit" : "Manage"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <ManageRequestDialog
          key={activeReq ? `${activeReq.studentId}-${activeReq.id}-${activeReq.status}` : "closed"}
          req={activeReq}
          adminToken={admin.token}
          onClose={() => setActiveReq(null)}
          onSaved={(msg) => {
            setActiveReq(null)
            setNotice(msg)
            window.setTimeout(() => setNotice(""), 3500)
          }}
        />

        <p className="mt-8 border-t border-line/80 pt-4 text-xs text-muted-ink">Synapse admin <span className="px-1.5 text-brand/70">/</span> Built from student activity saved by the portal. Response times are measured from the moment a question is submitted until an answer is shown.</p>
      </main>
    </div>
  )
}

function ManageRequestDialog({
  req,
  adminToken,
  onClose,
  onSaved,
}: {
  req: AdminReq | null
  adminToken?: string
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const [status, setStatus] = useState<Status>(req?.status ?? "Waiting for staff")
  const [reply, setReply] = useState<string>(req?.reply ?? "")
  const [saving, setSaving] = useState(false)

  if (!req) return null

  const save = async () => {
    if (saving) return
    setSaving(true)
    await updateStudentRequest(req.studentId, req.id, { status, reply }, adminToken, req)
    setSaving(false)
    onSaved(`Updated request #${req.id} (${req.studentId}) to "${status}".`)
  }

  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-navy">Manage staff request</DialogTitle>
          <DialogDescription>
            Student <b>{req.studentId}</b> · Request #{req.id} · Sent {stamp(req.at)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 text-sm">
          <div className="rounded-xl border border-line bg-page/70 p-3.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <Topic tag={req.tag} />
              <span className="text-xs font-semibold text-muted-ink">Current: {req.status}</span>
            </div>
            <p className="mt-1 font-medium text-navy">{req.q}</p>
          </div>

          {req.transcript && req.transcript.length > 0 ? (
            <details open className="rounded-xl border border-dashed border-[#A9BDB9] bg-page/60">
              <summary className="cursor-pointer px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-brand">
                Shared student conversation transcript ({req.transcript.length} {req.transcript.length === 1 ? "message" : "messages"})
              </summary>
              <div className="max-h-48 space-y-1.5 overflow-y-auto border-t border-line px-3.5 py-2.5 text-xs text-ink">
                {req.transcript.map((line, i) => (
                  <p key={i} className="leading-relaxed">{line}</p>
                ))}
              </div>
            </details>
          ) : (
            <p className="text-xs text-muted-ink">No conversation transcript was attached to this request.</p>
          )}

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-ink">Request status</p>
            <div role="group" aria-label="Request status" className="grid grid-cols-3 gap-2">
              {REQ_STATUSES.map((st) => (
                <button
                  key={st}
                  type="button"
                  aria-pressed={status === st}
                  onClick={() => setStatus(st)}
                  className={
                    "min-h-11 rounded-xl border px-3 text-xs font-bold transition " +
                    (status === st ? "border-brand bg-brand text-white" : "border-line bg-white text-navy hover:border-brand")
                  }
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="staff-reply-input" className="text-xs font-bold uppercase tracking-wide text-muted-ink">
              Staff reply (visible to student in My requests)
            </label>
            <Textarea
              id="staff-reply-input"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a helpful reply or next steps for the student…"
              className="min-h-28"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} className="min-h-11 bg-brand text-white hover:bg-brand-dark" onClick={() => void save()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
