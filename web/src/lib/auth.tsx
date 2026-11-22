import { createContext, useContext, useMemo, useState } from "react"
import type { ReactNode } from "react"

export type Student = { id: string; name: string; role: string }
export type Admin = { email: string; name: string; role: "Admin" }
type AuthCtx = {
  student: Student | null
  /** Returns an error message, or null when sign-in succeeded. */
  signIn: (id: string, password: string) => string | null
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

function load(): Student | null {
  try {
    const raw = localStorage.getItem(KEY)
    const s = raw ? (JSON.parse(raw) as Student) : null
    // A student session can never carry an admin role, even if the stored value was edited.
    return s && s.role !== "Admin" && /^S\d{6,8}$/.test(s.id) ? s : null
  } catch {
    return null
  }
}

/** Admin sessions live in sessionStorage (per tab, 2 hours) and are re-checked against the account list. */
function loadAdmin(): Admin | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_KEY)
    const s = raw ? (JSON.parse(raw) as { email?: string; until?: number }) : null
    const acct = s && ADMINS.find((a) => a.email === s.email)
    return acct && typeof s?.until === "number" && s.until > Date.now() ? { email: acct.email, name: acct.name, role: "Admin" } : null
  } catch {
    return null
  }
}

/**
 * DEMO SIGN-IN ONLY. Any well-formed student ID and a 6+ character password is accepted.
 * Replace signIn() with your university SSO (OIDC/SAML) so identity is verified on a server.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [student, setStudent] = useState<Student | null>(load)
  const [admin, setAdmin] = useState<Admin | null>(loadAdmin)
  const value = useMemo<AuthCtx>(
    () => ({
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
        try {
          sessionStorage.setItem(ADMIN_KEY, JSON.stringify({ email: acct.email, until: Date.now() + ADMIN_SESSION_MS }))
        } catch {
          /* ignore */
        }
        setAdmin({ email: acct.email, name: acct.name, role: "Admin" })
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
      signIn: (rawId, password) => {
        const id = rawId.trim().toUpperCase()
        if (!/^S?\d{6,8}$/.test(id)) return "Enter your student ID, for example S2041877."
        if (password.length < 6) return "Your password must be at least 6 characters."
        const sid = id.startsWith("S") ? id : "S" + id
        const next: Student = { id: sid, name: sid === "S2041877" ? "Layla A." : "Student " + sid.slice(-4), role: "Student" }
        try {
          localStorage.setItem(KEY, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        setStudent(next)
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
    }),
    [student, admin],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthCtx {
  const c = useContext(AuthContext)
  if (!c) throw new Error("useAuth must be used inside AuthProvider")
  return c
}
