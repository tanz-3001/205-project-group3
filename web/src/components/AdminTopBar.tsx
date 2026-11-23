import { ExternalLink, LogOut, Sparkles } from "lucide-react"
import { useAuth } from "@/lib/auth"
import type { Admin } from "@/lib/auth"

const tab = (on: boolean) =>
  "inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 " +
  (on ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white")

/** Same header treatment as the student portal's TopBar, with admin navigation. */
export default function AdminTopBar({ admin, route = "admin" }: { admin: Admin; route?: "admin" | "knowledge" }) {
  const { signOutAdmin } = useAuth()
  const initials = admin.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#12353a]/95 text-white shadow-[0_12px_28px_-24px_rgba(11,40,45,0.8)] backdrop-blur-xl">
      <div className="h-[3px] bg-white/10"><span className="block h-full w-1/3 bg-[#f1bd61]" /></div>
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 px-4 sm:px-7 lg:px-10">
        <a href="#admin" className="group flex shrink-0 items-center gap-3 py-3.5">
          <span className="relative grid size-10 place-items-center overflow-hidden rounded-[14px] border border-white/20 bg-[#1e615e] text-white shadow-inner">
            <Sparkles aria-hidden="true" className="size-[18px] transition-transform duration-500 group-hover:rotate-12" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[1.06rem] font-semibold tracking-[-0.035em]">Synapse</span>
            <span className="mt-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/55">Admin dashboard</span>
          </span>
        </a>
        <nav aria-label="Admin" className="order-3 flex w-full items-center gap-1 pb-3 sm:order-none sm:ml-2 sm:w-auto sm:flex-1 sm:pb-0">
          <a href="#admin" aria-current={route === "admin" ? "page" : undefined} className={tab(route === "admin")}>Dashboard</a>
          <a href="#knowledge" aria-current={route === "knowledge" ? "page" : undefined} className={tab(route === "knowledge")}>Synapse Knowledge</a>
          <a href="#" className={tab(false)}>Portal home <ExternalLink aria-hidden="true" className="size-3.5" /></a>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 pb-3 sm:pb-0">
          <details className="group relative">
            <summary aria-label={`Signed in as ${admin.name}. Open account menu`} className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl px-1.5 transition-colors hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 [&::-webkit-details-marker]:hidden">
              <span className="grid size-8 place-items-center rounded-[11px] bg-[#e7c77f] text-xs font-bold text-[#3d381f]">{initials}</span>
              <span className="hidden text-left leading-tight xl:block"><span className="block text-xs font-semibold">{admin.name}</span><span className="mt-1 block text-[0.65rem] text-white/55">{admin.role}</span></span>
            </summary>
            <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-48 rounded-2xl border border-line bg-white p-2 text-ink shadow-[0_18px_55px_-24px_rgba(10,35,40,0.35)]">
              <button onClick={signOutAdmin} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium hover:bg-brand-soft hover:text-brand"><LogOut aria-hidden="true" className="size-4" />Sign out</button>
            </div>
          </details>
        </div>
      </div>
    </header>
  )
}
