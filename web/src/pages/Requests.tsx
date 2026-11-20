import { TINTS } from "@/lib/data"
import { useApp } from "@/lib/app-context"

const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" }) + ", " + new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

export default function Requests() {
  const { requests, reset } = useApp()
  const list = [...requests].reverse()
  return (
    <section className="rounded-xl border border-line bg-white p-6">
      <h1 className="mb-4 text-2xl font-bold text-navy">My requests</h1>
      {list.length === 0 ? (
        <p className="text-muted-ink">Nothing yet. Requests you send to staff show up here.</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((r) => {
            const t = TINTS[r.tag] ?? ["#E6E9EF", "#1A2233"]
            return (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                <div>
                  <span className="rounded-md px-2.5 py-0.5 text-xs font-bold" style={{ background: t[0], color: t[1] }}>{r.tag === "IT" ? "IT Support" : r.tag}</span>
                  <p className="mt-1.5 font-medium">{r.q}</p>
                  <p className="text-sm text-muted-ink">{fmt(r.at)}</p>
                  {r.reply && <p className="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm">{r.reply}</p>}
                </div>
                <span className="text-sm font-semibold text-muted-ink">{r.status}</span>
              </li>
            )
          })}
        </ul>
      )}
      <button onClick={reset} className="mt-6 text-sm text-muted-ink underline hover:text-brand">Reset demo data</button>
    </section>
  )
}
