import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { Citation } from "./assist"
import { useAuth } from "./auth"
import { knowledge } from "./knowledge"

export type Status = "Waiting for staff" | "In progress" | "Resolved"
export type Req = { id: number; q: string; tag: string; at: number; status: Status; reply?: string; transcript?: string[]; staff_updated_at?: number }
export type Entry = { q: string; tag: string; type: "answered" | "escalated" | "unknown"; at: number; /** how long the portal took to respond, in ms */ ms?: number; /** where the question was asked */ via?: "ask" | "assist" }
export type Msg = { r: "u" | "a"; t: string; k?: "answer" | "escalate"; src?: string[]; cites?: Citation[]; category?: string; urgent?: boolean; unknown?: boolean; conversational?: boolean; suggestions?: string[] }
export type Chat = { id: number; title: string; at: number; msgs: Msg[] }
type State = { requests: Req[]; log: Entry[]; ratings: boolean[]; chats: Chat[] }
type Ctx = State & {
  activeChatId: number | null
  setActiveChatId: (id: number | null) => void
  pendingPrompt: string | null
  setPendingPrompt: (q: string | null) => void
  addRequest: (q: string, tag: string, transcript?: string[]) => void
  addEntry: (e: Omit<Entry, "at">) => void
  rate: (v: boolean) => void
  saveChat: (c: Chat) => void
  deleteChat: (id: number) => void
  reset: () => void
}

const empty: State = { requests: [], log: [], ratings: [], chats: [] }
const keyFor = (studentId: string) => `synapse:react:v1:${studentId}`

function load(key: string): State {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return { ...empty, ...(JSON.parse(raw) as Partial<State>) }
  } catch {
    /* ignore */
  }
  return empty
}

function mergeRequests(localReqs: Req[], remoteReqs: Req[]): Req[] {
  const byId = new Map<number, Req>()
  for (const r of localReqs) byId.set(r.id, r)
  for (const r of remoteReqs) {
    if (!r || typeof r.id !== "number") continue
    const prev = byId.get(r.id)
    if (!prev) {
      byId.set(r.id, r)
      continue
    }
    const remoteStaffAt = r.staff_updated_at ?? 0
    const localStaffAt = prev.staff_updated_at ?? 0
    const useRemoteStaff = remoteStaffAt >= localStaffAt && (r.status !== prev.status || r.reply !== prev.reply)
    byId.set(r.id, {
      ...prev,
      status: useRemoteStaff ? r.status : prev.status,
      reply: useRemoteStaff ? r.reply : prev.reply,
      staff_updated_at: Math.max(remoteStaffAt, localStaffAt) || undefined,
      // Keep the full local transcript on the student's own device so localStorage admin views also have it
      transcript: prev.transcript ?? r.transcript,
    })
  }
  return [...byId.values()].sort((a, b) => a.at - b.at)
}

function mergePortalState(local: State, remote: Partial<State>): State {
  const logMap = new Map<string, Entry>()
  for (const e of local.log) logMap.set(`${e.at}:${e.q}`, e)
  for (const e of remote.log ?? []) {
    if (e && typeof e.q === "string" && typeof e.at === "number" && !logMap.has(`${e.at}:${e.q}`)) {
      logMap.set(`${e.at}:${e.q}`, e)
    }
  }
  const chatMap = new Map<number, Chat>()
  for (const c of local.chats) chatMap.set(c.id, c)
  for (const c of remote.chats ?? []) {
    if (!c || typeof c.id !== "number") continue
    const prev = chatMap.get(c.id)
    if (!prev || (c.msgs?.length ?? 0) > (prev.msgs?.length ?? 0)) {
      chatMap.set(c.id, c)
    }
  }
  const remoteRatings = Array.isArray(remote.ratings) ? remote.ratings : []
  return {
    log: [...logMap.values()].sort((a, b) => a.at - b.at),
    requests: mergeRequests(local.requests, (remote.requests ?? []) as Req[]),
    ratings: local.ratings.length >= remoteRatings.length ? local.ratings : remoteRatings,
    chats: [...chatMap.values()].sort((a, b) => a.at - b.at),
  }
}

const AppCtx = createContext<Ctx | null>(null)

