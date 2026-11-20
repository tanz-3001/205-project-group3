import { BookOpen, CalendarDays, Coins, CreditCard, FileText, Headset, Heart, Monitor, Scale, ShieldCheck, UserPlus } from "lucide-react"
import type { LucideIcon } from "lucide-react"

// Demo identity for the prototype. Replace this with the authenticated profile when sign-in is connected.
export const STUDENT_PROFILE = { displayName: "Layla A.", role: "Student" }

export type FAQ = { topic: string; q: string; keywords: string; a: string; source: string }

export const FAQS: FAQ[] = [
  { topic: "Enrollment", q: "How do I add or drop a course?", keywords: "add drop course class change register withdraw", a: "Open the student portal, go to Registration, pick the course and choose Add or Drop. Changes close at the add/drop deadline in the academic calendar.", source: "Registration FAQ" },
  { topic: "Enrollment", q: "How do I enroll for a new semester?", keywords: "enroll enrol enrollment registration semester term new register", a: "Registration opens for each semester in the student portal. Choose your courses, confirm, and check that your fees are cleared.", source: "Enrollment Guide" },
  { topic: "Enrollment", q: "How do I get an enrollment letter?", keywords: "letter certificate proof enrollment document verification", a: "Request it from the Documents section of the student portal. Letters are issued to your university email.", source: "Student Documents FAQ" },
  { topic: "Fees", q: "What are my tuition payment options?", keywords: "pay payment tuition fee fees instalment installment options card transfer", a: "Tuition can be paid in full or in instalments through the student finance page. Set up an instalment plan before the payment deadline.", source: "Fees and Payment Policy" },
  { topic: "Fees", q: "Where can I download my fee receipt?", keywords: "receipt invoice statement fee fees paid proof", a: "Receipts are in the Finance section of the student portal, under Payment history.", source: "Fees and Payment Policy" },
  { topic: "Fees", q: "When is the fee deadline?", keywords: "deadline due date late fee fees payment overdue", a: "Fee deadlines are listed in the academic calendar. Late payments may affect your registration.", source: "Fees and Payment Policy" },
  { topic: "Policies", q: "What is the attendance policy?", keywords: "attendance absence absent miss missing class lecture", a: "You are expected to attend your scheduled classes. If you must miss one, tell your instructor in advance and keep any supporting documents.", source: "Academic Policy" },
  { topic: "Policies", q: "What is the late submission policy?", keywords: "late submit submission assignment extension coursework deadline", a: "Late work may lose marks unless you have an approved extension. Ask your instructor for an extension before the deadline.", source: "Assessment Policy" },
  { topic: "Timetables", q: "Where do I find my timetable?", keywords: "timetable schedule class times room lecture", a: "Your timetable is in the student portal under My Classes. It updates when you add or drop a course.", source: "Timetable FAQ" },
  { topic: "Exams", q: "Where do I find my exam schedule?", keywords: "exam exams schedule date final test midterm", a: "Exam dates are published in the student portal under Exams, and in the academic calendar.", source: "Examinations FAQ" },
  { topic: "IT", q: "How do I reset my password?", keywords: "password reset login account locked forgot sign", a: "Use Forgot password on the sign-in page and follow the link sent to your recovery email.", source: "IT Help Desk FAQ" },
  { topic: "IT", q: "How do I connect to campus Wi-Fi?", keywords: "wifi wi fi internet network connect wireless", a: "Choose the campus network, then sign in with your student username and password.", source: "IT Help Desk FAQ" },
]

export const TINTS: Record<string, [string, string]> = {
  Enrollment: ["#DCE6F7", "#0B4A63"],
  Fees: ["#F6E9C8", "#5A4300"],
  Policies: ["#F4DAD3", "#6A2B1A"],
  Timetables: ["#D3EBE0", "#0B5240"],
  Exams: ["#E3DCF2", "#41307A"],
  IT: ["#DCE5EC", "#27415A"],
  Support: ["#FBEFD0", "#5C4300"],
}

export type Pair = [string, string]
export type CardItem = { icon: LucideIcon; title: string; text: string; action?: { label: string; category?: string } }
export type Block =
  | { kind: "steps"; title: string; items: Pair[] }
  | { kind: "timeline"; title: string; items: Pair[] }
  | { kind: "check"; title: string; items: string[] }
  | { kind: "cards"; title: string; items: CardItem[] }
  | { kind: "week"; title: string }
  | { kind: "note" }

export type PageDef = {
  slug: string
  topic: string
  nav: "academic" | "fees" | "it" | "support"
  group?: string
  title: string
  lead: string
  icon: LucideIcon
  glance: Pair[]
  blocks: Block[]
}

