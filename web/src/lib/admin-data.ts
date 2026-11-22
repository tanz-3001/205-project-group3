import { useEffect, useState } from "react"
import type { Entry, Req, Status } from "@/lib/app-context"
import { knowledge } from "@/lib/knowledge"

/**
 * Admin data layer.
 *
 * The portal keeps each student's activity in the browser under `synapse:react:v1:<studentId>`
 * (see app-context.tsx). The admin dashboard reads those same records, so everything it shows is
 * real portal data. `readRecords()` is the only function that knows where the data lives: when the
 * portal moves to a database, replace it with a fetch and the rest of the dashboard is unchanged.
 */

const PREFIX = "synapse:react:v1:"
const HOUR = 3_600_000
const DAY = 24 * HOUR
const OUTCOMES: Entry["type"][] = ["answered", "escalated", "unknown"]
const STATUSES: Status[] = ["Waiting for staff", "In progress", "Resolved"]

export const OUTCOME = {
  answered: { label: "Answered", color: "#0b6b63" },
  escalated: { label: "Need a person", color: "#f1bd61" },
  unknown: { label: "Unanswered", color: "#b4281b" },
} as const

export type StudentRecord = { studentId: string; log: Entry[]; requests: Req[]; ratings: boolean[] }
/** A logged question. `request` is the status of the staff request the student raised for it, if any. */
export type Query = Entry & { studentId: string; request: Status | null }
export type AdminReq = Req & { studentId: string }
export type Range = "24h" | "7d" | "30d"
export type Bucket = { start: number; label: string; full: string; answered: number; escalated: number; unknown: number }
export type Metrics = {
  total: number
  answered: number
  escalated: number
  unanswered: number
  last24h: number
  activeStudents: number
  answeredShare: number | null
  helpful: { yes: number; total: number; share: number | null }
  requests: { total: number; open: number; resolved: number; resolvedShare: number | null; openList: AdminReq[]; allList: AdminReq[] }
  topics: { tag: string; count: number }[]
  response: { n: number; avg: number | null; median: number | null; max: number | null; underSecondShare: number | null; byChannel: { via: "ask" | "assist"; n: number; avg: number }[] }
  queries: Query[]
  unansweredList: Query[]
  series: Bucket[]
}

const arr = <T,>(v: unknown, ok: (x: unknown) => x is T): T[] => (Array.isArray(v) ? v.filter(ok) : [])
const isEntry = (x: unknown): x is Entry => {
  const e = x as Entry
  return !!e && typeof e.q === "string" && typeof e.tag === "string" && Number.isFinite(e.at) && OUTCOMES.includes(e.type)
}
const isReq = (x: unknown): x is Req => {
  const r = x as Req
  return !!r && typeof r.q === "string" && typeof r.tag === "string" && Number.isFinite(r.at) && Number.isFinite(r.id) && STATUSES.includes(r.status)
}

/** Reads every student's saved portal data. */
export function readRecords(): StudentRecord[] {
  const out: StudentRecord[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(PREFIX)) continue
      try {
        const s = JSON.parse(localStorage.getItem(key) ?? "null") as Record<string, unknown> | null
        if (!s || typeof s !== "object") continue
        out.push({
          studentId: key.slice(PREFIX.length),
          log: arr(s.log, isEntry),
          requests: arr(s.requests, isReq),
          ratings: arr(s.ratings, (x): x is boolean => typeof x === "boolean"),
        })
      } catch {
        /* skip a corrupt record */
      }
    }
  } catch {
    /* storage unavailable */
  }
  return out
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function buckets(range: Range, now: number): Bucket[] {
  const out: Bucket[] = []
  if (range === "24h") {
    const end = new Date(now)
    end.setMinutes(0, 0, 0)
    for (let i = 23; i >= 0; i--) {
      const d = new Date(end.getTime() - i * HOUR)
      out.push({ start: d.getTime(), label: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }), full: d.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }), answered: 0, escalated: 0, unknown: 0 })
    }
  } else {
    const n = range === "7d" ? 7 : 30
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      out.push({
        start: d.getTime(),
        label: range === "7d" ? d.toLocaleDateString([], { weekday: "short", day: "numeric" }) : d.toLocaleDateString([], { day: "numeric", month: "short" }),
        full: d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }),
        answered: 0,
        escalated: 0,
        unknown: 0,
      })
    }
  }
  return out
}

