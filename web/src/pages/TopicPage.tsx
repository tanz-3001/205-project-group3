import { Check } from "lucide-react"
import type { ReactNode } from "react"
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
    <section className="mb-5 rounded-xl border border-line bg-white p-6">
      <h2 className="mb-4 text-lg font-bold text-navy">{title}</h2>
      {children}
    </section>
  )
}

function BlockView({ block, onContact }: { block: Block; onContact: Contact }) {
  if (block.kind === "note") {
    return <section className="mb-5 rounded-xl border border-[#EBD59C] bg-[#FBEFD0] p-6 text-[#5C4300]"><strong>In an emergency, call 999.</strong> For urgent wellbeing concerns, please also contact a member of staff.</section>
  }
  if (block.kind === "steps") {
    return (
      <Section title={block.title}>
        <ol className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          {block.items.map(([h, p], i) => (
            <li key={h} className="flex flex-col gap-1.5 rounded-xl border border-line bg-page p-[18px] transition hover:-translate-y-0.5 hover:border-brand">
              <span className="grid size-[34px] place-items-center rounded-full bg-brand font-bold text-white">{i + 1}</span>
              <strong className="text-navy">{h}</strong>
              <span className="text-[0.93rem] text-muted-ink">{p}</span>
            </li>
          ))}
        </ol>
      </Section>
    )
  }
  if (block.kind === "timeline") {
    return (
      <Section title={block.title}>
        <ol className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-5">
          {block.items.map(([h, p], i) => (
            <li key={h} className="relative flex flex-col gap-1 border-t-2 border-line pt-6">
              <span className={"absolute -top-[9px] left-0 size-4 rounded-full border-[3px] border-brand " + (i === 0 ? "bg-brand" : "bg-white")} />
              <strong className="text-navy">{h}</strong>
              <span className="text-[0.93rem] text-muted-ink">{p}</span>
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
              <div key={c.title} className="flex flex-col items-start gap-2 rounded-xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="grid size-[52px] place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-6" /></span>
                <strong className="text-lg text-navy">{c.title}</strong>
                <p className="mb-1 flex-1 text-muted-ink">{c.text}</p>
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
      <header className="mb-5 flex flex-col items-start gap-5 rounded-xl border border-line p-7 sm:flex-row sm:items-center" style={{ background: t[0] }}>
        <span className="grid size-[76px] flex-none place-items-center rounded-full bg-white" style={{ color: t[1] }}><Icon className="size-9" /></span>
        <div>
          <h1 className="mb-1 text-3xl font-bold leading-tight sm:text-4xl" style={{ color: t[1] }}>{page.title}</h1>
          <p className="max-w-[56ch] text-lg text-ink">{page.lead}</p>
        </div>
      </header>
      <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
        {page.glance.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1 rounded-xl border border-line bg-white px-[18px] py-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-ink">{k}</span>
            <strong className="text-navy">{v}</strong>
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
      <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-brand-soft p-6">
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
