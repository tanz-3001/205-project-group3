import { useEffect, useState } from "react"
import AdminTopBar from "@/components/AdminTopBar"
import ContactDialog from "@/components/ContactDialog"
import type { ContactState } from "@/components/ContactDialog"
import Sidebar from "@/components/Sidebar"
import TopBar from "@/components/TopBar"
import { AppProvider } from "@/lib/app-context"
import { AuthProvider, useAuth } from "@/lib/auth"
import { PAGES } from "@/lib/data"
import { useHash } from "@/lib/route"
import AdminDashboard from "@/pages/AdminDashboard"
import AdminLogin from "@/pages/AdminLogin"
import Assist from "@/pages/Assist"
import Dashboard from "@/pages/Dashboard"
import Knowledge from "@/pages/Knowledge"
import Login from "@/pages/Login"
import Requests from "@/pages/Requests"
import TopicPage from "@/pages/TopicPage"

function Shell() {
  const route = useHash()
  const [contact, setContact] = useState<ContactState | null>(null)
  const [toast, setToast] = useState("")
  const page = PAGES.find((p) => p.slug === route)

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>("[data-reveal]")
    const progressLine = document.querySelector<HTMLElement>(".scroll-progress span")
    let frame = 0
    const updateProgress = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const distance = document.documentElement.scrollHeight - window.innerHeight
        const progress = distance > 0 ? window.scrollY / distance : 0
        if (progressLine) progressLine.style.transform = `scaleX(${progress})`
      })
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible")
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" })
    nodes.forEach((node) => observer.observe(node))
    window.addEventListener("scroll", updateProgress, { passive: true })
    updateProgress()
    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", updateProgress)
      cancelAnimationFrame(frame)
    }
  }, [route])
  const openContact = (category: string | null, q: string, transcript?: string[]) => setContact({ category, q, transcript })
  const closeContact = (sent: boolean) => {
    setContact(null)
    if (sent) {
      setToast("Request submitted. You can track it under My requests.")
      window.setTimeout(() => setToast(""), 3000)
    }
  }

  return (
    <div className="app-canvas min-h-screen bg-page text-ink">
      <TopBar route={route} />
      <div className="scroll-progress" aria-hidden="true"><span /></div>
      <div className="mx-auto grid max-w-[1440px] items-start gap-6 px-4 pb-16 pt-6 sm:px-7 lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-8 lg:px-10 lg:pt-9">
        <div className="lg:sticky lg:top-[108px]"><Sidebar route={route} onContact={openContact} /></div>
        <main className="min-w-0">
          {page ? <TopicPage key={page.slug} page={page} onContact={openContact} /> : route === "assist" ? <Assist onContact={openContact} /> : route === "requests" ? <Requests /> : route === "knowledge" ? <Knowledge /> : <Dashboard onContact={openContact} />}
          <p className="mt-8 border-t border-line/80 pt-4 text-xs text-muted-ink">Synapse student services <span className="px-1.5 text-brand/70">/</span> Sample content. Replace with approved FAQs.</p>
        </main>
      </div>
      <ContactDialog state={contact} onClose={closeContact} />
      {toast && <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-navy px-5 py-3 font-semibold text-white shadow-lg">{toast}</div>}
    </div>
  )
}

function Gate() {
  const route = useHash()
  const { student, admin } = useAuth()
  // The admin dashboard is only ever rendered for a verified admin session; everyone else gets the admin sign-in.
  if (route === "admin") return admin ? <AdminDashboard admin={admin} /> : <AdminLogin />
  if (route === "knowledge" && (admin || !student)) {
    return admin ? (
      <div className="app-canvas min-h-screen bg-page text-ink">
        <AdminTopBar admin={admin} route="knowledge" />
        <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-6 sm:px-7 lg:px-10 lg:pt-9">
          <Knowledge />
        </main>
      </div>
    ) : (
      <AdminLogin />
    )
  }
  if (!student) return <Login />
  return (
    <AppProvider key={student.id} studentId={student.id}>
      <Shell />
    </AppProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
