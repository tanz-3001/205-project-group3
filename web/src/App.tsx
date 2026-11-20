import { useState } from "react"
import ContactDialog from "@/components/ContactDialog"
import type { ContactState } from "@/components/ContactDialog"
import Sidebar from "@/components/Sidebar"
import TopBar from "@/components/TopBar"
import { AppProvider } from "@/lib/app-context"
import { PAGES } from "@/lib/data"
import { useHash } from "@/lib/route"
import Dashboard from "@/pages/Dashboard"
import Requests from "@/pages/Requests"
import TopicPage from "@/pages/TopicPage"

function Shell() {
  const route = useHash()
  const [contact, setContact] = useState<ContactState | null>(null)
  const [toast, setToast] = useState("")
  const page = PAGES.find((p) => p.slug === route)
  const openContact = (category: string | null, q: string) => setContact({ category, q })
  const closeContact = (sent: boolean) => {
    setContact(null)
    if (sent) {
      setToast("Request submitted. You can track it under My requests.")
      window.setTimeout(() => setToast(""), 3000)
    }
  }

  return (
    <div className="min-h-screen bg-page text-ink">
      <TopBar route={route} />
      <div className="mx-auto grid max-w-[1320px] items-start gap-7 px-4 pb-14 pt-8 sm:px-7 lg:grid-cols-[280px_1fr]">
        <Sidebar route={route} onContact={openContact} />
        <main>
          {page ? <TopicPage key={page.slug} page={page} onContact={openContact} /> : route === "requests" ? <Requests /> : <Dashboard onContact={openContact} />}
          <p className="mt-2 text-sm text-muted-ink">Sample content. Replace with approved FAQs.</p>
        </main>
      </div>
      <ContactDialog state={contact} onClose={closeContact} />
      {toast && <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-navy px-5 py-3 font-semibold text-white shadow-lg">{toast}</div>}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
