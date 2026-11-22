import { Sparkles } from "lucide-react"
import { useState } from "react"
import type { FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"

const field = "min-h-12 w-full rounded-lg border border-[#A9BDB9] bg-white px-3.5 text-base text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand"

export default function Login() {
  const { signIn } = useAuth()
  const [id, setId] = useState("")
  const [pw, setPw] = useState("")
  const [err, setErr] = useState("")
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setErr(signIn(id, pw) ?? "")
  }
  return (
    <div className="app-canvas grid min-h-screen place-items-center bg-page px-4 py-10 text-ink">
      <div className="flex w-full max-w-[560px] flex-col items-center gap-6">
        <h1 className="text-center text-4xl font-bold tracking-tight text-navy sm:text-5xl">Welcome to Synapse</h1>
        <form onSubmit={submit} noValidate className="grid w-full gap-4 rounded-2xl border border-line border-t-[5px] border-t-brand bg-white p-7 shadow-[0_18px_55px_-30px_rgba(10,35,40,0.35)] sm:px-10 sm:py-9">
          <div className="flex items-center gap-3 font-extrabold text-navy">
            <span className="grid size-10 place-items-center rounded-[14px] bg-[#1e615e] text-white"><Sparkles aria-hidden="true" className="size-[18px]" /></span>
            Synapse Assist
          </div>
          <div>
            <h2 className="text-2xl font-bold text-navy">Sign in</h2>
            <p className="text-sm text-muted-ink">Use your student ID and portal password.</p>
          </div>
          <label className="grid gap-1.5 font-semibold text-navy">Student ID
            <input className={field} value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" inputMode="numeric" placeholder="S2041877" aria-describedby="login-err" />
          </label>
          <label className="grid gap-1.5 font-semibold text-navy">Password
            <input className={field} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" aria-describedby="login-err" />
          </label>
          <p id="login-err" role="alert" className="min-h-5 text-sm font-semibold text-[#B4281B]">{err}</p>
          <Button type="submit" className="min-h-12 bg-brand text-base text-white hover:bg-brand-dark">Sign in</Button>
          <p className="text-sm text-muted-ink">Forgot your password? Contact the IT Help Desk. <b>Demo:</b> any ID like S2041877 and a password of 6+ characters.</p>
          <p className="text-sm text-muted-ink">Administrator? <a href="#admin" className="font-semibold text-brand underline">Admin sign-in</a></p>
        </form>
      </div>
    </div>
  )
}
