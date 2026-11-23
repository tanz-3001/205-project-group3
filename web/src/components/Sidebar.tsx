import { ArrowUpRight, BadgeHelp, BookOpen, ClipboardList, Coins, HeartHandshake, LayoutDashboard, Library, Scale, ShieldCheck, Sparkles } from "lucide-react"
import { useApp } from "@/lib/app-context"
import { isKnowledgeAdmin, useAuth } from "@/lib/auth"

const baseItems = [
  { slug: "ask", label: "Overview", icon: LayoutDashboard },
  { slug: "assist", label: "Synapse Assist", icon: Sparkles },
  { slug: "requests", label: "My requests", icon: ClipboardList },
]
const helpTiles = [
  { label: "Academic appeal", category: "Academic appeals", icon: Scale },
  { label: "Money support", category: "Financial help", icon: Coins },
  { label: "Wellbeing", category: "Wellbeing", icon: HeartHandshake },
]

export default function Sidebar({ route, onContact }: { route: string; onContact: (category: string | null, q: string) => void }) {
  const { requests } = useApp()
  const { student, admin } = useAuth()
  const items = isKnowledgeAdmin(student, admin)
    ? [...baseItems, { slug: "knowledge", label: "Synapse Knowledge", icon: Library }, { slug: "admin", label: "Admin dashboard", icon: ShieldCheck }]
    : baseItems
  const initials = (student?.name ?? "").split(/\s+/).map((p) => p[0]).join("").slice(0, 2)
  const open = requests.filter((r) => r.status !== "Resolved").length

  return (
    <aside className="space-y-4" aria-label="Student portal navigation">
      <section className="student-card" data-reveal>
        <div className="student-card__top"><span>YOUR SPACE</span><span className="student-card__status"><i /> Signed in</span></div>
        <div className="student-card__identity">
          <span className="student-card__avatar" aria-hidden="true">{initials}</span>
          <div><p>{student?.name}</p><span>{student?.role}</span></div>
          <BookOpen aria-hidden="true" className="ml-auto size-5 text-white/55" />
        </div>
        <div className="student-card__rule" />
      </section>

      <section className="sidebar-panel" data-reveal>
        <div className="sidebar-panel__heading"><span>WORKSPACE</span><span>01—0{items.length}</span></div>
        <nav aria-label="Student menu" className="space-y-1">
          {items.map((item, index) => {
            const Icon = item.icon
            const on = route === item.slug
            return (
              <a key={item.slug} href={"#" + item.slug} aria-current={on ? "page" : undefined}
                className={"sidebar-link " + (on ? "sidebar-link--active" : "")}>
                <span className="sidebar-link__number">0{index + 1}</span>
                <Icon aria-hidden="true" className="size-[17px]" />
                <span className="flex-1">{item.label}</span>
                {item.slug === "requests" && open > 0 && <span className="sidebar-link__count">{open}</span>}
                {on && <span className="sidebar-link__active-dot" />}
              </a>
            )
          })}
        </nav>
      </section>

      <section className="sidebar-panel sidebar-panel--help" data-reveal>
        <div className="sidebar-panel__heading"><span>HUMAN SUPPORT</span><HeartHandshake aria-hidden="true" className="size-4" /></div>
        <div className="space-y-1">
          {helpTiles.map((tile) => {
            const Icon = tile.icon
            return (
              <button key={tile.label} type="button" onClick={() => onContact(tile.category, "Request: " + tile.label)} className="help-link group">
                <span className="help-link__icon"><Icon aria-hidden="true" className="size-4" /></span>
                <span>{tile.label}</span>
                <ArrowUpRight aria-hidden="true" className="ml-auto size-4 text-muted-ink/60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </button>
            )
          })}
        </div>
        <button type="button" onClick={() => onContact(null, "I need help finding the right service.")} className="support-cta">
          <BadgeHelp aria-hidden="true" className="size-[17px]" /> Contact the team <ArrowUpRight aria-hidden="true" className="ml-auto size-4" />
        </button>
      </section>
    </aside>
  )
}
