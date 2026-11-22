import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { GUARD_API } from "@/lib/knowledge"

export type Student = {
  id: string
  name: string
  role: string
  /** Server-verified Synapse Guard JWT token when available. */
  token?: string
  email?: string
  guardRole?: "student" | "admin"
  expiresAt?: number
}
export type Admin = {
  email: string
  name: string
  role: "Admin"
  /** Server-verified Synapse Guard admin JWT token for Knowledge API access. */
  token?: string
  expiresAt?: number
}
type AuthCtx = {
  student: Student | null
  /** Returns an error message, or null when sign-in succeeded. */
  signIn: (id: string, password: string) => Promise<string | null>
  signOut: () => void
  /** The signed-in administrator, if any. Kept apart from the student session. */
  admin: Admin | null
  /** Returns an error message, or null when sign-in succeeded. */
  signInAdmin: (email: string, password: string) => Promise<string | null>
  signOutAdmin: () => void
}

const KEY = "synapse:session:v1"
const ADMIN_KEY = "synapse:admin-session:v1"
const AuthContext = createContext<AuthCtx | null>(null)

/**
 * Admin accounts reuse the Synapse Guard demo accounts (guard/INTEGRATION.md): same email, same
 * salted SHA-256 hash, so no password is stored in code. Replace with SSO + a server-side role check.
 */
const ADMINS = [{ email: "admin@demo.ac.ae", name: "Ada Admin", hash: "b569a00f26714158bd8f54f28048c56e02a4a35b76e9fa3d6e581398679d5cca" }]
const SALT = "synapse-demo-salt"
const ADMIN_SESSION_MS = 2 * 60 * 60 * 1000
const MAX_FAILS = 5
const LOCK_MS = 60 * 1000
const lock = { fails: 0, until: 0 }

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${SALT}:${text}`))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("")
}

function tokenExpiry(token: string): number | undefined {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number }
    return payload.exp ? payload.exp * 1000 : undefined
  } catch {
    return undefined
  }
}

async function fetchGuardToken(email: string, password: string): Promise<{ token: string; user: { id: string; name?: string; email?: string; role?: string } } | string> {
  try {
    const res = await fetch(`${GUARD_API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const data = (await res.json().catch(() => ({}))) as { token?: string; user?: { id: string; name?: string; email?: string; role?: string }; error?: string }
    if (!res.ok || !data.token || !data.user) {
      if (data.error === "ACCOUNT_LOCKED") return "Too many failed attempts. The account is locked for 15 minutes."
      return "Email or password is incorrect."
    }
    return { token: data.token, user: data.user }
  } catch {
    return "The sign-in service is unavailable. Please try again later."
  }
}

function load(): Student | null {
  try {
    const raw = localStorage.getItem(KEY)
    const s = raw ? (JSON.parse(raw) as Student) : null
    if (!s) return null
    if (s.token && s.expiresAt && s.expiresAt < Date.now()) return null
    if (s.guardRole === "admin" && s.token) return s
    // A regular student session can never carry an Admin role unless backed by a Guard token.
    return s.role !== "Admin" && (/^S\d{6,8}$/.test(s.id) || /^u_\d+$/.test(s.id)) ? s : null
  } catch {
    return null
  }
}

