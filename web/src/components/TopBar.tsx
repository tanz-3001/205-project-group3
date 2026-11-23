import { Bell, ChevronDown, LogOut, MessageSquare, Search, Sparkles } from "lucide-react"
import type { MouseEvent } from "react"
import { useApp } from "@/lib/app-context"
import { isKnowledgeAdmin, useAuth } from "@/lib/auth"
import { PAGES } from "@/lib/data"
import { go } from "@/lib/route"

const tab = (on: boolean) =>
  "inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 " +
  (on ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white")

const iconBtn = "relative grid size-10 shrink-0 place-items-center rounded-xl text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"

function focusAsk() {
  go("ask")
  window.setTimeout(() => document.getElementById("ask-input")?.focus(), 60)
}

function focusAssist() {
  go("assist")
  window.setTimeout(() => document.getElementById("assist-input")?.focus(), 80)
}

export default function TopBar({ route }: { route: string }) {
  const { requests } = useApp()
  const { student, admin, signOut } = useAuth()
  const open = requests.filter((r) => r.status !== "Resolved").length
  const current = PAGES.find((p) => p.slug === route)
  const academic = PAGES.filter((p) => p.nav === "academic")
  const initials = (student?.name ?? "").split(/\s+/).map((part) => part[0]).join("").slice(0, 2)
  const closeMenu = (e: MouseEvent<HTMLElement>) => e.currentTarget.closest("details")?.removeAttribute("open")

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#12353a]/95 text-white shadow-[0_12px_28px_-24px_rgba(11,40,45,0.8)] backdrop-blur-xl">
      <div className="h-[3px] bg-white/10"><span className="block h-full w-1/3 bg-[#f1bd61]" /></div>
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 px-4 sm:px-7 lg:px-10">
        <a href="#ask" className="group flex shrink-0 items-center gap-3 py-3.5">
          <span className="relative grid size-10 place-items-center overflow-hidden rounded-[14px] border border-white/20 bg-[#1e615e] text-white shadow-inner">
            <Sparkles aria-hidden="true" className="size-[18px] transition-transform duration-500 group-hover:rotate-12" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[1.06rem] font-semibold tracking-[-0.035em]">Synapse</span>
            <span className="mt-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/55">Student portal</span>
          </span>
        </a>
        <nav aria-label="Services" className="order-3 flex w-full flex-wrap items-center gap-1 pb-3 sm:order-none sm:ml-2 sm:w-auto sm:flex-1 sm:pb-0">
          <a href="#ask" aria-current={route === "ask" ? "page" : undefined} className={tab(route === "ask")}>Overview</a>
          <a href="#assist" aria-current={route === "assist" ? "page" : undefined} className={tab(route === "assist")}>Synapse Assist</a>
          <details className="group relative shrink-0">
            <summary className={tab(current?.nav === "academic") + " cursor-pointer list-none [&::-webkit-details-marker]:hidden"}>
              Academic <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="absolute left-0 top-[calc(100%+10px)] z-50 w-60 rounded-2xl border border-line bg-white p-2 text-ink shadow-[0_18px_55px_-24px_rgba(10,35,40,0.35)]">
              <p className="px-3 pb-1 pt-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted-ink">Academic services</p>
              {academic.map((p) => (
                <a key={p.slug} href={"#" + p.slug} onClick={closeMenu} className="flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-medium transition-colors hover:bg-brand-soft hover:text-brand">
                  {p.title}<span className="text-muted-ink">→</span>
                </a>
              ))}
            </div>
          </details>
          <a href="#fees" aria-current={current?.nav === "fees" ? "page" : undefined} className={tab(current?.nav === "fees")}>Fees</a>
          <a href="#it" aria-current={current?.nav === "it" ? "page" : undefined} className={tab(current?.nav === "it")}>IT support</a>
          <a href="#support" aria-current={current?.nav === "support" ? "page" : undefined} className={tab(current?.nav === "support")}>People & support</a>
          {isKnowledgeAdmin(student, admin) && <a href="#admin" className={tab(false)}>Admin</a>}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 pb-3 sm:pb-0">
          <button aria-label="Search services" onClick={focusAsk} className={iconBtn}><Search aria-hidden="true" className="size-[18px]" /></button>
          <button aria-label={`My requests, ${open} open`} onClick={() => go("requests")} className={iconBtn}>
            <Bell aria-hidden="true" className="size-[18px]" />
            {open > 0 && <span className="absolute right-1 top-1 grid min-h-[17px] min-w-[17px] place-items-center rounded-full bg-[#f1bd61] px-1 text-[0.6rem] font-bold text-[#30240f]">{open}</span>}
          </button>
          <span className="mx-1 h-7 w-px bg-white/15" />
          <details className="group relative"><summary aria-label={`Signed in as ${student?.name}. Open account menu`} className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl px-1.5 transition-colors hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 [&::-webkit-details-marker]:hidden">
            <span className="grid size-8 place-items-center rounded-[11px] bg-[#e7c77f] text-xs font-bold text-[#3d381f]">{initials}</span>
            <span className="hidden text-left leading-tight xl:block"><span className="block text-xs font-semibold">{student?.name}</span><span className="mt-1 block text-[0.65rem] text-white/55">{student?.role}</span></span>
          </summary>
            <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-48 rounded-2xl border border-line bg-white p-2 text-ink shadow-[0_18px_55px_-24px_rgba(10,35,40,0.35)]">
              <button onClick={signOut} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium hover:bg-brand-soft hover:text-brand"><LogOut aria-hidden="true" className="size-4" />Sign out</button>
            </div>
          </details>
          <button aria-label="Ask Synapse" onClick={focusAssist} className="ml-1 hidden h-10 items-center gap-2 rounded-xl bg-[#f4c86f] px-3.5 text-xs font-bold text-[#253b35] transition-colors hover:bg-[#ffda8c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:inline-flex">
            <MessageSquare aria-hidden="true" className="size-4" /> Ask
          </button>
        </div>
      </div>
    </header>
  )
}
