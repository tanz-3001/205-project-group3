import { FileText } from "lucide-react"
import { sourceById } from "@/lib/assist"
import type { Citation } from "@/lib/assist"

export function CitedText({ text, src }: { text: string; src: string[] }) {
  return (
    <>
      {text.split(/(\[[sS]\d+\])/g).map((p, i) => {
        const m = /^\[([sS]\d+)\]$/.exec(p)
        if (!m) return p
        const n = src.indexOf(m[1])
        return n < 0 ? null : (
          <sup key={i} className="mx-0.5 rounded bg-brand-soft px-1.5 text-[0.7rem] font-bold text-brand">
            {n + 1}
          </sup>
        )
      })}
    </>
  )
}

export function SourceList({ src, cites = [] }: { src: string[]; cites?: Citation[] }) {
  if (cites.length > 0) {
    return (
      <div className="mb-3 grid gap-1.5">
        <span className="text-sm text-muted-ink">Sources from university documents</span>
        {cites.map((c, i) => (
          <details key={c.id} className="group rounded-lg border border-dashed border-[#A9BDB9] open:border-solid open:bg-page">
            <summary className="flex min-h-10 cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-1.5 text-sm text-muted-ink hover:text-brand [&::-webkit-details-marker]:hidden">
              <sup className="rounded bg-brand-soft px-1.5 text-[0.7rem] font-bold text-brand">{i + 1}</sup>
              <FileText aria-hidden="true" className="size-4" />
              <span className="font-semibold text-navy">{c.doc}</span>
              {c.location && <span>· {c.location}</span>}
            </summary>
            <div className="border-l-4 border-brand px-3 py-2 text-sm">
              <p className="whitespace-pre-line">{c.excerpt}</p>
            </div>
          </details>
        ))}
      </div>
    )
  }

  if (src.length === 0) return null

  return (
    <div className="mb-3 grid gap-1.5">
      <span className="text-sm text-muted-ink">Sources</span>
      {src.map((id, i) => {
        const s = sourceById(id)
        return s ? (
          <details key={id} className="group rounded-lg border border-dashed border-[#A9BDB9] open:border-solid open:bg-page">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 text-sm text-muted-ink hover:text-brand [&::-webkit-details-marker]:hidden">
              <sup className="rounded bg-brand-soft px-1.5 text-[0.7rem] font-bold text-brand">{i + 1}</sup>
              <FileText aria-hidden="true" className="size-4" />
              {s.doc}
            </summary>
            <div className="border-l-4 border-brand px-3 py-2 text-sm">
              <p>{s.passage}</p>
              {s.link && (
                <a href={"#" + s.link.slug} className="mt-1.5 inline-block font-semibold text-brand underline">
                  Open {s.link.title}
                </a>
              )}
            </div>
          </details>
        ) : null
      })}
    </div>
  )
}
