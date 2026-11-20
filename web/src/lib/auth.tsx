import { createContext, useContext, useMemo, useState } from "react"
import type { ReactNode } from "react"

export type Student = { id: string; name: string; role: string }
type AuthCtx = {
  student: Student | null
  /** Returns an error message, or null when sign-in succeeded. */
  signIn: (id: string, password: string) => string | null
  signOut: () => void
}

const KEY = "synapse:session:v1"
const AuthContext = createContext<AuthCtx | null>(null)

function load(): Student | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Student) : null
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
  const value = useMemo<AuthCtx>(
    () => ({
      student,
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
    [student],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthCtx {
  const c = useContext(AuthContext)
  if (!c) throw new Error("useAuth must be used inside AuthProvider")
  return c
}
