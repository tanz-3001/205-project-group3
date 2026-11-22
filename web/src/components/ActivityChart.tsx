import { useState } from "react"
import { OUTCOME } from "@/lib/admin-data"
import type { Bucket, Range } from "@/lib/admin-data"

const W = 760
const H = 250
const M = { l: 34, r: 8, t: 10, b: 28 }
const STACK = ["answered", "escalated", "unknown"] as const
const PERIOD = { "24h": "hour over the last 24 hours", "7d": "day over the last 7 days", "30d": "day over the last 30 days" } as const
const EVERY = { "24h": 3, "7d": 1, "30d": 5 } as const

const totalOf = (b: Bucket) => b.answered + b.escalated + b.unknown

/** Stacked bars of questions per hour or day, split by outcome. */
export default function ActivityChart({ data, range }: { data: Bucket[]; range: Range }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...data.map(totalOf), 0)
  const step = Math.max(1, Math.ceil(max / 4))
  const top = step * 4
  const pw = W - M.l - M.r
  const ph = H - M.t - M.b
  const slot = pw / data.length
  const bw = Math.min(30, slot * 0.64)
  const y = (v: number) => M.t + ph - (v / top) * ph
  const total = data.reduce((n, b) => n + totalOf(b), 0)
  const peak = data.reduce((p, b) => (totalOf(b) > totalOf(p) ? b : p), data[0])
  const h = hover === null ? null : data[hover]

  return (
    <figure className="relative m-0">
      <figcaption className="sr-only">
        Questions per {PERIOD[range]}: {total} in total{total ? `, busiest ${peak.full} with ${totalOf(peak)}` : ""}.
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="group" aria-label={`Questions per ${PERIOD[range]}`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line x1={M.l} x2={W - M.r} y1={y(i * step)} y2={y(i * step)} stroke={i === 0 ? "#a9bdb9" : "#e3ebe8"} strokeWidth={1} />
            <text x={M.l - 8} y={y(i * step) + 4} textAnchor="end" fontSize={11} fill="#53686c">{i * step}</text>
          </g>
        ))}
        {data.map((b, i) => {
          const cx = M.l + slot * i + slot / 2
          let acc = 0
          return (
            <g key={b.start}>
              {hover === i && <rect x={M.l + slot * i} y={M.t} width={slot} height={ph} fill="#0b6b63" fillOpacity={0.07} />}
              {STACK.map((k) => {
                const v = b[k]
                if (!v) return null
                const y1 = y(acc + v)
                const hgt = y(acc) - y1
                acc += v
                return <rect key={k} x={cx - bw / 2} y={y1} width={bw} height={Math.max(hgt - 1, 1)} rx={2} fill={OUTCOME[k].color} />
              })}
              {i % EVERY[range] === 0 && <text x={cx} y={H - 9} textAnchor="middle" fontSize={11} fill="#53686c">{b.label}</text>}
              <rect
                x={M.l + slot * i}
                y={M.t}
                width={slot}
                height={ph}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${b.full}: ${totalOf(b)} questions. ${b.answered} answered, ${b.escalated} need a person, ${b.unknown} unanswered.`}
                className="outline-none"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            </g>
          )
        })}
      </svg>
      {total === 0 && <p className="pointer-events-none absolute inset-x-0 top-[38%] text-center text-sm text-muted-ink">No questions in this period yet.</p>}
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-44 rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-[0_18px_45px_-24px_rgba(10,35,40,0.45)]"
          style={{ left: `clamp(0%, calc(${((M.l + slot * hover + slot / 2) / W) * 100}% - 88px), calc(100% - 11rem))` }}
        >
          <p className="mb-1 font-semibold text-navy">{h.full}</p>
          {STACK.map((k) => (
            <p key={k} className="flex items-center justify-between gap-2 text-muted-ink">
              <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-sm" style={{ background: OUTCOME[k].color }} />{OUTCOME[k].label}</span>
              <b className="tabular-nums text-ink">{h[k]}</b>
            </p>
          ))}
        </div>
      )}
    </figure>
  )
}
