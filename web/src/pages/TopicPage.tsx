import { Check } from "lucide-react"
import type { CSSProperties, ReactNode } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { FAQS, TINTS } from "@/lib/data"
import type { Block, PageDef } from "@/lib/data"
import { go } from "@/lib/route"

type Contact = (category: string | null, q: string) => void

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"]
const TIMES = ["09:00", "11:00", "13:00", "15:00"]
const LEC: [string, string, string] = ["Lecture", "#DCE6F7", "#0B4A63"]
const LAB: [string, string, string] = ["Lab", "#D3EBE0", "#0B5240"]
const TUT: [string, string, string] = ["Tutorial", "#F6E9C8", "#5A4300"]
const WKS: [string, string, string] = ["Workshop", "#E3DCF2", "#41307A"]
const SLOTS: Record<string, [string, string, string]> = { "0-0": LEC, "4-0": LAB, "2-0": LAB, "1-1": TUT, "3-1": LEC, "0-2": WKS, "4-2": LEC, "2-3": TUT }

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="topic-section" data-reveal>
      <div className="topic-section__heading"><span>YOUR GUIDE</span><h2>{title}</h2></div>
      {children}
    </section>
  )
}

function BlockView({ block, onContact }: { block: Block; onContact: Contact }) {
  if (block.kind === "note") {
    return <section className="emergency-note" data-reveal><strong>In an emergency, call 999.</strong> For urgent wellbeing concerns, please also contact a member of staff.</section>
  }
  if (block.kind === "steps") {
    return (
      <Section title={block.title}>
        <ol className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          {block.items.map(([h, p], i) => (
            <li key={h} className="step-card" style={{ animationDelay: `${i * 80}ms` }}>
              <span className="step-card__number">{String(i + 1).padStart(2, "0")}</span>
              <strong>{h}</strong>
              <span>{p}</span>
            </li>
          ))}
        </ol>
      </Section>
    )
  }
  if (block.kind === "timeline") {
    return (
      <Section title={block.title}>
        <ol className="journey-timeline">
          {block.items.map(([h, p], i) => (
            <li key={h} className="journey-timeline__step" style={{ animationDelay: `${i * 80}ms` }}>
              <span className="journey-timeline__marker">{String(i + 1).padStart(2, "0")}</span>
              <strong>{h}</strong>
              <span>{p}</span>
            </li>
          ))}
        </ol>
      </Section>
    )
  }
  if (block.kind === "check") {
    return (
      <Section title={block.title}>
        <ul className="flex flex-wrap gap-3">
          {block.items.map((t) => (
            <li key={t} className="flex items-center gap-2.5 rounded-xl border border-line bg-page px-4 py-3">
              <span className="grid size-7 place-items-center rounded-full bg-brand-soft text-brand"><Check className="size-4" /></span>{t}
            </li>
          ))}
        </ul>
      </Section>
    )
  }
  if (block.kind === "cards") {
    return (
      <Section title={block.title}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          {block.items.map((c) => {
            const Icon = c.icon
            return (
              <div key={c.title} className="topic-action-card">
                <span className="topic-action-card__icon"><Icon className="size-5" /></span>
                <strong>{c.title}</strong>
                <p>{c.text}</p>
                {c.action && <Button variant="outline" onClick={() => onContact(c.action?.category ?? null, "Request: " + (c.action?.category ?? c.title))}>{c.action.label}</Button>}
              </div>
            )
          })}
        </div>
      </Section>
    )
  }
  return (
    <Section title={block.title}>
      <div className="overflow-x-auto">
        <div className="grid min-w-[520px] grid-cols-[56px_repeat(5,1fr)] gap-1.5">
          <span />
          {DAYS.map((d) => <b key={d} className="p-1.5 text-center text-sm text-navy">{d}</b>)}
          {TIMES.map((t, r) => (
            <div key={t} className="contents">
              <em className="self-center text-xs not-italic text-muted-ink">{t}</em>
              {DAYS.map((d, c) => {
                const s = SLOTS[`${c}-${r}`]
                return s ? <span key={d} className="grid min-h-[54px] place-items-center rounded-lg text-sm font-semibold" style={{ background: s[1], color: s[2] }}>{s[0]}</span> : <span key={d} className="min-h-[54px] rounded-lg bg-page" />
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-ink">Example timetable. Yours appears in the student portal under My Classes.</p>
    </Section>
  )
}

export default function TopicPage({ page, onContact }: { page: PageDef; onContact: Contact }) {
  const Icon = page.icon
  const t = TINTS[page.topic]
  const faqs = FAQS.filter((f) => f.topic === page.topic)

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-3.5 text-sm text-muted-ink">
        <a href="#ask" className="font-semibold text-brand hover:underline">Dashboard</a> / {page.group ? page.group + " / " : ""}<span>{page.title}</span>
      </nav>
      <header className="topic-hero mb-6" style={{ "--topic-wash": t[0], "--topic-ink": t[1] } as CSSProperties} data-reveal>
        <div className="topic-hero__copy">
          <span className="topic-hero__eyebrow">STUDENT GUIDE <i /> {page.group ?? "SERVICES"}</span>
          <h1>{page.title}</h1>
          <p>{page.lead}</p>
        </div>
        <span className="topic-hero__icon"><Icon aria-hidden="true" className="size-8" /></span>
        <span className="topic-hero__index">SYNAPSE <b>/{page.slug.toUpperCase()}</b></span>
      </header>
      <div className="glance-grid mb-6" data-reveal>
        {page.glance.map(([k, v]) => (
          <div key={k} className="glance-item">
            <span>{k}</span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      {page.blocks.map((b, i) => <BlockView key={i} block={b} onContact={onContact} />)}
      {faqs.length > 0 && (
        <Section title="Frequently asked questions">
          <Accordion type="single" collapsible>
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={"faq-" + i}>
                <AccordionTrigger className="text-base font-semibold text-navy hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent>
                  <p className="mb-2 max-w-[64ch] text-base">{f.a}</p>
                  <p className="text-sm text-muted-ink">Source: {f.source}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Section>
      )}
      <section className="topic-finish" data-reveal>
        <div>
          <h2 className="mb-1 text-lg font-bold text-navy">Still need help?</h2>
          <p className="text-muted-ink">Ask Synapse or contact a member of staff.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button className="bg-brand text-white hover:bg-brand-dark" onClick={() => go("ask")}>Ask Synapse</Button>
          <Button variant="outline" onClick={() => onContact(page.topic === "Support" ? null : page.topic, "Question about " + page.title.toLowerCase())}>Contact staff</Button>
        </div>
      </section>
    </div>
  )
}
