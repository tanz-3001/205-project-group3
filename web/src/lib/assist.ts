import { FAQS, TOPIC_PAGES } from "./data"
import type { FAQ } from "./data"
import type { Msg } from "./app-context"
import { knowledge } from "./knowledge"

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
  | { k: "answer"; text: string; src: string[]; cites?: Citation[]; conversational?: boolean; suggestions?: string[] }
  | { k: "escalate"; text: string; category: string; urgent: boolean; /** true when no official source answered a non-sensitive question */ unknown?: boolean }

export function conversationalReply(q: string): string | null {
  const norm = q.trim().toLowerCase().replace(/[!?.,]+$/g, "").replace(/['’]/g, "").replace(/\s+/g, " ")
  if (!norm) return null
  if (/^(?:hi+|hello+|helo|hlo|hey+|good (?:morning|afternoon|evening)|salam|assalamu ?alaikum|yo+|sup|hola|howdy)(?: (?:there|synapse|assist|bot|bro|team|everyone))?$/i.test(norm)) {
    return "Hi! I’m Synapse Assist. What can I help you with today? Ask me about courses, deadlines, exams, fees, campus Wi-Fi, printing, library hours, housing, shuttles, internships, graduation, or accessibility."
  }
  const body = norm.replace(/^(?:hi+|hello+|helo|hlo|hey+|yo+|sup|salam|assalamu ?alaikum|good (?:morning|afternoon|evening)|excuse me|bro|synapse|assist)[,\s]+/i, "")
  if (/^(?:(?:i )?(?:really )?(?:need|want)(?: some| a little| your| ur)? (?:h?elp|halp|hlep|assistance|support)|(?:can|could|will|would) (?:you|u) (?:please |pls |plz )?(?:h?elp|halp|hlep|assist)(?: me)?|(?:please |pls |plz )?(?:h?elp|halp|hlep|assist)(?: me)?|(?:i )?(?:have|got) a (?:quick )?(?:question|doubt|query)|(?:can|may) i ask (?:you |u )?(?:a question|something)|(?:i )?(?:want|wanna) (?:to )?ask something|quick question|im confused|i am confused|where do i start|not sure where to start)(?: (?:please|pls|plz|right now|rn|bro|man|synapse|assist|team))?$/i.test(body)) {
    return "Of course — I’m here to help! Tell me what you need help with (like courses, deadlines, exams, Wi-Fi, printing, library hours, housing, shuttles, internships, or graduation) and I’ll check the official university documents with citations. You can also click a topic below or choose Ask staff."
  }
  if (/^(?:how are you(?: doing)?|who are you|what (?:are you|can you do|can you help(?: me)? with|topics do you (?:cover|know)|documents do you have|do you know)|how do (?:you|u) work|start|menu)$/i.test(body)) {
    return "I’m Synapse Assist — I search 16 official university guides and handbooks using Gemini RAG to give grounded answers with source citations. Pick a quick topic below or ask your own question!"
  }
  if (/^(?:thanks(?: a lot| so much)?|thank you(?: so much| very much)?|thx|ty|cheers|ok|okay|got it|cool|great|awesome|nice|bye|goodbye|see ya)$/i.test(body)) {
    return "You’re welcome! Let me know anytime if you need help finding another policy or raising a request with staff."
  }
  return null
}

/** A citation from Synapse Knowledge (an indexed university document). */
export type Citation = { id: string; doc: string; location: string; excerpt: string; documentId: string; chunkId: string }

const gap = (text: string, category = "General"): Reply => ({ k: "escalate", text, category, urgent: false, unknown: true })

async function askGeminiChat(q: string, earlier: Msg[]): Promise<Reply | null> {
  try {
    const ctl = new AbortController()
    const timer = window.setTimeout(() => ctl.abort(), 15000)
    const res = await fetch("/api/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctl.signal,
      body: JSON.stringify({
        mode: "chat",
        question: q,
        earlier: earlier.filter((m) => m.r === "u").slice(-3).map((m) => m.t),
      }),
    })
    window.clearTimeout(timer)
    if (!res.ok) return null
    const data = (await res.json()) as { answer?: unknown; escalate?: unknown; suggestions?: unknown }
    if (data.escalate === true) {
      return gap(typeof data.answer === "string" && data.answer.trim() ? data.answer.trim() : "I couldn’t find an official source that answers this, so I won’t guess. Staff can take it from here.")
    }
    if (typeof data.answer === "string" && data.answer.trim()) {
      const suggestions = Array.isArray(data.suggestions)
        ? data.suggestions.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 3)
        : undefined
      return { k: "answer", text: data.answer.trim(), src: [], conversational: true, ...(suggestions?.length ? { suggestions } : {}) }
    }
  } catch {
    /* API unavailable: fall back to offline conversational helper or abstain */
  }
  return null
}