/** Data is stored per student in localStorage and synced with the backend database when authenticated. */
export function AppProvider({ children, studentId }: { children: ReactNode; studentId: string }) {
  const key = keyFor(studentId)
  const { student } = useAuth()
  const token = student?.token
  const [s, setS] = useState<State>(() => load(key))
  const [activeChatId, setActiveChatId] = useState<number | null>(null)
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  const skipNextPush = useRef(false)
  const initialPullDone = useRef(false)

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(s))
    } catch {
      /* ignore */
    }
  }, [s, key])

  // Listen for staff updates written to localStorage from the Admin Dashboard (same tab or another tab).
  useEffect(() => {
    const reloadFromStorage = () => {
      const next = load(key)
      setS((prev) => {
        if (JSON.stringify(prev.requests) === JSON.stringify(next.requests)) return prev
        skipNextPush.current = true
        return { ...prev, requests: next.requests }
      })
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === key) reloadFromStorage()
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", reloadFromStorage)
    window.addEventListener("synapse:portal-updated", reloadFromStorage)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", reloadFromStorage)
      window.removeEventListener("synapse:portal-updated", reloadFromStorage)
    }
  }, [key])

  // Pull persisted state (requests, replies, conversations, log, ratings) from the backend database on mount and periodically.
  useEffect(() => {
    if (!token) return
    let live = true
    const pull = (isInitial = false) => {
      knowledge
        .getPortalState(token, studentId)
        .then((res) => {
          if (!live) return
          if (res.exists) {
            setS((prev) => {
              const merged = mergePortalState(prev, {
                log: (res.log ?? []) as Entry[],
                requests: (res.requests ?? []) as Req[],
                ratings: (res.ratings ?? []) as boolean[],
                chats: (res.chats ?? []) as Chat[],
              })
              if (JSON.stringify(merged) === JSON.stringify(prev)) return prev
              skipNextPush.current = true
              return merged
            })
          }
          if (isInitial) {
            initialPullDone.current = true
            // Push any pre-existing localStorage data that wasn't on the server yet
            const current = load(key)
            if (current.log.length || current.requests.length || current.ratings.length || current.chats.length) {
              void knowledge.putPortalState(token, studentId, current).catch(() => {})
            }
          }
        })
        .catch(() => {
          if (isInitial) initialPullDone.current = true
        })
    }
    pull(true)
    const timer = window.setInterval(() => pull(false), 15_000)
    return () => {
      live = false
      window.clearInterval(timer)
    }
  }, [token, studentId, key])

  // Push student queries, requests, conversations, and ratings to the backend database when they change.
  useEffect(() => {
    if (!token || !initialPullDone.current) return
    if (skipNextPush.current) {
      skipNextPush.current = false
      return
    }
    let live = true
    knowledge
      .putPortalState(token, studentId, { log: s.log, requests: s.requests, ratings: s.ratings, chats: s.chats })
      .then((res) => {
        if (!live || !Array.isArray(res.requests)) return
        setS((prev) => {
          const merged = mergePortalState(prev, {
            log: (res.log ?? []) as Entry[],
            requests: (res.requests ?? []) as Req[],
            ratings: (res.ratings ?? []) as boolean[],
            chats: (res.chats ?? []) as Chat[],
          })
          if (JSON.stringify(merged) === JSON.stringify(prev)) return prev
          skipNextPush.current = true
          return merged
        })
      })
      .catch(() => {
        /* offline / local fallback */
      })
    return () => {
      live = false
    }
  }, [token, studentId, s.log, s.requests, s.ratings, s.chats])

  const value = useMemo<Ctx>(
    () => ({
      ...s,
      activeChatId,
      setActiveChatId,
      pendingPrompt,
      setPendingPrompt,
      addRequest: (q, tag, transcript) => setS((p) => ({ ...p, requests: [...p.requests, { id: Date.now(), q, tag, at: Date.now(), status: "Waiting for staff", transcript }] })),
      addEntry: (e) => setS((p) => ({ ...p, log: [...p.log, { ...e, at: Date.now() }] })),
      rate: (v) => setS((p) => ({ ...p, ratings: [...p.ratings, v] })),
      saveChat: (c) => setS((p) => ({ ...p, chats: p.chats.some((x) => x.id === c.id) ? p.chats.map((x) => (x.id === c.id ? c : x)) : [...p.chats, c] })),
      deleteChat: (id) => {
        setActiveChatId((cur) => (cur === id ? null : cur))
        setS((p) => ({ ...p, chats: p.chats.filter((c) => c.id !== id) }))
      },
      reset: () => {
        skipNextPush.current = true
        setActiveChatId(null)
        setPendingPrompt(null)
        setS(empty)
        if (token) {
          void knowledge.putPortalState(token, studentId, { log: [], requests: [], ratings: [], chats: [], reset: true }).catch(() => {})
        }
      },
    }),
    [s, activeChatId, pendingPrompt, token, studentId],
  )
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp(): Ctx {
  const c = useContext(AppCtx)
  if (!c) throw new Error("useApp must be used inside AppProvider")
  return c
}