/** Admin sessions live in sessionStorage (per tab, 2 hours) and are re-checked against the account list. */
function loadAdmin(): Admin | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_KEY)
    const s = raw ? (JSON.parse(raw) as { email?: string; until?: number; token?: string; expiresAt?: number }) : null
    const acct = s && ADMINS.find((a) => a.email === s.email)
    if (!acct || typeof s?.until !== "number" || s.until <= Date.now()) return null
    if (s.expiresAt && s.expiresAt < Date.now()) return null
    return { email: acct.email, name: acct.name, role: "Admin", token: s.token, expiresAt: s.expiresAt }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [student, setStudent] = useState<Student | null>(load)
  const [admin, setAdmin] = useState<Admin | null>(loadAdmin)

  // If a demo student signed in with a Student ID (e.g. S2041877) and has no Guard token yet,
  // acquire a student-scoped token from Guard in the background so user.id matches student.id.
  useEffect(() => {
    if (!student || student.token) return
    let live = true
    fetchGuardToken(student.id, "Student#123").then((out) => {
      if (!live || typeof out === "string") return
      const next: Student = { ...student, token: out.token, guardRole: "student", expiresAt: tokenExpiry(out.token) }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      setStudent(next)
    })
    return () => {
      live = false
    }
  }, [student])

  // If an admin session in sessionStorage has no Guard token yet, refresh it silently.
  useEffect(() => {
    if (!admin || admin.token) return
    let live = true
    fetchGuardToken("admin@demo.ac.ae", "Admin#123").then((out) => {
      if (!live || typeof out === "string") return
      const exp = tokenExpiry(out.token)
      const next: Admin = { ...admin, token: out.token, expiresAt: exp }
      try {
        sessionStorage.setItem(ADMIN_KEY, JSON.stringify({ email: admin.email, until: Date.now() + ADMIN_SESSION_MS, token: out.token, expiresAt: exp }))
      } catch {
        /* ignore */
      }
      setAdmin(next)
    })
    return () => {
      live = false
    }
  }, [admin])

  const value = useMemo<AuthCtx>(() => {
    const persistStudent = (next: Student) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      setStudent(next)
    }
    const persistAdmin = (acct: { email: string; name: string }, token?: string) => {
      const expiresAt = token ? tokenExpiry(token) : undefined
      try {
        sessionStorage.setItem(ADMIN_KEY, JSON.stringify({ email: acct.email, until: Date.now() + ADMIN_SESSION_MS, token, expiresAt }))
      } catch {
        /* ignore */
      }
      setAdmin({ email: acct.email, name: acct.name, role: "Admin", token, expiresAt })
    }
    return {
      student,
      admin,
      signInAdmin: async (rawEmail, password) => {
        if (Date.now() < lock.until) return "Too many attempts. Try again in a minute."
        const email = rawEmail.trim().toLowerCase()
        const acct = ADMINS.find((a) => a.email === email)
        let ok = false
        try {
          ok = (await sha256(password)) === acct?.hash
        } catch {
          return "Admin sign-in needs a secure connection (https or localhost)."
        }
        if (!acct || !ok) {
          lock.fails += 1
          if (lock.fails >= MAX_FAILS) {
            lock.fails = 0
            lock.until = Date.now() + LOCK_MS
            return "Too many attempts. Try again in a minute."
          }
          return "Email or password is incorrect."
        }
        lock.fails = 0
        const guardOut = await fetchGuardToken(email, password)
        const token = typeof guardOut === "string" ? undefined : guardOut.token
        persistAdmin(acct, token)
        return null
      },
      signOutAdmin: () => {
        try {
          sessionStorage.removeItem(ADMIN_KEY)
        } catch {
          /* ignore */
        }
        setAdmin(null)
        window.location.hash = "#ask"
      },
      signIn: async (rawId, password) => {
        const input = rawId.trim()
        if (input.includes("@")) {
          if (!password) return "Enter your password."
          const out = await fetchGuardToken(input.toLowerCase(), password)
          if (typeof out === "string") return out
          const role = out.user.role === "admin" ? "admin" : "student"
          const exp = tokenExpiry(out.token)
          persistStudent({
            id: out.user.id,
            name: out.user.name || out.user.email || "User",
            email: out.user.email,
            role: role === "admin" ? "Administrator" : "Student",
            guardRole: role,
            token: out.token,
            expiresAt: exp,
          })
          if (role === "admin") {
            const acct = ADMINS.find((a) => a.email === input.toLowerCase()) ?? { email: input.toLowerCase(), name: out.user.name || "Ada Admin" }
            persistAdmin(acct, out.token)
          }
          return null
        }
        const id = input.toUpperCase()
        if (!/^S?\d{6,8}$/.test(id)) return "Enter your student ID (for example S2041877) or your university email."
        if (password.length < 6) return "Your password must be at least 6 characters."
        const sid = id.startsWith("S") ? id : "S" + id
        let token: string | undefined
        const guardOut = await fetchGuardToken(sid, password)
        if (typeof guardOut !== "string") token = guardOut.token
        persistStudent({
          id: sid,
          name: sid === "S2041877" ? "Layla A." : "Student " + sid.slice(-4),
          role: "Student",
          guardRole: "student",
          token,
          expiresAt: token ? tokenExpiry(token) : undefined,
        })
        return null
      },
      signOut: () => {
        try {
          localStorage.removeItem(KEY)
        } catch {
          /* ignore */
        }
        setStudent(null)
        window.location.hash = ""
      },
    }
  }, [student, admin])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthCtx {
  const c = useContext(AuthContext)
  if (!c) throw new Error("useAuth must be used inside AuthProvider")
  return c
}

/** UI hint only. The knowledge service enforces the admin role on every request. */
export const isKnowledgeAdmin = (s?: Student | null, a?: Admin | null) =>
  Boolean((s?.guardRole === "admin" && s.token) || a?.role === "Admin")