/**
 * Ask Synapse Knowledge (indexed university documents). Returns null when the knowledge service
 * is unavailable or has no sufficient evidence, so the caller falls back to the existing FAQ flow.
 */
async function askKnowledge(q: string, earlier: Msg[], token: string): Promise<Reply | null> {
  try {
    const history = earlier.filter((m) => m.r === "u").slice(-3).map((m) => m.t)
    const out = await knowledge.query(token, q, history)
    if (out.status === "escalate") {
      return {
        k: "escalate",
        category: out.category,
        urgent: out.urgent,
        text: out.category === "Wellbeing" ? "You don’t have to sort this out alone. A member of staff will read your message and reply." : "A member of staff needs to look at this. They’ll get your request as written, so you won’t need to repeat it.",
      }
    }
    if (out.status !== "answered" || !out.citations.length) return null
    const cites: Citation[] = out.citations.map((c) => ({ id: c.id, doc: c.document_name, location: c.location, excerpt: c.excerpt, documentId: c.document_id, chunkId: c.chunk_id }))
    return { k: "answer", text: out.answer, src: cites.map((c) => c.id), cites }
  } catch {
    return null // service down, not configured, rate limited: keep the existing behaviour
  }
}

/**
 * Safety order matters: sensitive topics always escalate first.
 * 1. Local sensitivity check.
 * 2. Synapse Knowledge (16-doc pgvector RAG + Guard + Gemini citation verification), when signed in.
 * 3. Local FAQ synthesis via /api/assist when matched.
 * 4. Gemini chat with Synapse Assist system prompt (/api/assist mode=chat) for greetings, help, and guidance; offline regex fallback if unreachable.
 */
export async function answerChat(q: string, earlier: Msg[], token?: string): Promise<Reply> {
  const category = sensitive(q)
  if (category) {
    return {
      k: "escalate",
      category,
      urgent: isUrgent(q),
      text: category === "Wellbeing" ? "You don’t have to sort this out alone. A member of staff will read your message and reply." : "A member of staff needs to look at this. They’ll get your request as written, so you won’t need to repeat it.",
    }
  }
  if (token && q.trim().length >= 3) {
    const fromKnowledge = await askKnowledge(q, earlier, token)
    if (fromKnowledge) return fromKnowledge
  }
  const words = [...new Set(toks(q))]
  const hits = INDEX.map(({ f, K, Q }, i) => ({ s: SOURCES[i], sc: words.reduce((n, w) => n + (K.has(w) ? 2 : Q.has(w) ? 1 : 0), 0), f }))
    .filter((x) => x.sc > 0)
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 3)
  if (!hits.length || hits[0].sc < 2) {
    const chatOut = await askGeminiChat(q, earlier)
    if (chatOut) return chatOut
    const chatty = conversationalReply(q)
    if (chatty) return { k: "answer", text: chatty, src: [], conversational: true }
    return gap("I couldn’t find an official source that answers this, so I won’t guess. Staff can take it from here.")
  }

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
