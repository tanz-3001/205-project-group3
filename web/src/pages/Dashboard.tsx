import { ArrowRight, BookOpen, Coins, HeartHandshake, HeartPulse, Monitor, Search, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react"
import { useState } from "react"
import type { FormEvent, ReactNode } from "react"
import { CitedText, SourceList } from "@/components/AssistSources"
import { Button } from "@/components/ui/button"
import { PromptComposer } from "@/components/ui/prompt-composer"
import { Suggestions } from "@/components/ui/suggestions"
import SupportMap from "@/components/SupportMap"
import { useApp } from "@/lib/app-context"
import type { Chat, Msg } from "@/lib/app-context"
import { answerChat, sourceById } from "@/lib/assist"
import type { Reply } from "@/lib/assist"
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
const toTranscript = (m: Msg[]) => m.map((x) => (x.r === "u" ? "Student: " : "Assist: ") + x.t)

function Tag({ topic }: { topic: string }) {
  const t = TINTS[topic] ?? ["#D6ECEA", "#0B6B63"]
  return <span className="ml-6 mt-5 inline-block rounded-md px-3 py-0.5 text-[0.82rem] font-bold" style={{ background: t[0], color: t[1] }}>{label(topic)}</span>
}

function Card({ topic, children }: { topic: string; children: ReactNode }) {
  const t = TINTS[topic] ?? ["#D6ECEA", "#0B6B63"]
  return (
    <article className="mb-3 overflow-hidden rounded-xl border border-t-4 border-line bg-white animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ borderTopColor: t[1] }}>
      <Tag topic={topic} />
      <div className="px-6 pb-6 pt-3">{children}</div>
    </article>
  )
}

export default function Dashboard({ onContact }: { onContact: (category: string | null, q: string, transcript?: string[]) => void }) {
  const { addEntry, rate, saveChat, setActiveChatId } = useApp()
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState("")
  const [result, setResult] = useState<{ q: string; reply: Reply; chat: Chat } | null>(null)
  const [rated, setRated] = useState<boolean | null>(null)
  const [filter, setFilter] = useState("")
  const { student } = useAuth()
  const firstName = (student?.name ?? "").trim().split(/\s+/)[0]

  const run = async (raw: string) => {
    const q = raw.trim().slice(0, 500)
    if (!q || busy) return
    setAsking(q)
    setResult(null)
    setRated(null)
    setBusy(true)
    const t0 = performance.now()
    try {
      const reply = await answerChat(q, [], student?.token)
      const ms = Math.round(performance.now() - t0)
      const msg: Msg =
        reply.k === "answer"
          ? { r: "a", k: "answer", t: reply.text, src: reply.src, ...(reply.cites ? { cites: reply.cites } : {}) }
          : { r: "a", k: "escalate", t: reply.text, category: reply.category, urgent: reply.urgent }
      const now = Date.now()
      const newChat: Chat = { id: now, title: q.slice(0, 48), at: now, msgs: [{ r: "u", t: q }, msg] }
      saveChat(newChat)
      setActiveChatId(newChat.id)
      addEntry({
        q,
        tag: reply.k === "answer" ? (reply.cites ? "Knowledge base" : (sourceById(reply.src[0])?.topic ?? "General")) : reply.category,
        type: reply.k === "answer" ? "answered" : reply.unknown ? "unknown" : "escalated",
        ms,
        via: "ask",
      })
      setResult({ q, reply, chat: newChat })
    } finally {
      setBusy(false)
    }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run(text)
  }

  const f = filter.trim().toLowerCase()
  const topics = TOPIC_PAGES.filter((p) => !f || p.title.toLowerCase().includes(f) || FAQS.some((x) => x.topic === p.topic && (x.q + " " + x.keywords).toLowerCase().includes(f)))

  const answerTopic =
    result?.reply.k === "answer"
      ? result.reply.cites
        ? "Knowledge base"
        : (sourceById(result.reply.src[0])?.topic ?? "General")
      : "Support"

  return (
    <div>
      <section className="home-hero mb-7" data-reveal>
        <div className="home-hero__texture" aria-hidden="true" />
        <div className="home-hero__content">
          <p className="home-hero__eyebrow"><span className="home-hero__eyebrow-mark">S</span> STUDENT SERVICES</p>
          <h1 className="home-hero__title">Hi, <em>{firstName}.</em></h1>
          <p className="home-hero__description">Ask your question. Find your answer.</p>
          <PromptComposer value={text} busy={busy} onValueChange={setText} onSubmit={submit} />
          <div className="home-hero__suggestions">
            <span>TRY ASKING</span>
            <Suggestions variant="dark" items={CHIPS.map((chip) => ({ id: chip, label: chip }))} onSelect={(item) => { if (busy) return; setText(item.label); void run(item.label) }} />
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

      <div aria-live="polite" data-reveal>
        {busy && (
          <Card topic="Synapse Assist">
            <h2 className="mb-2 flex items-center gap-2 text-2xl font-bold leading-tight text-navy">
              <Sparkles aria-hidden="true" className="size-5 text-brand" />
              {asking}
            </h2>
            <p className="flex items-center gap-2.5 text-muted-ink">
              <span className="size-2.5 animate-pulse rounded-full bg-brand" />
              Checking official university sources with Synapse Assist…
            </p>
          </Card>
        )}
        {!busy && result?.reply.k === "answer" && (
          <Card topic={answerTopic}>
            <h2 className="mb-2.5 text-2xl font-bold leading-tight text-navy">{result.q}</h2>
            <p className="mb-4 max-w-[64ch] text-lg leading-relaxed">
              <CitedText text={result.reply.text} src={result.reply.src} />
            </p>
            <SourceList src={result.reply.src} cites={result.reply.cites} />
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {rated === null ? (
                <>
                  <span className="font-semibold">Was this helpful?</span>
                  <Button variant="outline" onClick={() => { rate(true); setRated(true) }}><ThumbsUp className="size-4" />Yes</Button>
                  <Button variant="outline" onClick={() => { rate(false); setRated(false) }}><ThumbsDown className="size-4" />Not quite</Button>
                </>
              ) : (
                <span className="font-semibold">{rated ? "Thanks." : "Thanks. Staff can help with this one."}</span>
              )}
              <Button variant="outline" onClick={() => { setActiveChatId(result.chat.id); go("assist") }}>
                <Sparkles className="size-4" />Continue in Synapse Assist
              </Button>
              <Button
                className="bg-brand text-white hover:bg-brand-dark"
                onClick={() => onContact(result.reply.k === "answer" ? (sourceById(result.reply.src[0])?.topic ?? null) : null, result.q, toTranscript(result.chat.msgs))}
              >
                Contact staff
              </Button>
            </div>
          </Card>
        )}
        {!busy && result?.reply.k === "escalate" && result.reply.unknown && (
          <Card topic="Support">
            <h2 className="mb-2.5 text-2xl font-bold text-navy">Not sure about that one</h2>
            <p className="mb-4 max-w-[64ch] text-lg">{result.reply.text}</p>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button variant="outline" onClick={() => { setActiveChatId(result.chat.id); go("assist") }}>
                <Sparkles className="size-4" />Continue in Synapse Assist
              </Button>
              <Button className="bg-brand text-white hover:bg-brand-dark" onClick={() => onContact(null, result.q, toTranscript(result.chat.msgs))}>
                Contact staff
              </Button>
            </div>
          </Card>
        )}
        {!busy && result?.reply.k === "escalate" && !result.reply.unknown && (
          <Card topic="Support">
            <p className="mb-1 text-sm font-bold text-muted-ink">{result.reply.category}</p>
            <h2 className="mb-2.5 flex items-center gap-2 text-2xl font-bold leading-tight text-navy">
              <HeartHandshake aria-hidden="true" className="size-6 text-brand" />
              This request should be handled by a member of staff.
            </h2>
            <p className="mb-4 max-w-[64ch] text-lg">{result.reply.text}</p>
            {result.reply.urgent && <p className="mb-4 rounded-lg bg-[#FBEFD0] px-3 py-2 text-lg font-bold text-[#5C4300]">In an emergency, call 999.</p>}
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                className="bg-brand text-white hover:bg-brand-dark"
                onClick={() => onContact(result.reply.k === "escalate" ? result.reply.category : null, result.q, toTranscript(result.chat.msgs))}
              >
                Speak to a person
              </Button>
              <Button variant="outline" onClick={() => { setActiveChatId(result.chat.id); go("assist") }}>
                <Sparkles className="size-4" />Open in Synapse Assist
              </Button>
            </div>
          </Card>
        )}
      </div>

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
