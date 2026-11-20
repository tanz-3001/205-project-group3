import { Coins, Headset, Heart, Scale } from "lucide-react"
import { useApp } from "@/lib/app-context"

const items = [
  { slug: "ask", label: "Dashboard" },
  { slug: "requests", label: "My requests" },
]
const tiles = [
  { label: "Academic appeals", category: "Academic appeals", icon: Scale, wide: false },
  { label: "Financial help", category: "Financial help", icon: Coins, wide: false },
  { label: "Wellbeing support", category: "Wellbeing", icon: Heart, wide: true },
  { label: "Contact staff", category: null, icon: Headset, wide: true },
]

export default function Sidebar({ route, onContact }: { route: string; onContact: (category: string | null, q: string) => void }) {
  const { requests } = useApp()
  const open = requests.filter((r) => r.status !== "Resolved").length

  return (
    <aside className="space-y-5">
      <section className="flex items-center gap-3.5 rounded-xl border border-line bg-white p-5">
        <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-navy font-bold text-white">LA</span>
        <div>
          <p className="font-bold text-navy">Layla A.</p>
          <p className="text-sm text-muted-ink">Student</p>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="mb-3 font-bold text-navy">Navigate</h2>
        <nav aria-label="Student menu" className="relative flex flex-col py-1 before:absolute before:bottom-7 before:left-[10px] before:top-7 before:w-0.5 before:bg-line">
          {items.map((i) => {
            const on = route === i.slug
            return (
              <a key={i.slug} href={"#" + i.slug} aria-current={on ? "page" : undefined}
                className={"relative flex min-h-12 items-center gap-3 rounded-lg pl-9 pr-2 transition-colors " + (on ? "font-bold text-brand" : "text-ink hover:text-brand")}>
                <span className={"absolute left-[5px] top-1/2 size-3 -translate-y-1/2 rounded-full border-2 transition-all " + (on ? "border-brand bg-brand ring-4 ring-brand-soft" : "border-[#9DB5B0] bg-white")} />
                {i.label}
                {i.slug === "requests" && open > 0 && <span className="ml-auto grid h-[22px] min-w-[22px] place-items-center rounded-md bg-amber-badge px-1.5 text-xs font-bold text-[#3A2A00]">{open}</span>}
              </a>
            )
          })}
        </nav>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="mb-3 font-bold text-navy">Speak to a person</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {tiles.map((t) => {
            const Icon = t.icon
            return (
              <button key={t.label} onClick={() => onContact(t.category, "Request: " + t.label)}
                className={"flex flex-col items-start gap-2.5 rounded-xl border p-3.5 text-left text-sm font-semibold leading-tight transition hover:-translate-y-0.5 " +
                  (t.category === null ? "col-span-2 min-h-[52px] flex-row items-center border-brand bg-brand text-white hover:bg-brand-dark" : t.wide ? "col-span-2 min-h-[52px] flex-row items-center border-line bg-white text-navy hover:border-brand hover:bg-brand-soft" : "min-h-[88px] border-line bg-white text-navy hover:border-brand hover:bg-brand-soft")}>
                <Icon className="size-6" />
                {t.label}
              </button>
            )
          })}
        </div>
      </section>
    </aside>
  )
}
