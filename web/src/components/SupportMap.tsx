import { ArrowDownRight, ArrowRight, Compass, Headset, Search, TicketCheck } from "lucide-react"

type SupportMapProps = {
  onContact: (category: string | null, q: string) => void
}

const routes = [
  { step: "01", title: "Find an answer", note: "Start with approved guidance", icon: Search, href: "#ask", tone: "route-map__node--mint" },
  { step: "02", title: "Talk to a person", note: "We’ll route it to the right team", icon: Headset, action: true, tone: "route-map__node--amber" },
  { step: "03", title: "Track your request", note: "Pick up where you left off", icon: TicketCheck, href: "#requests", tone: "route-map__node--blue" },
]

export default function SupportMap({ onContact }: SupportMapProps) {
  return (
    <section className="route-map" data-reveal aria-labelledby="route-map-title">
      <div className="route-map__topline">
        <span className="route-map__eyebrow"><Compass aria-hidden="true" className="size-4" /> THE SUPPORT ROUTE</span>
        <span className="route-map__index">01 <span /> 03</span>
      </div>
      <div className="route-map__heading">
        <div>
          <h2 id="route-map-title">A clear way through.</h2>
          <p>Start anywhere. If you need a person, your question can travel with you.</p>
        </div>
        <ArrowDownRight aria-hidden="true" className="route-map__heading-mark" />
      </div>
      <ol className="route-map__nodes">
        {routes.map((route, index) => {
          const Icon = route.icon
          const contents = (
            <>
              <span className="route-map__node-top"><span>{route.step}</span><Icon aria-hidden="true" className="size-[18px]" /></span>
              <span className="route-map__node-title">{route.title}</span>
              <span className="route-map__node-note">{route.note}</span>
              <ArrowRight aria-hidden="true" className="route-map__node-arrow" />
            </>
          )
          return (
            <li key={route.step} className="route-map__item">
              {route.action ? (
                <button type="button" onClick={() => onContact(null, "I need help finding the right service.")} className={`route-map__node ${route.tone}`}>{contents}</button>
              ) : (
                <a href={route.href} className={`route-map__node ${route.tone}`}>{contents}</a>
              )}
              {index < routes.length - 1 && <span aria-hidden="true" className="route-map__connector"><span /></span>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
