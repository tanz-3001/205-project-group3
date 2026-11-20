import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useApp } from "@/lib/app-context"

export type ContactState = { category: string | null; q: string; transcript?: string[] }

function Form({ state, onDone }: { state: ContactState; onDone: (sent: boolean) => void }) {
  const { addRequest } = useApp()
  const [note, setNote] = useState("")
  const [share, setShare] = useState(true)
  const send = () => {
    const extra = note.trim()
    addRequest((state.q || "General request") + (extra ? " - " + extra : ""), state.category ?? "General", share ? state.transcript : undefined)
    onDone(true)
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-navy">Contact staff</DialogTitle>
        <DialogDescription>
          {state.category ? `Topic: ${state.category}. ` : ""}Your question is passed on with this chat, so you won’t need to repeat it.
        </DialogDescription>
      </DialogHeader>
      <label htmlFor="contact-note" className="text-sm text-muted-ink">Add details if you like</label>
      <Textarea id="contact-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-28" />
      {state.transcript && (
        <label className="flex items-center gap-2.5 text-sm font-semibold text-navy">
          <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="size-5" />
          Share this conversation so I don’t have to repeat myself
        </label>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={() => onDone(false)}>Cancel</Button>
        <Button className="bg-brand text-white hover:bg-brand-dark" onClick={send}>Submit</Button>
      </DialogFooter>
    </>
  )
}

export default function ContactDialog({ state, onClose }: { state: ContactState | null; onClose: (sent: boolean) => void }) {
  return (
    <Dialog open={state !== null} onOpenChange={(o) => { if (!o) onClose(false) }}>
      <DialogContent>{state && <Form state={state} onDone={onClose} />}</DialogContent>
    </Dialog>
  )
}
