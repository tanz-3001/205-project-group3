type SuggestionItem = { id: string; label: string }

type SuggestionsProps = {
  items: SuggestionItem[]
  onSelect: (item: SuggestionItem) => void
  variant?: "default" | "dark"
}

/**
 * Adapted from 21st.dev community Suggestions by 21st.
 * https://21st.dev/@21st/components/suggestions (MIT)
 */
export function Suggestions({ items, onSelect, variant = "default" }: SuggestionsProps) {
  return (
    <div role="group" aria-label="Popular questions" className="suggestions flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item)}
          className={`suggestion-chip min-h-11 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft ${variant === "dark" ? "border-white/20 bg-white/5 text-white/85 hover:border-amber-300/70 hover:bg-white/10 hover:text-white" : "border-line bg-white text-navy hover:border-brand/50 hover:bg-brand-soft/65 hover:text-brand"}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
