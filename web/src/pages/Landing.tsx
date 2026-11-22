import { ArrowRight, FileText, Sparkles } from "lucide-react"
import { FAQS, TINTS, TOPIC_PAGES } from "@/lib/data"

const label = (t: string) => (t === "IT" ? "IT Support" : t)

const PILLARS = [
  {
    title: "1. Official sources only",
    text: "Answers come from approved university documents in Synapse Knowledge, with the exact document, page and section shown.",
  },
  {
    title: "2. People when it matters",
    text: "Appeals, financial hardship, wellbeing and legal questions are detected by Synapse Guard and routed directly to staff—never guessed by AI.",
  },
  {
    title: "3. Track your requests",
    text: "Follow every open staff request in one place from submission to resolution, while administrators monitor live service trends.",
  },
]

export default function Landing() {
  const policyTint = TINTS.Policies ?? ["#F4DAD3", "#6A2B1A"]

  return (
    <div className="app-canvas min-h-screen bg-page text-ink">
      {/* Same TopBar treatment as the student and admin portals */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#12353a]/95 text-white shadow-[0_12px_28px_-24px_rgba(11,40,45,0.8)] backdrop-blur-xl">
        <div className="h-[3px] bg-white/10"><span className="block h-full w-1/3 bg-[#f1bd61]" /></div>
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-7 lg:px-10">
          <a href="#" className="group flex shrink-0 items-center gap-3">
            <span className="relative grid size-10 place-items-center overflow-hidden rounded-[14px] border border-white/20 bg-[#1e615e] text-white shadow-inner">
              <Sparkles aria-hidden="true" className="size-[18px] transition-transform duration-500 group-hover:rotate-12" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-[1.06rem] font-semibold tracking-[-0.035em]">Synapse</span>
              <span className="mt-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/55">Student portal</span>
            </span>
          </a>

          <div className="flex items-center gap-2">
            <a
              href="#admin"
              className="inline-flex h-10 items-center rounded-xl px-3.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              Admin sign-in
            </a>
            <a
              href="#login"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#f4c86f] px-4 text-xs font-bold text-[#253b35] transition-colors hover:bg-[#ffda8c]"
            >
              Sign in <ArrowRight aria-hidden="true" className="size-3.5" />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-6 sm:px-7 lg:px-10 lg:pt-9">
        {/* 1. Simple Hero using existing .home-hero styles */}
        <section className="home-hero mb-8">
          <div className="home-hero__texture" aria-hidden="true" />
          <div className="home-hero__content">
            <p className="home-hero__eyebrow">
              <span className="home-hero__eyebrow-mark">S</span> STUDENT SERVICES PORTAL
            </p>
            <h1 className="home-hero__title">
              Clear answers from <em>official sources.</em>
            </h1>
            <p className="home-hero__description">
              Ask a question on enrollment, fees, policies, timetables, exams or IT. Every answer shows its university source—and sensitive topics go straight to a member of staff.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#login"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#f4c86f] px-5 text-sm font-bold text-[#253b35] transition-colors hover:bg-[#ffda8c]"
              >
                Student sign in <ArrowRight aria-hidden="true" className="size-4" />
              </a>
              <a
                href="#admin"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/15"
              >
                Admin sign in
              </a>
            </div>
          </div>

          {/* Simple clean answer preview card on the right */}
          <div className="self-center rounded-2xl border border-line bg-white p-5 text-ink shadow-lg sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span
                className="inline-block rounded-md px-3 py-0.5 text-[0.82rem] font-bold"
                style={{ background: policyTint[0], color: policyTint[1] }}
              >
                Policies
              </span>
              <span className="text-xs font-semibold text-muted-ink">Synapse Assist</span>
            </div>
            <h2 className="mb-2 text-xl font-bold leading-snug text-navy">What is the late submission policy?</h2>
            <p className="mb-4 text-sm leading-relaxed text-ink">
              Late work loses 10 percent of the available marks for each calendar day it is late, up to a maximum of 5 calendar days, unless you have an approved extension
              <sup className="mx-1 rounded bg-brand-soft px-1.5 py-0.5 text-[0.7rem] font-bold text-brand">1</sup>.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-[#A9BDB9] bg-page px-3 py-2 text-xs text-muted-ink">
              <FileText aria-hidden="true" className="size-4 shrink-0 text-brand" />
              <span>
                <strong className="text-navy">Source:</strong> Academic Regulations 2026 · Page 1, Section 3.2
              </span>
            </div>
          </div>
        </section>

        {/* 2. Three simple feature cards */}
        <section className="grid gap-3 sm:grid-cols-3" aria-label="How Synapse works">
          {PILLARS.map((item) => (
            <article key={item.title} className="rounded-xl border border-line bg-white p-5">
              <h2 className="text-base font-bold text-navy">{item.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-ink">{item.text}</p>
            </article>
          ))}
        </section>

        {/* 3. Existing Browse by service grid using TOPIC_PAGES & TINTS */}
        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.13em] text-brand">Browse by service</p>
              <h2 className="text-2xl font-semibold tracking-tight text-navy">Find the right team</h2>
            </div>
            <a href="#login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
              Sign in to explore all guides <ArrowRight aria-hidden="true" className="size-4" />
            </a>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(235px,1fr))] gap-3">
            {TOPIC_PAGES.map((p) => {
              const Icon = p.icon
              const t = TINTS[p.topic]
              const count = FAQS.filter((x) => x.topic === p.topic).length
              return (
                <a
                  key={p.slug}
                  href="#login"
                  className="group flex min-h-[96px] items-center gap-3.5 rounded-xl border border-line/90 bg-white p-4 transition-colors hover:border-brand/45 hover:bg-[#fbfdfc] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ background: t[0], color: t[1] }}>
                    <Icon className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <strong className="text-[0.96rem] font-semibold text-navy">{label(p.topic)}</strong>
                    <span className="mt-0.5 text-sm text-muted-ink">{count === 1 ? "1 answer" : `${count} answers`}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-ink transition-colors group-hover:text-brand" />
                </a>
              )
            })}
          </div>
        </section>

        <p className="mt-8 border-t border-line/80 pt-4 text-xs text-muted-ink">
          Synapse student services <span className="px-1.5 text-brand/70">/</span> Demo accounts: <b>S2041877</b> or <b>student@demo.ac.ae</b> (Student#123) · Admin &amp; Knowledge: <b>admin@demo.ac.ae</b> (Admin#123)
        </p>
      </main>
    </div>
  )
}
