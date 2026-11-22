import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import type { Citation } from "./assist"

export type Status = "Waiting for staff" | "In progress" | "Resolved"
export type Req = { id: number; q: string; tag: string; at: number; status: Status; reply?: string; transcript?: string[] }
export type Entry = { q: string; tag: string; type: "answered" | "escalated" | "unknown"; at: number; /** how long the portal took to respond, in ms */ ms?: number; /** where the question was asked */ via?: "ask" | "assist" }
export type Msg = { r: "u" | "a"; t: string; k?: "answer" | "escalate"; src?: string[]; cites?: Citation[]; category?: string; urgent?: boolean }
export type Chat = { id: number; title: string; at: number; msgs: Msg[] }
type State = { requests: Req[]; log: Entry[]; ratings: boolean[]; chats: Chat[] }
type Ctx = State & {
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

const AppCtx = createContext<Ctx | null>(null)

/** Data is stored per student. Move this to your database so staff receive requests for real. */
export function AppProvider({ children, studentId }: { children: ReactNode; studentId: string }) {
  const key = keyFor(studentId)
  const [s, setS] = useState<State>(() => load(key))
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(s))
    } catch {
      /* ignore */
    }
  }, [s, key])
  const value = useMemo<Ctx>(
    () => ({
      ...s,
      addRequest: (q, tag, transcript) => setS((p) => ({ ...p, requests: [...p.requests, { id: Date.now(), q, tag, at: Date.now(), status: "Waiting for staff", transcript }] })),
      addEntry: (e) => setS((p) => ({ ...p, log: [...p.log, { ...e, at: Date.now() }] })),
      rate: (v) => setS((p) => ({ ...p, ratings: [...p.ratings, v] })),
      saveChat: (c) => setS((p) => ({ ...p, chats: p.chats.some((x) => x.id === c.id) ? p.chats.map((x) => (x.id === c.id ? c : x)) : [...p.chats, c] })),
      deleteChat: (id) => setS((p) => ({ ...p, chats: p.chats.filter((c) => c.id !== id) })),
      reset: () => setS(empty),
    }),
    [s],
  )
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp(): Ctx {
  const c = useContext(AppCtx)
  if (!c) throw new Error("useApp must be used inside AppProvider")
  return c
}
