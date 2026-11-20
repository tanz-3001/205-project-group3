import { FAQS, TOPIC_PAGES } from "./data"
import type { FAQ } from "./data"
import type { Msg } from "./app-context"

const STOP = new Set("the a an i my me to do how what where when is are can of for and in on it get find need want have does there this that with about please you your our us we".split(" "))
const stem = (w: string) => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, "") : w)
const toks = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !STOP.has(w)).map(stem)
const INDEX = FAQS.map((f) => ({ f, K: new Set(toks(f.keywords)), Q: new Set(toks(f.q)) }))

export type Outcome =
  | { kind: "answer"; faq: FAQ }
  | { kind: "options"; items: FAQ[] }
  | { kind: "escalate"; category: string; urgent: boolean }
  | { kind: "unknown" }

export const isUrgent = (q: string) => /suicid|kill myself|end my life|self.?harm|hurt myself|abus|assault|unsafe|in danger/i.test(q)

export function sensitive(q: string): string | null {
  if (/appeal|dispute|unfair|plagiar|cheat/i.test(q)) return "Academic appeals"
  if (/hardship|afford/i.test(q)) return "Financial help"
  if (/struggl|stress|anxi|depress|overwhelm|panic|lonely|suicid|kill myself|end my life|self.?harm|harass|abus|assault|unsafe|hurt myself/i.test(q)) return "Wellbeing"
  if (/lawyer|legal|complain|discriminat|visa/i.test(q)) return "Legal and complaints"
  return null
}

export function ask(q: string): Outcome {
  const category = sensitive(q)
  if (category) return { kind: "escalate", category, urgent: isUrgent(q) }
  const words = [...new Set(toks(q))]
  const scored = INDEX.map(({ f, K, Q }) => ({ f, sc: words.reduce((n, w) => n + (K.has(w) ? 2 : Q.has(w) ? 1 : 0), 0) })).sort((a, b) => b.sc - a.sc)
  if (scored[0].sc >= 2 && scored[0].sc > scored[1].sc) return { kind: "answer", faq: scored[0].f }
  const near = scored.filter((x) => x.sc > 0).slice(0, 3).map((x) => x.f)
  return near.length ? { kind: "options", items: near } : { kind: "unknown" }
}

/* ---------- Synapse Assist chat ---------- */
export type Source = { id: string; doc: string; topic: string; passage: string; link?: { slug: string; title: string } }
export const SOURCES: Source[] = FAQS.map((f, i) => {
  const page = TOPIC_PAGES.find((p) => p.topic === f.topic)
  return { id: `s${i + 1}`, doc: f.source, topic: f.topic, passage: f.a, link: page ? { slug: page.slug, title: page.title } : undefined }
})
export const sourceById = (id: string) => SOURCES.find((s) => s.id === id)

export type Reply =
  | { k: "answer"; text: string; src: string[] }
  | { k: "escalate"; text: string; category: string; urgent: boolean }

const gap = (text: string, category = "General enquiry"): Reply => ({ k: "escalate", text, category, urgent: false })

/**
 * Safety order matters: sensitive topics and weak matches never reach the AI.
 * Only questions with a clear official source are sent to /api/assist, and the AI may only use those sources.
 */
export async function answerChat(q: string, earlier: Msg[]): Promise<Reply> {
  const category = sensitive(q)
  if (category) {
    return {
      k: "escalate",
      category,
      urgent: isUrgent(q),
      text: category === "Wellbeing" ? "You don’t have to sort this out alone. A member of staff will read your message and reply." : "A member of staff needs to look at this. They’ll get your request as written, so you won’t need to repeat it.",
    }
  }
  const words = [...new Set(toks(q))]
  const hits = INDEX.map(({ f, K, Q }, i) => ({ s: SOURCES[i], sc: words.reduce((n, w) => n + (K.has(w) ? 2 : Q.has(w) ? 1 : 0), 0), f }))
    .filter((x) => x.sc > 0)
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 3)
  if (!hits.length || hits[0].sc < 2) return gap("I couldn’t find an official source that answers this, so I won’t guess. Staff can take it from here.")

  const fallback: Reply = { k: "answer", text: `${hits[0].s.passage} [${hits[0].s.id}]`, src: [hits[0].s.id] }
  try {
    const ctl = new AbortController()
    const timer = window.setTimeout(() => ctl.abort(), 20000)
    const res = await fetch("/api/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctl.signal,
      body: JSON.stringify({
        question: q,
        earlier: earlier.filter((m) => m.r === "u").slice(-3).map((m) => m.t),
        sources: hits.map((h) => ({ id: h.s.id, doc: h.s.doc, passage: h.s.passage })),
      }),
    })
    window.clearTimeout(timer)
    if (!res.ok) return fallback
    const data = (await res.json()) as { answer?: unknown; cited?: unknown; escalate?: unknown }
    if (data.escalate === true) return gap("The official sources don’t fully cover this. A member of staff can confirm the details for you.")
    const allowed = new Set(hits.map((h) => h.s.id))
    const cited = Array.isArray(data.cited) ? data.cited.filter((x): x is string => typeof x === "string" && allowed.has(x)) : []
    if (typeof data.answer === "string" && data.answer.trim() && cited.length) return { k: "answer", text: data.answer.trim(), src: cited }
  } catch {
    /* API not configured or offline: fall back to the official passage */
  }
  return fallback
}
