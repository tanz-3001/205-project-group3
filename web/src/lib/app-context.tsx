import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

export type Status = "Waiting for staff" | "In progress" | "Resolved"
export type Req = { id: number; q: string; tag: string; at: number; status: Status; reply?: string }
export type Entry = { q: string; tag: string; type: "answered" | "escalated" | "unknown"; at: number }
type State = { requests: Req[]; log: Entry[]; ratings: boolean[] }
type Ctx = State & {
  addRequest: (q: string, tag: string) => void
  addEntry: (e: Omit<Entry, "at">) => void
  rate: (v: boolean) => void
  reset: () => void
}

const KEY = "synapse:react:v1"
const empty: State = { requests: [], log: [], ratings: [] }

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...empty, ...(JSON.parse(raw) as Partial<State>) }
  } catch {
    /* ignore */
  }
  return empty
}

const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      /* ignore */
    }
  }, [s])
  const value = useMemo<Ctx>(
    () => ({
      ...s,
      addRequest: (q, tag) => setS((p) => ({ ...p, requests: [...p.requests, { id: Date.now(), q, tag, at: Date.now(), status: "Waiting for staff" }] })),
      addEntry: (e) => setS((p) => ({ ...p, log: [...p.log, { ...e, at: Date.now() }] })),
      rate: (v) => setS((p) => ({ ...p, ratings: [...p.ratings, v] })),
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
