import { FAQS } from "./data"
import type { FAQ } from "./data"

const STOP = new Set("the a an i my me to do how what where when is are can of for and in on it get find need want have does there this that with about please you your our us we".split(" "))
const stem = (w: string) => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, "") : w)
const toks = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !STOP.has(w)).map(stem)
const INDEX = FAQS.map((f) => ({ f, K: new Set(toks(f.keywords)), Q: new Set(toks(f.q)) }))

export type Outcome =
  | { kind: "answer"; faq: FAQ }
  | { kind: "options"; items: FAQ[] }
  | { kind: "escalate"; category: string; urgent: boolean }
  | { kind: "unknown" }

export function sensitive(q: string): string | null {
  if (/appeal|dispute|unfair|plagiar|cheat/i.test(q)) return "Academic appeals"
  if (/hardship|afford/i.test(q)) return "Financial help"
  if (/struggl|stress|anxi|depress|overwhelm|suicid|self.?harm|harass|abus|hurt myself/i.test(q)) return "Wellbeing"
  if (/lawyer|legal|complain|discriminat|visa/i.test(q)) return "Legal and complaints"
  return null
}

export function ask(q: string): Outcome {
  const category = sensitive(q)
  if (category) return { kind: "escalate", category, urgent: /suicid|self.?harm|hurt myself|abus/i.test(q) }
  const words = [...new Set(toks(q))]
  const scored = INDEX.map(({ f, K, Q }) => ({ f, sc: words.reduce((n, w) => n + (K.has(w) ? 2 : Q.has(w) ? 1 : 0), 0) })).sort((a, b) => b.sc - a.sc)
  if (scored[0].sc >= 2 && scored[0].sc > scored[1].sc) return { kind: "answer", faq: scored[0].f }
  const near = scored.filter((x) => x.sc > 0).slice(0, 3).map((x) => x.f)
  return near.length ? { kind: "options", items: near } : { kind: "unknown" }
}
