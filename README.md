# Nexa — Support & Lead Intelligence

Nexa connects a customer conversation to an owner's follow-up workspace. This is the frontend module: Next.js App Router, TypeScript, Tailwind 4. Provider calls stay in your team's backend.

## Run

```bash
npm ci
cp -n .env.example .env.local
npm run dev
```

Open `/` for chat and `/dashboard` for the owner. Mock mode is on by default and requires no credentials. This flag remains a development mechanism, with no demo controls or labels in the product interface. Removing that interface copy does NOT connect DNotifier, Supabase, or an AI model.

## What's polished

- Nexa identity and business-neutral language, with a violet light/dark palette.
- Mobile chat appears sooner, without the desktop-only introductory cards.
- No sample leads, fake counts, demo banners, test buttons, or `/error` trigger.
- No invented fees, schedules, course claims, or business knowledge in mock replies.
- Customer-facing messages show “Request received” or “Passed to the team”; internal intent labels remain in the owner workspace.
- Full request details can be expanded in the leads table.
- User-selected theme remains selected when the system theme changes.
- Existing browser session ID and user-created local leads are preserved.

## Files to understand

| File | Responsibility |
| --- | --- |
| `lib/brand.ts` | Product name, assistant name, tagline, welcome message |
| `components/shell.tsx` | Navigation, product identity, light/dark theme |
| `components/chat-panel.tsx` | Session, composer, messages, typing and retry |
| `components/dashboard.tsx` | Leads, filters, statistics, alerts and statuses |
| `lib/api.ts` | Adapter from UI to mock functions or API routes |
| `lib/mock.ts` | Local development responses, storage and tab sync |
| `lib/types.ts` | Shared request/response types and validation |
| `lib/format.ts` | Business dates in Asia/Karachi |
| `app/globals.css` | Tailwind and theme styling |

`brand.ts` centralizes product text. The dashboard breadcrumb and page metadata also contain the product name.

## Apply to the previous project safely

This package includes `apply_update.py` next to the `support-triage-frontend` directory. Stop your dev server with Ctrl+C first. Run from the extracted package directory:

```bash
python3 apply_update.py "$HOME/Development/projects/hackathons/Best-use-of-Dnotifier/support-triage-frontend"
```

The updater validates the target, backs up every existing file it will change to a timestamped sibling folder, and updates only its declared frontend files. It doesn't copy `.env.local`, package files, API routes, or node_modules. A failed copy rolls back files it already changed. The script prints an exact restore command; keep the backup until you're satisfied. A restore refuses to overwrite files edited since applying the update.

Then, from your existing project:

```bash
npm run typecheck
npm run dev
```

There are no new dependencies. For a fresh installation, use the complete project directory and `npm ci`.

## Existing browser data

The local adapter retains the storage key `triage.mock.v1` and session key `triage.customer-session.v1`. On first access, it removes only the four original bundled records identified by `demo-session-1` through `demo-session-4`, plus matching seeded alerts. It preserves requests entered through chat, their status values and IDs. Before changing an old seeded store, it saves a full original copy at `triage.backup.before-nexa`. It does not modify Supabase or other server data.

No prefilled leads are inserted for new browsers. The local store is browser/profile/origin-specific, not a multi-user database. Use fictional contacts until backend authentication is ready. Simultaneous writes from multiple customer tabs are not transaction-safe; use one customer tab for development.

## Try the complete flow

1. Open chat and dashboard in two tabs on the same origin/browser.
2. Ask `How can you help me?` for a local FAQ response.
3. Send `My name is Faseeh. I want to book a consultation today. WhatsApp +92 300 1234567`.
4. The owner sees a hot lead and alert. Set it to Contacted, then reload to verify persistence.
5. Ask `What are your fees?`. Without real documents, this is handed off instead of producing a fabricated price.
6. Search, filter by status and expand View message.
7. Try light/dark themes and a narrow mobile viewport.

Mock routing uses text rules; it is not a model or RAG implementation. Responses/alerts remain local until the backend is integrated. Chat transcript is not persisted, while the session ID is. Typing indicates a pending request, not evidence of AI execution. Session storage failure shows a warning and uses a temporary session ID. Loading/empty/error/retry states remain available for actual failures.

## Backend handoff — shared contract unchanged

Set `NEXT_PUBLIC_USE_MOCK=false` in `.env.local`, then restart/rebuild. On Vercel, update the flag and redeploy. With the flag off the adapter calls:

```text
POST /api/chat
Body: { sessionId: string, message: string }
Response: { reply: string, intent: "faq"|"hot_lead"|"needs_human", lead?: { name, contact, need, urgency } }

GET /api/leads
Response: Lead[] (plain array)
```

Each Lead has `id, created_at, session_id, name, contact, need, urgency, intent, status, raw_message`. IDs are strings, timestamps are ISO strings, missing extraction fields are null, status is `new|contacted|closed`. Requests time out after 30 seconds, validate response shapes and show safe errors. Explicit retries can repeat backend work because the contract has no idempotency key.

The existing contract has no status mutation route or browser-facing alert transport. Optional integrations remain exactly as before:

```env
# Enable only after the backend implements these proposed routes:
NEXT_PUBLIC_LEAD_STATUS_URL=/api/leads/{id}
NEXT_PUBLIC_ALERTS_URL=/api/alerts
```

The first sends PATCH with `{ status }` and expects successful JSON or HTTP 204. Without it, API-mode status buttons are disabled. The second expects a same-origin authenticated SSE route sending `data: <alert JSON>` frames separated by two newlines. Both default message events and named `alert` events are accepted. The alert payload remains `{ type: "alert", intent, message, lead?, createdAt }`.

API mode polls `/api/leads` every 8 seconds as a fallback, generating alerts only for new IDs after its first snapshot. This is labelled “Updates every 8s”, not live delivery. An SSE connection, when configured, is labelled Live alerts. EventSource reconnects automatically, and polling continues after interruption. The feed is ephemeral (latest 50 alerts), not durable alert history.

DNotifier secrets and Supabase credentials belong in server-only environment variables. This frontend never imports their SDKs or reads credentials. Backend authorization must protect owner reads, writes and SSE; the public dashboard UI does not implement authentication. Confirm SSE runtime/connection behavior with your backend teammate before deployment.

## Checks

```bash
npm run typecheck
npm run build
```

Production build and TypeScript checks passed. Browser regression checks cover removal of seeded records with backups, preservation of user records, absence of visible demo/old branding, FAQ flow, cross-tab alerts, status persistence, unknown-price handoff, storage-error recovery/retry, session continuity, mobile layout and theme preference. Real backend integrations require your teammates' API implementation.


## Backend integration

See [`README_BACKEND.md`](./README_BACKEND.md) for DNotifier + Supabase setup, environment variables, schema, knowledge-base import, testing, and route details. Run `npm install` to generate a fresh lockfile after adding the backend dependencies.