export const PAGES: PageDef[] = [
  { slug: "enrollment", topic: "Enrollment", nav: "academic", group: "Academic", title: "Enrollment", icon: UserPlus,
    lead: "Register for courses, change your selection and get proof of enrollment.",
    glance: [["Where", "Student portal, Registration"], ["Changes allowed", "Until the add/drop deadline"], ["Proof of enrollment", "Documents section"]],
    blocks: [
      { kind: "steps", title: "Enroll in four steps", items: [["Choose courses", "Pick your courses for the semester in Registration."], ["Confirm", "Submit your registration in the student portal."], ["Clear your fees", "Check that your fees are cleared or on a plan."], ["Check your timetable", "It updates when you add or drop a course."]] },
      { kind: "timeline", title: "Add and drop window", items: [["Registration opens", "Choose and confirm courses"], ["Semester starts", "Classes begin"], ["Add/drop deadline", "Last day to change courses"], ["Changes close", "Contact staff for exceptions"]] },
      { kind: "check", title: "Have ready", items: ["Your student login", "Your course choices", "Your fee status"] },
    ] },
  { slug: "policies", topic: "Policies", nav: "academic", group: "Academic", title: "Policies", icon: ShieldCheck,
    lead: "The rules on attendance and assessment, in plain language.",
    glance: [["Attendance", "Expected at scheduled classes"], ["Late work", "Extension needed before the deadline"], ["Appeals", "Handled by a person"]],
    blocks: [
      { kind: "cards", title: "Key policies", items: [
        { icon: ShieldCheck, title: "Attendance policy", text: "You are expected to attend your scheduled classes." },
        { icon: BookOpen, title: "Late submission", text: "Late work may lose marks unless you have an approved extension." },
        { icon: Scale, title: "Appeals and complaints", text: "These are handled by a member of staff, not by the assistant.", action: { label: "Start an appeal", category: "Academic appeals" } },
      ] },
      { kind: "steps", title: "If you must miss a class", items: [["Tell your instructor", "Do this in advance if you can."], ["Keep documents", "Keep any supporting documents."], ["Check the policy", "Read the attendance policy."]] },
    ] },
  { slug: "timetables", topic: "Timetables", nav: "academic", group: "Academic", title: "Timetables", icon: CalendarDays,
    lead: "Find your classes, times and rooms in one place.",
    glance: [["Where", "Student portal, My Classes"], ["Updates", "When you add or drop a course"], ["Rooms and times", "Shown for each class"]],
    blocks: [
      { kind: "week", title: "Your week at a glance" },
      { kind: "steps", title: "Find your timetable", items: [["Sign in", "Open the student portal."], ["Open My Classes", "Your timetable is listed there."], ["Check after changes", "It updates when you add or drop."]] },
    ] },
  { slug: "exams", topic: "Exams", nav: "academic", group: "Academic", title: "Exams", icon: FileText,
    lead: "Dates, preparation and what to do before exam day.",
    glance: [["Schedule", "Student portal, Exams"], ["Also listed in", "The academic calendar"], ["Questions", "Ask Synapse or your instructor"]],
    blocks: [
      { kind: "timeline", title: "Exam period", items: [["Revision", "Prepare for your exams"], ["Schedule published", "Student portal, Exams"], ["Exam period", "Check date, time and room"], ["After exams", "Wait for your results"]] },
      { kind: "check", title: "Before exam day", items: ["Check your date, time and room", "Bring your student ID", "Arrive early"] },
    ] },
  { slug: "fees", topic: "Fees", nav: "fees", title: "Fees and payments", icon: CreditCard,
    lead: "Pay tuition, download receipts and know your deadlines.",
    glance: [["Where to pay", "Student finance page"], ["Receipts", "Finance, Payment history"], ["Deadlines", "In the academic calendar"]],
    blocks: [
      { kind: "cards", title: "Payment options", items: [
        { icon: CreditCard, title: "Pay in full", text: "Pay your tuition in one payment through the student finance page." },
        { icon: CalendarDays, title: "Pay in instalments", text: "Set up an instalment plan before the payment deadline." },
        { icon: Coins, title: "Need support?", text: "If paying is difficult, a member of staff can talk to you.", action: { label: "Financial help", category: "Financial help" } },
      ] },
      { kind: "timeline", title: "Payment timeline", items: [["Invoice issued", "Appears in the Finance section"], ["Payment deadline", "Listed in the academic calendar"], ["After the deadline", "Late payments may affect your registration"]] },
      { kind: "steps", title: "Get your receipt", items: [["Open Finance", "In the student portal."], ["Go to Payment history", "Find your payment."], ["Download", "Save your receipt."]] },
    ] },
  { slug: "it", topic: "IT", nav: "it", title: "IT Support", icon: Monitor,
    lead: "Passwords, Wi-Fi and getting back into your account.",
    glance: [["Password", "Reset by email link"], ["Wi-Fi", "Campus network"], ["Sign in with", "Student username and password"]],
    blocks: [
      { kind: "steps", title: "Reset your password", items: [["Open sign-in", "Go to the sign-in page."], ["Select Forgot password", "Choose it below the form."], ["Follow the email link", "It is sent to your recovery email."]] },
      { kind: "steps", title: "Connect to campus Wi-Fi", items: [["Choose the network", "Select the campus network."], ["Sign in", "Use your student username and password."]] },
      { kind: "cards", title: "Still stuck?", items: [{ icon: Headset, title: "Contact IT support", text: "Send a request and a member of staff will reply.", action: { label: "Contact staff" } }] },
    ] },
  { slug: "support", topic: "Support", nav: "support", title: "Support services", icon: Headset,
    lead: "Some things are best handled by a person. Choose where to start.",
    glance: [["Appeals", "Grades and formal decisions"], ["Financial help", "When paying is difficult"], ["Wellbeing", "Someone to talk to"]],
    blocks: [
      { kind: "cards", title: "Speak to a person", items: [
        { icon: Scale, title: "Academic appeals", text: "Grades, decisions and formal reviews.", action: { label: "Start", category: "Academic appeals" } },
        { icon: Coins, title: "Financial help", text: "Support when paying fees is difficult.", action: { label: "Start", category: "Financial help" } },
        { icon: Heart, title: "Wellbeing support", text: "Confidential support for how you are feeling.", action: { label: "Start", category: "Wellbeing" } },
        { icon: Headset, title: "Contact staff", text: "Anything else you need a person for.", action: { label: "Contact staff" } },
      ] },
      { kind: "steps", title: "What happens next", items: [["You send a request", "Choose a topic and add details."], ["Staff receive it", "Your question is passed on with the chat."], ["You get a reply", "Track it under My requests."]] },
      { kind: "note" },
    ] },
]

export const TOPIC_PAGES = PAGES.filter((p) => p.slug !== "support")