export function computeMetrics(records: StudentRecord[], range: Range, now: number): Metrics {
  // Join each question that was not answered to the staff request the same student raised for it.
  const queries = records
    .flatMap((rec) => {
      const used = new Set<number>()
      const reqs = [...rec.requests].sort((a, b) => a.at - b.at)
      return [...rec.log]
        .sort((a, b) => a.at - b.at)
        .map<Query>((e) => {
          let request: Status | null = null
          if (e.type !== "answered") {
            const m = reqs.find((r) => !used.has(r.id) && r.at >= e.at - 2000 && (r.q === e.q || r.q.startsWith(e.q + " - ")))
            if (m) {
              used.add(m.id)
              request = m.status
            }
          }
          return { ...e, studentId: rec.studentId, request }
        })
    })
    .sort((a, b) => b.at - a.at)

  const count = (t: Entry["type"]) => queries.filter((q) => q.type === t).length
  const total = queries.length
  const answered = count("answered")

  const ratings = records.flatMap((r) => r.ratings)
  const yes = ratings.filter(Boolean).length

  const reqs: AdminReq[] = records.flatMap((r) => r.requests.map((q) => ({ ...q, studentId: r.studentId })))
  const openList = reqs.filter((r) => r.status !== "Resolved").sort((a, b) => a.at - b.at)
  const resolvedList = reqs.filter((r) => r.status === "Resolved").sort((a, b) => b.at - a.at)
  const allList = [...openList, ...resolvedList]

  const tally = new Map<string, number>()
  queries.forEach((q) => {
    if (q.type !== "unknown") tally.set(q.tag, (tally.get(q.tag) ?? 0) + 1)
  })

  const timed = queries.filter((q): q is Query & { ms: number } => typeof q.ms === "number" && q.ms >= 0)
  const times = timed.map((q) => q.ms)
  const byChannel = (["ask", "assist"] as const).flatMap((via) => {
    const xs = timed.filter((q) => q.via === via).map((q) => q.ms)
    return xs.length ? [{ via, n: xs.length, avg: sum(xs) / xs.length }] : []
  })

  const series = buckets(range, now)
  const end = series[series.length - 1].start + (range === "24h" ? HOUR : DAY + HOUR) // +1h slack for DST days
  queries.forEach((q) => {
    if (q.at < series[0].start || q.at >= end) return
    let i = series.length - 1
    while (i > 0 && series[i].start > q.at) i--
    series[i][q.type]++
  })

  return {
    total,
    answered,
    escalated: count("escalated"),
    unanswered: count("unknown"),
    last24h: queries.filter((q) => q.at >= now - DAY).length,
    activeStudents: new Set(queries.map((q) => q.studentId)).size,
    answeredShare: total ? answered / total : null,
    helpful: { yes, total: ratings.length, share: ratings.length ? yes / ratings.length : null },
    requests: {
      total: reqs.length,
      open: openList.length,
      resolved: reqs.length - openList.length,
      resolvedShare: reqs.length ? (reqs.length - openList.length) / reqs.length : null,
      openList,
      allList,
    },
    topics: [...tally].map(([tag, c]) => ({ tag, count: c })).sort((a, b) => b.count - a.count),
    response: {
      n: times.length,
      avg: times.length ? sum(times) / times.length : null,
      median: times.length ? median(times) : null,
      max: times.length ? Math.max(...times) : null,
      underSecondShare: times.length ? times.filter((t) => t < 1000).length / times.length : null,
      byChannel,
    },
    queries,
    unansweredList: queries.filter((q) => q.type === "unknown").slice(0, 8),
    series,
  }
}

function mergeStudentRecords(local: StudentRecord[], remote: StudentRecord[]): StudentRecord[] {
  const byStudent = new Map<string, StudentRecord>()
  for (const r of local) byStudent.set(r.studentId, r)
  for (const rem of remote) {
    const loc = byStudent.get(rem.studentId)
    if (!loc) {
      byStudent.set(rem.studentId, rem)
      continue
    }
    const logKeys = new Set(loc.log.map((e) => `${e.at}:${e.q}`))
    const mergedLog = [...loc.log, ...rem.log.filter((e) => !logKeys.has(`${e.at}:${e.q}`))].sort((a, b) => a.at - b.at)
    const reqById = new Map<number, Req>()
    for (const q of loc.requests) reqById.set(q.id, q)
    for (const q of rem.requests) {
      const prev = reqById.get(q.id)
      if (!prev) {
        reqById.set(q.id, q)
      } else {
        const remStaff = q.staff_updated_at ?? 0
        const locStaff = prev.staff_updated_at ?? 0
        reqById.set(q.id, remStaff >= locStaff ? { ...prev, ...q, transcript: q.transcript ?? prev.transcript } : { ...q, ...prev, transcript: prev.transcript ?? q.transcript })
      }
    }
    byStudent.set(rem.studentId, {
      studentId: rem.studentId,
      log: mergedLog,
      requests: [...reqById.values()].sort((a, b) => a.at - b.at),
      ratings: loc.ratings.length >= rem.ratings.length ? loc.ratings : rem.ratings,
    })
  }
  return [...byStudent.values()]
}

