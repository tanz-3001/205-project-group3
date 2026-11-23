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

const ADMIN_SESSION_MS = 2 * 60 * 60 * 1000
const MAX_FAILS = 5
const LOCK_MS = 60 * 1000
const lock = { fails: 0, until: 0 }

function jwtRole(token?: string): string | null {
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { role?: unknown }
    return typeof payload.role === "string" ? payload.role : null
  } catch {
    return null
  }
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

const cleanDemoName = (name: string) => (name === "Demo Admin" ? "Ada Admin" : name === "Demo Student" ? "Layla A." : name)

function load(): Student | null {
  try {
    const raw = localStorage.getItem(KEY)
    const s = raw ? (JSON.parse(raw) as Student) : null
    if (!s) return null
    if (s.token && s.expiresAt && s.expiresAt < Date.now()) return null
    const clean: Student = { ...s, name: cleanDemoName(s.name || "") }
    if (clean.role === "Admin" || clean.guardRole === "admin" || jwtRole(clean.token) === "admin") return null
    return /^S\d{6,8}$/.test(clean.id) || /^u_\d+$/.test(clean.id) ? clean : null
  } catch {
    return null
  }
}

/** Admin sessions live in sessionStorage (per tab, 2 hours) and require an active Guard admin JWT. */
function loadAdmin(): Admin | null {
  try {
    if (load()) {
      sessionStorage.removeItem(ADMIN_KEY)
      return null
    }
    const raw = sessionStorage.getItem(ADMIN_KEY)
    const s = raw ? (JSON.parse(raw) as { email?: string; name?: string; until?: number; token?: string; expiresAt?: number }) : null
    if (!s || typeof s.email !== "string" || typeof s.until !== "number" || s.until <= Date.now()) return null
    if (!s.token || (s.expiresAt && s.expiresAt < Date.now()) || jwtRole(s.token) !== "admin") return null
    return { email: s.email, name: cleanDemoName(s.name || "Ada Admin"), role: "Admin", token: s.token, expiresAt: s.expiresAt }
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

  const value = useMemo<AuthCtx>(() => {
    const clearStudentStorage = () => {
      try {
        localStorage.removeItem(KEY)
      } catch {
        /* ignore */
      }
      setStudent(null)
    }
    const clearAdminStorage = () => {
      try {
        sessionStorage.removeItem(ADMIN_KEY)
      } catch {
        /* ignore */
      }
      setAdmin(null)
    }
    const persistStudent = (next: Student) => {
      clearAdminStorage()
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      setStudent(next)
    }
    const persistAdmin = (acct: { email: string; name: string }, token: string) => {
      clearStudentStorage()
      const expiresAt = tokenExpiry(token)
      try {
        sessionStorage.setItem(ADMIN_KEY, JSON.stringify({ email: acct.email, name: acct.name, until: Date.now() + ADMIN_SESSION_MS, token, expiresAt }))
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
        if (!email || !password) return "Enter your admin email and password."
        const guardOut = await fetchGuardToken(email, password)
        if (typeof guardOut === "string") {
          lock.fails += 1
          if (lock.fails >= MAX_FAILS) {
            lock.fails = 0
            lock.until = Date.now() + LOCK_MS
            return "Too many attempts. Try again in a minute."
          }
          return guardOut
        }
        if (guardOut.user.role !== "admin" || jwtRole(guardOut.token) !== "admin") {
          return "Access denied. Administrator accounts only."
        }
        lock.fails = 0
        persistAdmin({ email: guardOut.user.email || email, name: cleanDemoName(guardOut.user.name || "Ada Admin") }, guardOut.token)
        return null
      },
      signOutAdmin: () => {
        clearStudentStorage()
        clearAdminStorage()
        window.location.hash = ""
      },
      signIn: async (rawId, password) => {
        const input = rawId.trim()
        if (input.includes("@")) {
          if (!password) return "Enter your password."
          const out = await fetchGuardToken(input.toLowerCase(), password)
          if (typeof out === "string") return out
          const role = out.user.role === "admin" && jwtRole(out.token) === "admin" ? "admin" : "student"
          if (role === "admin") {
            persistAdmin({ email: out.user.email || input.toLowerCase(), name: cleanDemoName(out.user.name || "Ada Admin") }, out.token)
            return null
          }
          const exp = tokenExpiry(out.token)
          persistStudent({
            id: out.user.id,
            name: cleanDemoName(out.user.name || out.user.email || "User"),
            email: out.user.email,
            role: "Student",
            guardRole: "student",
            token: out.token,
            expiresAt: exp,
          })
          return null
        }
        const id = input.toUpperCase()
        if (!/^S?\d{6,8}$/.test(id)) return "Enter your student ID (for example S2041877) or your university email."
        if (password.length < 6) return "Your password must be at least 6 characters."
        const sid = id.startsWith("S") ? id : "S" + id
        let token: string | undefined
        const guardOut = await fetchGuardToken(sid, password)
        if (typeof guardOut !== "string") {
          if (guardOut.user.role === "admin" || jwtRole(guardOut.token) === "admin") {
            return "Use administrator sign-in to access staff accounts."
          }
          token = guardOut.token
        }
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
        clearStudentStorage()
        clearAdminStorage()
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
  Boolean(a && a.role === "Admin" && a.token && jwtRole(a.token) === "admin" && !s)
