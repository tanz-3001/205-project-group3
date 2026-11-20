import { FileText, HeartHandshake, History, Plus, Send, Sparkles, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useApp } from "@/lib/app-context"
import type { Chat, Msg } from "@/lib/app-context"
import { answerChat, sourceById } from "@/lib/assist"
import { useAuth } from "@/lib/auth"

const STARTERS = ["How do I add or drop a course?", "What are my tuition payment options?", "How do I reset my password?", "What is the late submission policy?"]
type Props = { onContact: (category: string | null, q: string, transcript?: string[]) => void }
const toTranscript = (m: Msg[]) => m.map((x) => (x.r === "u" ? "Student: " : "Assist: ") + x.t)

function Cited({ text, src }: { text: string; src: string[] }) {
  return (
    <>
      {text.split(/(\[s\d+\])/g).map((p, i) => {
        const m = /^\[(s\d+)\]$/.exec(p)
        if (!m) return p
        const n = src.indexOf(m[1])
        return n < 0 ? null : <sup key={i} className="mx-0.5 rounded bg-brand-soft px-1.5 text-[0.7rem] font-bold text-brand">{n + 1}</sup>
      })}
    </>
  )
}

function Bubble({ m, lastQ, all, onContact }: { m: Msg; lastQ: string; all: Msg[]; onContact: Props["onContact"] }) {
  if (m.r === "u") return <div className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-white">{m.t}</div>
  if (m.k === "escalate") {
    return (
      <article className="rounded-2xl border border-line border-t-4 border-t-amber-badge bg-white p-5 animate-in fade-in slide-in-from-bottom-2">
        <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-navy"><HeartHandshake aria-hidden="true" className="size-5" />This one is best handled by a person</h3>
        <p className="mb-3 max-w-[64ch]">{m.t}</p>
        {m.urgent && <p className="mb-3 rounded-lg bg-[#FBEFD0] px-3 py-2 font-bold text-[#5C4300]">If you are in immediate danger, call emergency services on 999.</p>}
        <Button className="bg-brand text-white hover:bg-brand-dark" onClick={() => onContact(m.category ?? null, lastQ, toTranscript(all))}>Speak to a person</Button>
      </article>
    )
  }
  const src = m.src ?? []
  return (
    <article className="rounded-2xl border border-line bg-white p-5 animate-in fade-in slide-in-from-bottom-2">
      <p className="mb-3 max-w-[64ch] text-[1.05rem] leading-relaxed"><Cited text={m.t} src={src} /></p>
      {src.length > 0 && (
        <div className="mb-3 grid gap-1.5">
          <span className="text-sm text-muted-ink">Sources</span>
          {src.map((id, i) => {
            const s = sourceById(id)
            return s ? (
              <details key={id} className="group rounded-lg border border-dashed border-[#A9BDB9] open:border-solid open:bg-page">
                <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 text-sm text-muted-ink hover:text-brand [&::-webkit-details-marker]:hidden">
                  <sup className="rounded bg-brand-soft px-1.5 text-[0.7rem] font-bold text-brand">{i + 1}</sup><FileText aria-hidden="true" className="size-4" />{s.doc}
                </summary>
                <div className="border-l-4 border-brand px-3 py-2 text-sm">
                  <p>{s.passage}</p>
                  {s.link && <a href={"#" + s.link.slug} className="mt-1.5 inline-block font-semibold text-brand underline">Open {s.link.title}</a>}
                </div>
              </details>
            ) : null
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-ink">Not what you needed?</span>
        <Button variant="outline" onClick={() => onContact(null, lastQ, toTranscript(all))}>Ask staff</Button>
      </div>
    </article>
  )
}

export default function Assist({ onContact }: Props) {
  const { chats, saveChat, deleteChat, addEntry } = useApp()
  const { student } = useAuth()
  const [chatId, setChatId] = useState<number | null>(null)
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [hist, setHist] = useState(false)
  const [filter, setFilter] = useState("")
  const box = useRef<HTMLDivElement>(null)
  const chat = chats.find((c) => c.id === chatId) ?? null
  const msgs = chat?.msgs ?? []
  const first = (student?.name ?? "").split(/\s+/)[0]

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" })
  }, [msgs.length, busy])

  const send = async (raw: string) => {
    const q = raw.trim().slice(0, 500)
    if (!q || busy) return
    const base: Chat = chat ?? { id: Date.now(), title: q.slice(0, 48), at: Date.now(), msgs: [] }
    const withQ: Chat = { ...base, msgs: [...base.msgs, { r: "u", t: q }] }
    setChatId(withQ.id)
    saveChat(withQ)
    setText("")
    setBusy(true)
    const out = await answerChat(q, base.msgs)
    const m: Msg = out.k === "answer" ? { r: "a", k: "answer", t: out.text, src: out.src } : { r: "a", k: "escalate", t: out.text, category: out.category, urgent: out.urgent }
    saveChat({ ...withQ, msgs: [...withQ.msgs, m] })
    addEntry({ q, tag: out.k === "answer" ? (sourceById(out.src[0])?.topic ?? "General") : out.category, type: out.k === "answer" ? "answered" : "escalated" })
    setBusy(false)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void send(text)
  }
  const f = filter.trim().toLowerCase()
  const list = [...chats].reverse().filter((c) => !f || (c.title + c.msgs.map((m) => m.t).join(" ")).toLowerCase().includes(f))

  return (
    <div className="flex h-[calc(100dvh-190px)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-line bg-page/60">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[14px] bg-[#1e615e] text-white"><Sparkles aria-hidden="true" className="size-[18px]" /></span>
          <div><h1 className="text-xl font-bold leading-tight text-navy">Synapse Assist</h1><p className="text-sm text-muted-ink">Official answers, with sources</p></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setHist(true)}><History className="size-4" />History{chats.length ? ` (${chats.length})` : ""}</Button>
          <Button variant="outline" onClick={() => setChatId(null)}><Plus className="size-4" />New</Button>
        </div>
      </header>

      <div ref={box} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-[760px] flex-col gap-4" aria-live="polite">
          {msgs.length === 0 && (
            <div>
              <h2 className="mb-1 text-3xl font-bold text-navy">Hi {first}, what can we help with?</h2>
              <p className="max-w-[52ch] text-muted-ink">Ask a question and Assist will answer from official university sources, with a link to the exact passage.</p>
              <div className="mt-5 grid gap-2">
                {STARTERS.map((s) => <button key={s} onClick={() => void send(s)} className="min-h-12 rounded-xl border border-line bg-white px-4 py-2.5 text-left font-semibold text-navy transition hover:border-brand hover:bg-brand-soft">{s}</button>)}
              </div>
            </div>
          )}
          {msgs.map((m, i) => <Bubble key={i} m={m} all={msgs} lastQ={[...msgs.slice(0, i + 1)].reverse().find((x) => x.r === "u")?.t ?? ""} onContact={onContact} />)}
          {busy && <p className="flex items-center gap-2 text-muted-ink"><span className="size-2 animate-pulse rounded-full bg-brand" />Checking official sources…</p>}
        </div>
      </div>

      <div className="border-t border-line bg-page px-4 pb-4 pt-3 sm:px-6">
        <form onSubmit={submit} className="mx-auto flex max-w-[760px] gap-2 rounded-xl border-2 border-navy bg-white p-1.5 focus-within:ring-4 focus-within:ring-brand-soft">
          <label htmlFor="assist-input" className="sr-only">Ask Synapse Assist</label>
          <textarea id="assist-input" value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={500} placeholder="Ask about enrollment, fees, exams, IT…" className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-2.5 py-2.5 outline-none"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }} />
          <Button type="submit" disabled={busy || !text.trim()} className="min-h-11 bg-brand text-white hover:bg-brand-dark"><Send className="size-4" />Send</Button>
        </form>
        <p className="mx-auto mt-2 max-w-[760px] text-center text-xs text-muted-ink">Assist answers only from official sources and can still make mistakes. For anything personal or urgent, speak to a person.</p>
      </div>

      <Dialog open={hist} onOpenChange={setHist}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-navy">Conversation history</DialogTitle><DialogDescription>Saved to your account on this device.</DialogDescription></DialogHeader>
          <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search history" aria-label="Search conversation history" className="min-h-11 rounded-lg border border-line px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft" />
          <div className="grid max-h-72 gap-1 overflow-y-auto">
            {list.length === 0 && <p className="text-sm text-muted-ink">{f ? "No conversations match." : "Your conversations will appear here."}</p>}
            {list.map((c) => (
              <div key={c.id} className={"flex items-center rounded-lg " + (c.id === chatId ? "bg-brand-soft" : "hover:bg-page")}>
                <button className="min-h-12 min-w-0 flex-1 px-3 text-left" onClick={() => { setChatId(c.id); setHist(false) }}>
                  <strong className="block truncate text-sm text-navy">{c.title}</strong>
                  <span className="text-xs text-muted-ink">{new Date(c.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                </button>
                <button aria-label={"Delete conversation: " + c.title} className="grid size-10 place-items-center rounded-md text-muted-ink hover:bg-white hover:text-[#B4281B]" onClick={() => { deleteChat(c.id); if (c.id === chatId) setChatId(null) }}><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
