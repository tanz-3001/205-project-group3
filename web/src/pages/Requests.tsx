import { ArrowUpRight, ClipboardList, Clock3, Inbox, MessageCircle, RotateCcw } from "lucide-react"
import { RequestStepper } from "@/components/ui/request-stepper"
import { TINTS } from "@/lib/data"
import { useApp } from "@/lib/app-context"

const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " · " + new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

export default function Requests() {
  const { requests, reset } = useApp()
  const list = [...requests].reverse()
  const open = list.filter((r) => r.status !== "Resolved").length
  return (
    <div className="requests-page">
      <header className="requests-header" data-reveal>
        <div>
          <span className="requests-header__eyebrow"><ClipboardList aria-hidden="true" className="size-4" /> YOUR FOLLOW-THROUGH</span>
          <h1>My requests<span>.</span></h1>
          <p>One place to see what you sent and what happens next.</p>
        </div>
        <div className="requests-header__count"><strong>{String(open).padStart(2, "0")}</strong><span>{open === 1 ? "open request" : "open requests"}</span></div>
      </header>
      {list.length === 0 ? (
        <section className="requests-empty" data-reveal>
          <span className="requests-empty__art"><Inbox aria-hidden="true" className="size-8" /></span>
          <div><span className="requests-header__eyebrow">A CLEAN SLATE</span><h2>Nothing in the queue.</h2><p>When you contact staff, your request and its next steps will show up here.</p><a href="#ask">Ask Synapse <ArrowUpRight aria-hidden="true" className="size-4" /></a></div>
        </section>
      ) : (
        <section className="request-list" aria-label="Your support requests">
          {list.map((r, index) => {
            const tint = TINTS[r.tag] ?? ["#E6E9EF", "#1A2233"]
            return (
              <article key={r.id} className="request-card" data-reveal style={{ animationDelay: `${index * 60}ms` }}>
                <div className="request-card__head">
                  <div className="request-card__meta"><span className="request-card__number">REQUEST / {String(list.length - index).padStart(2, "0")}</span><span className="request-card__tag" style={{ background: tint[0], color: tint[1] }}>{r.tag === "IT" ? "IT Support" : r.tag}</span></div>
                  <span className={`request-status ${r.status === "Resolved" ? "request-status--done" : ""}`}><i />{r.status}</span>
                </div>
                <h2>{r.q}</h2>
                <p className="request-card__date"><Clock3 aria-hidden="true" className="size-3.5" /> Sent {fmt(r.at)}</p>
                {r.transcript && <p className="request-card__date">Conversation shared with staff</p>}
                <RequestStepper status={r.status} reply={r.reply} />
                {r.reply && <div className="request-reply"><MessageCircle aria-hidden="true" className="size-[18px]" /><div><strong>Staff reply</strong><p>{r.reply}</p></div></div>}
              </article>
            )
          })}
        </section>
      )}
      <button type="button" onClick={reset} className="reset-demo"><RotateCcw aria-hidden="true" className="size-3.5" /> Reset demo data</button>
    </div>
  )
}
