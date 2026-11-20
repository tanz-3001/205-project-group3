import { Check } from "lucide-react"
import type { Status } from "@/lib/app-context"

/**
 * A status-aware stepper adapted from 21st.dev community Steps by @adit-firdaus.
 * https://21st.dev/@adit-firdaus/components/steps/vertical-with-descriptions (MIT)
 */
export function RequestStepper({ status, reply }: { status: Status; reply?: string }) {
  const resolved = status === "Resolved"
  const steps = [
    { label: "Request sent", note: "Your question is in the queue." },
    { label: status === "In progress" ? "Team is reviewing" : "Waiting for staff", note: status === "In progress" ? "A staff member is looking into it." : "A staff member will pick this up." },
    { label: resolved ? "Resolved" : "Reply", note: reply ? "A reply is available below." : "Check back here for an update." },
  ]
  const current = resolved ? 2 : 1
  return (
    <ol className="request-timeline" aria-label={`Request progress: ${status}`}>
      {steps.map((step, index) => {
        const complete = resolved || index < current
        const active = !resolved && index === current
        return (
          <li key={step.label} className={`request-timeline__step ${complete ? "is-complete" : ""} ${active ? "is-current" : ""}`}>
            <span className="request-timeline__marker">{complete ? <Check aria-hidden="true" className="size-3.5" /> : String(index + 1).padStart(2, "0")}</span>
            <span className="request-timeline__copy"><strong>{step.label}</strong><span>{step.note}</span></span>
          </li>
        )
      })}
    </ol>
  )
}
