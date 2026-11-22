# Admin dashboard

Open the portal and go to `#admin` (there is also an "Admin sign-in" link on the student sign-in page).
Demo admin: `admin@demo.ac.ae` / `Admin#123` (the Synapse Guard demo admin account).

## What it shows
All numbers are computed from the activity the portal saves, nothing is hardcoded.

| Metric | Definition |
|---|---|
| Questions | Every question logged by Overview search or Synapse Assist |
| Answered | The portal found an official answer |
| Need a person | The question was sensitive and routed to staff |
| Unanswered | No matching answer was found |
| Average response time | Time from submitting a question to the answer being shown (`Entry.ms`) |
| Found it helpful | Positive ratings / all ratings (ratings are not timestamped, so this is all time) |
| Staff requests resolved | Requests with status Resolved / all requests |

Recent queries show the status of the staff request the same student raised for that question, when there is one.

## How it stays live
Each student's data is saved in the browser (`synapse:react:v1:<studentId>`). The dashboard reads every such record and
recomputes on the browser's `storage` event, so a question asked in another tab appears without a reload. It also
refreshes every 15 s and when the tab regains focus.

## Access control
- The dashboard is only rendered for a verified admin session (`useAuth().admin`). Anyone else who opens `#admin` sees the admin sign-in.
- Admin sessions use `sessionStorage` (per tab, 2 hours), so an admin tab and a student tab can run side by side.
- Credentials use the Guard demo account's salted SHA-256 hash; 5 failed attempts lock sign-in for a minute.
- A stored student session can never carry the Admin role.

## Staff request management
- In the **Staff requests** panel, administrators can toggle between **Open** and **All** requests, expand shared conversation transcripts (`r.transcript`), and click **Manage** (or **Reopen / Edit** on resolved requests) to:
  - Change the status between `Waiting for staff`, `In progress`, and `Resolved` (including reopening resolved requests).
  - Write and save a staff reply (`r.reply`).
- Updates persist both in browser `localStorage` (notifying open student tabs immediately via `storage` and custom events) and in the backend database (`portal_student_states` via `PATCH /api/knowledge/portal/requests/{student_id}/{request_id}`).

## Persistence & deployment notes
- The student portal and admin dashboard keep a fast local cache in `localStorage` (`synapse:react:v1:<studentId>`) and synchronise with the backend SQL database (`PUT /api/knowledge/portal/state/{student_id}` and `GET /api/knowledge/portal/records`).
- For permanent cross-device persistence in production (on Vercel or cloud containers), configure `DATABASE_URL=postgresql+psycopg://...` pointing to a managed PostgreSQL instance. Without an external `DATABASE_URL`, Vercel serverless functions use instance-local `/tmp/synapse_knowledge.db`.
