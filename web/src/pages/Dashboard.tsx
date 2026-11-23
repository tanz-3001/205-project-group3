import { ArrowRight, BookOpen, Coins, HeartPulse, Monitor, Search } from "lucide-react"
import { useState } from "react"
import type { FormEvent } from "react"
import { PromptComposer } from "@/components/ui/prompt-composer"
import { Suggestions } from "@/components/ui/suggestions"
import SupportMap from "@/components/SupportMap"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth"
import { FAQS, TINTS, TOPIC_PAGES } from "@/lib/data"
import { go } from "@/lib/route"

const CHIPS = ["Add or drop a course", "Library hours & study rooms", "Campus shuttle & housing", "Reset my password"]
const SERVICE_ROUTES = [
  { label: "Courses", href: "#enrollment", icon: BookOpen, position: "hero-network__node--northwest" },
  { label: "Fees", href: "#fees", icon: Coins, position: "hero-network__node--northeast" },
  { label: "IT support", href: "#it", icon: Monitor, position: "hero-network__node--southwest" },
  { label: "Wellbeing", href: "#support", icon: HeartPulse, position: "hero-network__node--southeast" },
]
const label = (t: string) => (t === "IT" ? "IT Support" : t)

export default function Dashboard({ onContact }: { onContact: (category: string | null, q: string, transcript?: string[]) => void }) {
  const { setActiveChatId, setPendingPrompt } = useApp()
  const [text, setText] = useState("")
  const [filter, setFilter] = useState("")
  const { student } = useAuth()
  const firstName = (student?.name ?? "").trim().split(/\s+/)[0]

  const askInAssist = (raw: string) => {
    const q = raw.trim().slice(0, 500)
    if (!q) return
    setText("")
    setActiveChatId(null)
    setPendingPrompt(q)
    go("assist")
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    askInAssist(text)
  }

  const f = filter.trim().toLowerCase()
  const topics = TOPIC_PAGES.filter((p) => !f || p.title.toLowerCase().includes(f) || FAQS.some((x) => x.topic === p.topic && (x.q + " " + x.keywords).toLowerCase().includes(f)))

  return (
    <div>
      <section className="home-hero mb-7" data-reveal>
        <div className="home-hero__texture" aria-hidden="true" />
        <div className="home-hero__content">
          <p className="home-hero__eyebrow"><span className="home-hero__eyebrow-mark">S</span> STUDENT SERVICES</p>
          <h1 className="home-hero__title">Hi, <em>{firstName}.</em></h1>
          <p className="home-hero__description">Ask your question. Find your answer.</p>
          <PromptComposer value={text} onValueChange={setText} onSubmit={submit} />
          <div className="home-hero__suggestions">
            <span>TRY ASKING</span>
            <Suggestions variant="dark" items={CHIPS.map((chip) => ({ id: chip, label: chip }))} onSelect={(item) => askInAssist(item.label)} />
          </div>
        </div>
        <div className="hero-network" aria-label="Service map: courses, fees, IT support, and wellbeing">
          <div className="hero-network__meta"><span>THE SERVICE MAP</span><span>04 ROUTES</span></div>
          <svg aria-hidden="true" viewBox="0 0 360 300" className="hero-network__lines">
            <path d="M68 66 C117 66 125 114 180 150 S244 236 292 236" />
            <path d="M292 66 C244 66 235 114 180 150 S116 236 68 236" />
            <path d="M68 66 C118 114 239 194 292 236" />
            <path d="M292 66 C240 114 120 194 68 236" />
            <circle cx="180" cy="150" r="53" />
            <circle cx="180" cy="150" r="69" />
          </svg>
          <div className="hero-network__hub"><span>YOU</span><strong>Start<br />here</strong><i /></div>
          {SERVICE_ROUTES.map((service) => {
            const Icon = service.icon
            return (
              <a key={service.label} href={service.href} className={`hero-network__node ${service.position}`}>
                <span><Icon aria-hidden="true" className="size-[17px]" /></span>{service.label}
              </a>
            )
          })}
        </div>
      </section>

      <section className="mt-10" data-reveal>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.13em] text-brand">Browse by service</p>
            <h2 className="text-2xl font-semibold tracking-tight text-navy">Find the right team</h2>
          </div>
          <label className="relative flex items-center text-sm text-muted-ink">
            <span className="sr-only">Find a topic</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 size-4" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search services" className="min-h-11 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-base text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-soft sm:w-56" />
          </label>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(235px,1fr))] gap-3">
          {topics.map((p) => {
            const Icon = p.icon
            const t = TINTS[p.topic]
            return (
              <a key={p.slug} href={"#" + p.slug} className="group flex min-h-[96px] items-center gap-3.5 rounded-xl border border-line/90 bg-white p-4 transition-colors hover:border-brand/45 hover:bg-[#fbfdfc] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ background: t[0], color: t[1] }}><Icon className="size-5" /></span>
                <span className="flex min-w-0 flex-1 flex-col"><strong className="text-[0.96rem] font-semibold text-navy">{label(p.topic)}</strong><span className="mt-0.5 text-sm text-muted-ink">{FAQS.filter((x) => x.topic === p.topic).length === 1 ? "1 answer" : `${FAQS.filter((x) => x.topic === p.topic).length} answers`}</span></span>
                <ArrowRight className="size-4 shrink-0 text-muted-ink transition-colors group-hover:text-brand" />
              </a>
            )
          })}
          {topics.length === 0 && <p className="text-muted-ink">No topics match your search.</p>}
        </div>
      </section>
      <SupportMap onContact={onContact} />
    </div>
  )
}
