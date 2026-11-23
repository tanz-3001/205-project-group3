import { ShieldCheck } from "lucide-react"
import { useState } from "react"
import type { FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"

const field = "min-h-12 w-full rounded-lg border border-[#A9BDB9] bg-white px-3.5 text-base text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand"

export default function AdminLogin() {
  const { signInAdmin } = useAuth()
  const [email, setEmail] = useState("")
  const [pw, setPw] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr((await signInAdmin(email, pw)) ?? "")
    setBusy(false)
  }
  return (
    <div className="app-canvas grid min-h-screen place-items-center bg-page px-4 py-10 text-ink">
      <div className="flex w-full max-w-[560px] flex-col items-center gap-6">
        <h1 className="text-center text-4xl font-bold tracking-tight text-navy sm:text-5xl">Synapse admin</h1>
        <form onSubmit={submit} noValidate className="grid w-full gap-4 rounded-2xl border border-line border-t-[5px] border-t-brand bg-white p-7 shadow-[0_18px_55px_-30px_rgba(10,35,40,0.35)] sm:px-10 sm:py-9">
          <div className="flex items-center gap-3 font-extrabold text-navy">
            <span className="grid size-10 place-items-center rounded-[14px] bg-[#1e615e] text-white"><ShieldCheck aria-hidden="true" className="size-[18px]" /></span>
            Admin dashboard
          </div>
          <div>
            <h2 className="text-2xl font-bold text-navy">Sign in</h2>
            <p className="text-sm text-muted-ink">Administrator accounts only.</p>
          </div>
          <label className="grid gap-1.5 font-semibold text-navy">Email
            <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="admin@demo.ac.ae" aria-describedby="admin-login-err" />
          </label>
          <label className="grid gap-1.5 font-semibold text-navy">Password
            <input className={field} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" aria-describedby="admin-login-err" />
          </label>
          <p id="admin-login-err" role="alert" className="min-h-5 text-sm font-semibold text-[#B4281B]">{err}</p>
          <Button type="submit" disabled={busy} className="min-h-12 bg-brand text-base text-white hover:bg-brand-dark">{busy ? "Signing in…" : "Sign in"}</Button>
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs">
            <span className="font-semibold text-muted-ink">Quick fill demo:</span>
            <button type="button" onClick={() => { setEmail("admin@demo.ac.ae"); setPw("Admin#123"); setErr("") }} className="rounded-lg border border-line bg-page px-2.5 py-1.5 font-semibold text-navy hover:border-brand hover:bg-brand-soft">Demo admin</button>
          </div>
          <p className="text-sm text-muted-ink"><b>Demo:</b> admin@demo.ac.ae with Admin#123 (the Synapse Guard demo admin). <a href="#" className="font-semibold text-brand underline">← Back to overview</a></p>
        </form>
      </div>
    </div>
  )
}
