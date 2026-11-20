# Synapse Guard: integration guide

Guard adds sign-in, role-based access (student / staff / admin) and sensitive enquiry detection
with personal-data masking. It is one file with no dependencies: `guard/guard.js`.

## Demo accounts (fake, prototype only)
| Role | Email | Password |
|---|---|---|
| Student | layla@demo.ac.ae | Student#123 |
| Staff | staff@demo.ac.ae | Staff#123 |
| Admin | admin@demo.ac.ae | Admin#123 |

(Add this table to the project README. The sign-in screen refers to it.)

## Edits for index.html (integrator only: 7 small changes)

**1. Load Guard.** Add this line just before the existing `<script>` tag near the bottom:
```html
<script src="guard/guard.js"></script>
```

**2. Use Guard's detector in `ask()`.** Replace the first lines of `ask(text)`:
```js
// OLD
function ask(text){
 text=text.trim();if(!text)return;lastQ=text;
 var s=sens(text);
 if(s){lastTag=s;show(handoff(s,msgFor(s),/suicid|self.?harm|hurt myself|abus/i.test(text)));log(text,s,"escalated");return}
```
```js
// NEW
function ask(text){
 text=text.trim();if(!text)return;
 var chk=SynapseGuard.checkSensitivity(text);
 text=chk.safeText;lastQ=text;          // personal data is masked BEFORE it is logged or stored
 var s=chk.label;
 if(s){lastTag=s;show(handoff(s,msgFor(s),chk.urgent));log(text,s,"escalated");return}
```
The old `sens()` function is no longer used and can be deleted.

**3. Show the signed-in user.** Add these attributes (keep the existing text):
- `<span class="av">LA</span>` becomes `<span class="av" data-user-initials>LA</span>`
- `<span class="av2" ...>LA</span>` gets `data-user-initials`
- `<strong>Layla A.</strong>` becomes `<strong data-user-name>Layla A.</strong>`
- `<span class="muted">Student</span>` becomes `<span class="muted" data-user-role>Student</span>`

**4. Hide staff-only links from students.** Add `data-role="staff admin"` to:
- `<a id="n-staff" href="#staff">...` (left menu)
- `<a href="#staff">Staff view</a>` (account menu)

Do NOT put `data-role` on `<section id="v-staff">`: `route()` already controls that section's `hidden`.
Do NOT tag the "Support Services" or "Contact staff" buttons: students need those.

**5. Block the staff page by URL too.** In `route()`, right after the line that sets `h`
(`if(h!=="requests"&&h!=="staff")h="ask";`), add:
```js
 if(h==="staff"&&!SynapseGuard.canView("staff")){h="ask";location.hash="#ask"}
```

**6. Add a sign-out button** inside the account menu (`<div class="pn r">`):
```html
<button data-guard-logout>Sign out</button>
```

**7. Start Guard.** At the very end of the script, after `topics();route();`:
```js
SynapseGuard.init({onChange:function(){route();}});
```

## What Guard does (for Q&A)
| Part | How it works | Prototype vs production |
|---|---|---|
| Authentication | Email + password, 5 failed attempts locks for 1 minute, generic error message, 2-hour session | Demo user list and browser hashing. Production: university SSO + MFA, server-issued tokens |
| Role-based access | One permission map. Students: ask + own requests. Staff: also staff view. Admin: also audit and users | Page-level only here. Production: roles enforced on the server for every request |
| Sensitive detection | Regex rules for wellbeing, appeals/grades, financial hardship, legal/complaints. Escalates to staff, no AI answer. Crisis wording shows the emergency line | Production: add an LLM classifier tuned on real tickets, with human review of misses |
| Privacy masking | Emails, phones, Emirates ID, card numbers and student IDs replaced with tags before logging or sending to any AI | Production: also mask names; run inside EduConnect's own environment |
| Audit log | Records sign-ins and events, never message text | Production: append-only store with retention policy |

## Test it
    node --test guard/guard.browser.test.js     # 8 tests

## Pull request text (paste into the template)
**What changed:** Added `guard/guard.js` (sign-in, student/staff/admin roles, sensitive enquiry detection, personal-data masking) and `guard/INTEGRATION.md`. No existing files edited.
**How I tested:** 8 automated tests, including that all 12 existing FAQ questions and the 4 quick-links still get answered and are not escalated. Also tested sign-in, sign-out, role hiding and the login screen in a simulated browser.
**Notes for reviewer:** Demo accounts are fake. The older Express files in `guard/` (`src/`, `package.json`) are a reference design for a production server and are not used by `index.html`.
