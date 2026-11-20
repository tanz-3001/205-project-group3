# Synapse Assist: setup notes

New: `src/lib/auth.tsx`, `src/pages/Login.tsx`, `src/pages/Assist.tsx`, `src/lib/assist.ts` (chat logic), `api/assist.ts` (server function).

## Turn on the AI answers
1. Vercel > Project > Settings > Environment Variables: add `ANTHROPIC_API_KEY` (optional: `ANTHROPIC_MODEL`).
2. Redeploy. Without the key, Assist still works: it shows the official passage with its source.
3. To test the API locally use `vercel dev` (plain `npm run dev` has no /api, so it uses the fallback).

## Before going live
- `signIn()` in `src/lib/auth.tsx` is a demo. Replace it with your university SSO and verify sessions server-side.
- Chats and requests are saved in browser storage per student ID. Move them to a database so staff actually receive requests.
- `/api/assist` should check the signed-in session and rate-limit per student.
- Replace sample FAQs in `src/lib/data.ts` with approved content and have your wellbeing team review the escalation wording and the emergency number (999).
