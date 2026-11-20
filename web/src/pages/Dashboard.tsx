import { ArrowRight, FileText, ThumbsDown, ThumbsUp } from "lucide-react"
import { useState } from "react"
import type { FormEvent, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { useApp } from "@/lib/app-context"
import { ask } from "@/lib/assist"
import type { Outcome } from "@/lib/assist"
import { FAQS, TINTS, TOPIC_PAGES } from "@/lib/data"
import type { FAQ } from "@/lib/data"

const CHIPS = ["Reset my password", "Pay my fees", "Add or drop a course", "Exam schedule"]
const label = (t: string) => (t === "IT" ? "IT Support" : t)

function Tag({ topic }: { topic: string }) {
  const t = TINTS[topic] ?? ["#E6E9EF", "#1A2233"]
  return <span className="ml-6 mt-5 inline-block rounded-md px-3 py-0.5 text-[0.82rem] font-bold" style={{ background: t[0], color: t[1] }}>{label(topic)}</span>
}

function Card({ topic, children }: { topic: string; children: ReactNode }) {
  const t = TINTS[topic] ?? ["#E6E9EF", "#1A2233"]
  return (
    <article className="mb-3 overflow-hidden rounded-xl border border-t-4 border-line bg-white animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ borderTopColor: t[1] }}>
      <Tag topic={topic} />
      <div className="px-6 pb-6 pt-3">{children}</div>
    </article>
  )
}

export default function Dashboard({ onContact }: { onContact: (category: string | null, q: string) => void }) {
  const { addEntry, rate } = useApp()
  const [text, setText] = useState("")
  const [asked, setAsked] = useState("")
  const [out, setOut] = useState<Outcome | null>(null)
  const [rated, setRated] = useState<boolean | null>(null)
  const [filter, setFilter] = useState("")

  const showFaq = (faq: FAQ) => {
    setRated(null)
    setOut({ kind: "answer", faq })
    addEntry({ q: faq.q, tag: faq.topic, type: "answered" })
  }
  const run = (raw: string) => {
    const q = raw.trim()
    if (!q) return
    setAsked(q)
    setRated(null)
    const o = ask(q)
    setOut(o)
    if (o.kind === "answer") addEntry({ q: o.faq.q, tag: o.faq.topic, type: "answered" })
    else if (o.kind === "escalate") addEntry({ q, tag: o.category, type: "escalated" })
    else addEntry({ q, tag: "General", type: "unknown" })
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(text)
  }

  const f = filter.trim().toLowerCase()
  const topics = TOPIC_PAGES.filter((p) => !f || p.title.toLowerCase().includes(f) || FAQS.some((x) => x.topic === p.topic && (x.q + " " + x.keywords).toLowerCase().includes(f)))

  return (
    <div>
      <section className="mb-5 rounded-xl border border-line bg-white p-6">
        <h1 className="mb-1.5 text-3xl font-bold leading-tight tracking-tight text-navy sm:text-4xl">How can we help you today?</h1>
        <p className="mb-5 text-muted-ink">Search official policies and FAQs, or contact a member of staff.</p>
        <form onSubmit={submit} className="flex flex-wrap gap-2 rounded-xl border-2 border-navy bg-white p-1.5 focus-within:ring-4 focus-within:ring-brand-soft">
          <label htmlFor="ask-input" className="sr-only">Ask a question</label>
          <input id="ask-input" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" placeholder="Type your question, for example: How do I reset my password?" className="min-h-12 flex-1 basis-56 bg-transparent px-3 text-lg outline-none" />
          <Button type="submit" className="h-12 bg-brand px-7 text-base font-bold text-white hover:bg-brand-dark">Search</Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <button key={c} onClick={() => { setText(c); run(c) }} className="min-h-11 rounded-lg border border-line bg-white px-3.5 text-sm font-semibold text-navy transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand">{c}</button>
          ))}
        </div>
      </section>

      <div aria-live="polite">
        {out?.kind === "answer" && (
          <Card topic={out.faq.topic}>
            <h2 className="mb-2.5 text-2xl font-bold leading-tight text-navy">{out.faq.q}</h2>
            <p className="mb-4 max-w-[64ch] text-lg leading-relaxed">{out.faq.a}</p>
            <p className="mb-5 inline-flex items-center gap-2 rounded-md border border-dashed border-[#A9BDB9] px-3 py-1.5 text-sm text-muted-ink"><FileText className="size-4" />Source: {out.faq.source}</p>
            <div className="flex flex-wrap items-center gap-2.5">
              {rated === null ? (
                <>
                  <span className="font-semibold">Was this helpful?</span>
                  <Button variant="outline" onClick={() => { rate(true); setRated(true) }}><ThumbsUp className="size-4" />Yes</Button>
                  <Button variant="outline" onClick={() => { rate(false); setRated(false) }}><ThumbsDown className="size-4" />Not quite</Button>
                </>
              ) : (
                <span className="font-semibold">{rated ? "Thanks." : "Thanks. Staff can help with this one."}</span>
              )}
              <Button className="bg-brand text-white hover:bg-brand-dark" onClick={() => onContact(out.faq.topic, asked || out.faq.q)}>Contact staff</Button>
            </div>
          </Card>
        )}
        {out?.kind === "options" && (
          <Card topic="Support">
            <h2 className="mb-3 text-2xl font-bold text-navy">Did you mean one of these?</h2>
            <ul className="mb-4 divide-y divide-line">
              {out.items.map((x) => (
                <li key={x.q}><button onClick={() => showFaq(x)} className="flex min-h-14 w-full items-center justify-between gap-3 text-left text-lg hover:text-brand">{x.q}<ArrowRight className="size-5" /></button></li>
              ))}
            </ul>
            <Button variant="outline" onClick={() => onContact(null, asked)}>None of these, contact staff</Button>
          </Card>
        )}
        {out?.kind === "escalate" && (
          <Card topic="Support">
            <p className="mb-1 text-sm font-bold text-muted-ink">{out.category}</p>
            <h2 className="mb-2.5 text-2xl font-bold leading-tight text-navy">This request should be handled by a member of staff.</h2>
            <p className="mb-4 max-w-[64ch] text-lg">{out.category === "Wellbeing" ? "You don’t have to sort this out alone. Staff will read your message and reply." : "Staff will get your request as written, so you won’t need to repeat it."}</p>
            {out.urgent && <p className="mb-4 text-lg font-bold">In an emergency, call 999.</p>}
            <Button className="bg-brand text-white hover:bg-brand-dark" onClick={() => onContact(out.category, asked)}>Contact staff</Button>
          </Card>
        )}
        {out?.kind === "unknown" && (
          <Card topic="Support">
            <h2 className="mb-2.5 text-2xl font-bold text-navy">Not sure about that one</h2>
            <p className="mb-4 max-w-[64ch] text-lg">I couldn’t find a good answer to that. Staff can take it from here.</p>
            <Button className="bg-brand text-white hover:bg-brand-dark" onClick={() => onContact(null, asked)}>Contact staff</Button>
          </Card>
        )}
      </div>

      <section className="mt-5 rounded-xl border border-line bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-navy">Topics</h2>
          <label className="flex items-center gap-2 text-sm text-muted-ink">
            <span className="sr-only">Find a topic</span>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a topic" className="min-h-11 rounded-lg border border-line bg-page px-3 text-base text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand" />
          </label>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
          {topics.map((p) => {
            const Icon = p.icon
            const t = TINTS[p.topic]
            return (
              <a key={p.slug} href={"#" + p.slug} className="group flex items-center gap-4 rounded-xl border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md">
                <span className="grid size-14 place-items-center rounded-xl transition-transform group-hover:scale-105" style={{ background: t[0], color: t[1] }}><Icon className="size-6" /></span>
                <span className="flex flex-1 flex-col"><strong className="text-navy">{label(p.topic)}</strong><span className="text-sm text-muted-ink">{FAQS.filter((x) => x.topic === p.topic).length} questions</span></span>
                <ArrowRight className="size-[18px] text-muted-ink transition-transform group-hover:translate-x-1 group-hover:text-brand" />
              </a>
            )
          })}
          {topics.length === 0 && <p className="text-muted-ink">No topics match your search.</p>}
        </div>
      </section>
    </div>
  )
}