/**
 * Update a student request's status ('Waiting for staff', 'In progress', 'Resolved') and staff reply.
 * Persists both to localStorage (so same-browser student tabs update immediately) and to the backend database.
 */
export async function updateStudentRequest(
  studentId: string,
  requestId: number,
  patch: { status: Status; reply?: string },
  adminToken?: string,
  fallbackSnapshot?: AdminReq,
): Promise<void> {
  const key = PREFIX + studentId
  const replyClean = patch.reply?.trim() ?? ""
  const staffAt = Date.now()
  let snapshot: Req | undefined = fallbackSnapshot
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : { requests: [], log: [], ratings: [], chats: [] }
    const reqs = arr(parsed.requests, isReq)
    let found = false
    const updated = reqs.map((r) => {
      if (r.id !== requestId) return r
      found = true
      const next: Req = { ...r, status: patch.status, staff_updated_at: staffAt }
      if (replyClean) next.reply = replyClean
      else delete next.reply
      snapshot = next
      return next
    })
    if (!found && fallbackSnapshot) {
      const { studentId: _sid, ...rest } = fallbackSnapshot
      void _sid
      const next: Req = { ...rest, status: patch.status, staff_updated_at: staffAt }
      if (replyClean) next.reply = replyClean
      else delete next.reply
      updated.push(next)
      snapshot = next
    }
    localStorage.setItem(key, JSON.stringify({ ...parsed, requests: updated }))
  } catch {
    /* ignore localStorage failure */
  }
  window.dispatchEvent(new CustomEvent("synapse:portal-updated"))

  if (adminToken) {
    try {
      await knowledge.updatePortalRequest(adminToken, studentId, requestId, {
        status: patch.status,
        reply: replyClean,
        request_snapshot: snapshot,
      })
    } catch {
      /* backend unreachable: localStorage update already applied */
    }
  }
  window.dispatchEvent(new CustomEvent("synapse:portal-updated"))
}

/**
 * Live snapshot of all portal data. When a student saves anything in another tab, the browser fires a
 * `storage` event here and the dashboard recomputes straight away. Also syncs from the backend database.
 */
export function useAdminData(adminToken?: string) {
  const [remote, setRemote] = useState<StudentRecord[]>([])
  const [snap, setSnap] = useState(() => ({ records: readRecords(), at: Date.now(), changedAt: 0 }))

  useEffect(() => {
    const refresh = (changed = false) =>
      setSnap((p) => ({
        records: mergeStudentRecords(readRecords(), remote),
        at: Date.now(),
        changedAt: changed ? Date.now() : p.changedAt,
      }))
    const pullRemote = () => {
      if (!adminToken) return
      knowledge
        .listPortalRecords(adminToken)
        .then((res) => {
          const parsed: StudentRecord[] = (res.records ?? []).map((r) => ({
            studentId: r.studentId,
            log: arr(r.log, isEntry),
            requests: arr(r.requests, isReq),
            ratings: arr(r.ratings, (x): x is boolean => typeof x === "boolean"),
          }))
          setRemote(parsed)
        })
        .catch(() => {
          /* ignore */
        })
    }
    refresh()
    pullRemote()
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.startsWith(PREFIX)) refresh(true)
    }
    const onCustom = () => {
      refresh(true)
      pullRemote()
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refresh()
        pullRemote()
      }
    }
    const timer = window.setInterval(() => {
      refresh()
      pullRemote()
    }, 15_000)
    window.addEventListener("storage", onStorage)
    window.addEventListener("synapse:portal-updated", onCustom)
    window.addEventListener("focus", onVisible)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("synapse:portal-updated", onCustom)
      window.removeEventListener("focus", onVisible)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [adminToken, remote])
  return { ...snap, records: mergeStudentRecords(readRecords(), remote) }
}

export const fmtMs = (ms: number | null) => (ms === null ? "-" : ms < 1 ? "<1 ms" : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`)
export const fmtPct = (v: number | null) => (v === null ? "-" : `${Math.round(v * 100)}%`)
export function span(ms: number) {
  const m = Math.floor(ms / 60_000)
  if (m < 1) return "under a minute"
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h} h` : `${Math.floor(h / 24)} d`
}
export const ago = (at: number, now: number) => (now - at < 60_000 ? "just now" : span(now - at) + " ago")
export const stamp = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " · " + new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
