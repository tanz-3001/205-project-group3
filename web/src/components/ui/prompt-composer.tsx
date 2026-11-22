import { ArrowUp, Sparkles } from "lucide-react"
import type { FormEvent } from "react"

type PromptComposerProps = {
  value: string
  busy?: boolean
  onValueChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

/**
 * Adapted for Synapse from 21st.dev community Prompt Input by Julien Thibeaut.
 * https://21st.dev/@ibelick/components/prompt-input/with-actions (MIT)
 * Connects the dashboard hero composer directly to Synapse Assist (Guard + RAG).
 */
export function PromptComposer({ value, busy = false, onValueChange, onSubmit }: PromptComposerProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-line bg-white p-2 shadow-[0_10px_30px_-24px_rgba(11,60,73,0.5)] transition focus-within:border-brand/60 focus-within:ring-4 focus-within:ring-brand-soft/70"
    >
      <label htmlFor="ask-input" className="sr-only">Ask Synapse Assist a question</label>
      <textarea
        id="ask-input"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            if (!busy) event.currentTarget.form?.requestSubmit()
          }
        }}
        rows={2}
        autoComplete="off"
        placeholder="Ask Synapse Assist about policies, exams, housing, IT…"
        className="block min-h-[76px] w-full resize-y bg-transparent px-3 py-2.5 text-base leading-6 text-ink outline-none placeholder:text-muted-ink/75 sm:text-[1.05rem]"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/80 px-1 pt-2">
        <span className="inline-flex items-center gap-2 px-2 text-xs font-medium tracking-[0.01em] text-muted-ink sm:text-sm">
          <Sparkles aria-hidden="true" className="size-4 text-brand" />
          Synapse Assist · Official answers, with sources
        </span>
        <button
          type="submit"
          disabled={busy || !value.trim()}
          aria-label="Ask Synapse Assist"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:bg-brand/45"
        >
          {busy ? "Checking…" : "Ask Assist"} <ArrowUp aria-hidden="true" className="size-4" />
        </button>
      </div>
    </form>
  )
}
