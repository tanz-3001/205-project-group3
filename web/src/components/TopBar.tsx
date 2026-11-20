import { Bell, ChevronDown, MessageSquare, Search } from "lucide-react"
import type { MouseEvent } from "react"
import { useApp } from "@/lib/app-context"
import { PAGES } from "@/lib/data"
import { go } from "@/lib/route"

const tab = (on: boolean) =>
  "flex h-16 items-center border-b-[3px] px-3.5 text-[0.98rem] font-semibold transition-colors " +
  (on ? "border-brand text-brand" : "border-transparent text-navy hover:border-brand hover:text-brand")

const iconBtn = "relative grid size-11 place-items-center rounded-full text-navy transition-colors hover:bg-page"

function focusAsk() {
  go("ask")
  window.setTimeout(() => document.getElementById("ask-input")?.focus(), 60)
}

export default function TopBar({ route }: { route: string }) {
  const { requests } = useApp()
  const open = requests.filter((r) => r.status !== "Resolved").length
  const current = PAGES.find((p) => p.slug === route)
  const academic = PAGES.filter((p) => p.nav === "academic")
  const closeMenu = (e: MouseEvent<HTMLElement>) => {
    e.currentTarget.closest("details")?.removeAttribute("open")
  }

  return (
    <header className="border-b border-line bg-white">
      <div className="h-1.5 bg-brand" />
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-x-6 px-4 sm:px-7">
        <a href="#ask" className="flex items-center gap-3 py-3 text-xl font-extrabold tracking-tight text-navy">
          <span className="grid size-9 place-items-center rounded-full bg-navy text-base text-white ring-4 ring-brand-soft">S</span>
          Synapse
        </a>
        <nav aria-label="Services" className="flex flex-1 flex-wrap items-stretch">
          <details className="relative">
            <summary className={tab(current?.nav === "academic") + " cursor-pointer list-none gap-1.5 [&::-webkit-details-marker]:hidden"}>
              Academic <ChevronDown className="size-4" />
            </summary>
            <div className="absolute left-0 top-[calc(100%-4px)] z-20 w-56 rounded-xl border border-line bg-white p-1.5 shadow-lg">
              {academic.map((p) => (
                <a key={p.slug} href={"#" + p.slug} onClick={closeMenu} className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-ink hover:bg-brand-soft hover:text-brand">
                  {p.title}
                </a>
              ))}
            </div>
          </details>
          <a href="#fees" className={tab(current?.nav === "fees")}>Fees</a>
          <a href="#it" className={tab(current?.nav === "it")}>IT Support</a>
          <a href="#support" className={tab(current?.nav === "support")}>Support Services</a>
        </nav>
        <div className="flex items-center gap-1">
          <button aria-label="Search" onClick={focusAsk} className={iconBtn}><Search className="size-5" /></button>
          <button aria-label={`My requests, ${open} open`} onClick={() => go("requests")} className={iconBtn}>
            <Bell className="size-5" />
            {open > 0 && <span className="absolute right-0 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-badge px-1 text-xs font-bold text-[#3A2A00]">{open}</span>}
          </button>
          <button aria-label="Ask Synapse" onClick={focusAsk} className={iconBtn}><MessageSquare className="size-5" /></button>
          <span role="img" aria-label="Signed in as Layla A." className="ml-1 grid size-10 place-items-center rounded-full bg-brand-soft font-bold text-brand">LA</span>
        </div>
      </div>
    </header>
  )
}
