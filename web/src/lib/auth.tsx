import { createContext, useContext, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { GUARD_API } from "@/lib/knowledge"

export type Student = {
  id: string
  name: string
  role: string
  /** Set only for Synapse Guard sign-ins (email + password). Server-verified JWT. */
  token?: string
  email?: string
  guardRole?: "student" | "admin"
  expiresAt?: number
}
type AuthCtx = {
  student: Student | null
  /** Returns an error message, or null when sign-in succeeded. */
  signIn: (id: string, password: string) => Promise<string | null>
  signOut: () => void
}

const KEY = "synapse:session:v1"
const AuthContext = createContext<AuthCtx | null>(null)

function load(): Student | null {
  try {
    const raw = localStorage.getItem(KEY)
    const s = raw ? (JSON.parse(raw) as Student) : null
    if (s?.token && s.expiresAt && s.expiresAt < Date.now()) return null // Guard session expired
    return s
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

const GUARD_ERRORS: Record<string, string> = {
  INVALID_CREDENTIALS: "The email or password is incorrect.",
  ACCOUNT_LOCKED: "Too many failed attempts. The account is locked for 15 minutes.",
}

/** Sign in through Synapse Guard (guard/src). The returned JWT is verified by every protected API. */
async function guardSignIn(email: string, password: string): Promise<Student | string> {
  try {
    const res = await fetch(`${GUARD_API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })
    const data = (await res.json().catch(() => ({}))) as { token?: string; user?: { id: string; name?: string; email?: string; role?: string }; error?: string }
    if (!res.ok || !data.token || !data.user) return GUARD_ERRORS[data.error ?? ""] ?? "Sign-in failed. Please try again."
    const role = data.user.role === "admin" ? "admin" : "student"
    return {
      id: data.user.id,
      name: data.user.name || data.user.email || "User",
      email: data.user.email,
      role: role === "admin" ? "Administrator" : "Student",
      guardRole: role,
      token: data.token,
      expiresAt: tokenExpiry(data.token),
    }
  } catch {
    return "The sign-in service is unavailable. Please try again later."
  }
}

/**
 * Two sign-in paths:
 *  - Email + password -> Synapse Guard (server-issued token; required for Synapse Knowledge).
 *  - Student ID       -> DEMO ONLY, as before: any well-formed ID and a 6+ character password.
 * Replace both with your university SSO (OIDC/SAML) before going live.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [student, setStudent] = useState<Student | null>(load)
  const value = useMemo<AuthCtx>(() => {
    const persist = (next: Student) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      setStudent(next)
    }
    return {
      student,
      signIn: async (rawId, password) => {
        const input = rawId.trim()
        if (input.includes("@")) {
          if (!password) return "Enter your password."
          const out = await guardSignIn(input, password)
          if (typeof out === "string") return out
          persist(out)
          return null
        }
        const id = input.toUpperCase()
        if (!/^S?\d{6,8}$/.test(id)) return "Enter your student ID (for example S2041877) or your university email."
        if (password.length < 6) return "Your password must be at least 6 characters."
        const sid = id.startsWith("S") ? id : "S" + id
        persist({ id: sid, name: sid === "S2041877" ? "Layla A." : "Student " + sid.slice(-4), role: "Student" })
        return null
      },
      signOut: () => {
        try {
          localStorage.removeItem(KEY)
        } catch {
          /* ignore */
        }
        setStudent(null)
        window.location.hash = "#ask"
      },
    }
  }, [student])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthCtx {
  const c = useContext(AuthContext)
  if (!c) throw new Error("useAuth must be used inside AuthProvider")
  return c
}

/** UI hint only. The knowledge service enforces the admin role on every request. */
export const isKnowledgeAdmin = (s: Student | null) => s?.guardRole === "admin" && !!s.token
