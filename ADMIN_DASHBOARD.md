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

## Limits (prototype)
- The portal has no server database, so the dashboard sees students who used the portal **in the same browser**. For all
  students on all devices, save `log`, `requests` and `ratings` to a database; only `readRecords()` in `src/lib/admin-data.ts`
  needs to change.
- Browser checks can be bypassed by anyone with dev tools. Real enforcement needs server-side roles (SSO plus a role check
  on the API that serves this data).
- Staff replies/resolution do not exist in the student app yet, so staff response time cannot be measured; open requests show how long they have waited.
