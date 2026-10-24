# Backend setup (DNotifier + Supabase)

This repository now includes server-side AI routes while preserving the existing frontend.

## 1. Install packages

From the project root (the directory containing `package.json`):

```powershell
npm install
```

If npm reports that `package-lock.json` is out of sync, run `npm install` again after deleting the old lock file, then commit the newly generated lock file. Do not use `npm ci` until the lock file has been regenerated.

## 2. Configure environment

Copy `.env.example` to `.env.local`, then fill in the four server-only values:

```dotenv
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_LEAD_STATUS_URL=/api/leads/{id}
DNOTIFIER_APP_ID=...
DNOTIFIER_SECRET=...
SUPABASE_URL=https://....supabase.co
SUPABASE_KEY=your-server-side-supabase-key
```

Never commit `.env.local`. Never expose `DNOTIFIER_SECRET` or `SUPABASE_KEY` through a `NEXT_PUBLIC_` variable.

## 3. Create Supabase table

In Supabase SQL Editor, run `supabase/schema.sql`. The `leads` table fields match the frontend contract. Keep row-level security enabled and protect the API routes with your app's authentication before a public deployment.

## 4. Index sample knowledge documents

The included Noor Online Quran Academy facts are fictional hackathon fixtures. Fees are invented demo prices, not real business information.
The importer and support workflow both use the DNotifier sender ID `support-backend`; the workflow receives each chat's `sessionId` separately in its input. This shared sender scope is required because `ctx.search()` searches the knowledge base for its workflow sender ID.

```powershell
npm run kb:setup
```

The importer validates IDs and nonempty content, lists existing records in the shared sender scope, and uses the documented `updateDocument` operation for existing IDs and `addDocument` only for missing IDs. It does not assume that add is an upsert. Re-running it refreshes the same four stable record IDs.

Run deterministic normalization and FAQ response-contract tests with:

```powershell
npm run test:kb
```

Run the live retrieval evaluation against DNotifier with:

```powershell
npm run evaluate:retrieval
```

The evaluation uses the same sender and source filter as the workflow, reports
Recall@5, Precision@5, no-result, empty-content, error, and latency metrics,
and emits retrieved stable record IDs without logging document text. It
evaluates 50 cases, skips out-of-domain general questions, and searches business
questions at similarity `0.3`, retrying zero-hit queries at `0.25`, as the
workflow does. The number of DNotifier requests can therefore exceed the
business-query count.

## 5. Run and test

```powershell
npm run dev
```

In another terminal:

```powershell
npm run test:chat
```

The script sends eight English and Roman Urdu requests to `/api/chat`. Intent classification uses a model, so expected labels are test targets rather than deterministic guarantees. Review failures in DNotifier Dashboard → Workflows.

Run:

```powershell
npm run typecheck
npm run build
```

## Routes

- `POST /api/chat`: validates the shared request and runs the DNotifier workflow. Noor Academy questions use sender-scoped semantic search and grounded answers; unrelated general questions use the same configured DNotifier AI service without knowledge-base retrieval. Successful informational answers use the existing `faq` intent; unsupported business questions use `needs_human`. `hot_lead` and `needs_human` records are persisted.
- `GET /api/leads`: returns newest leads first.
- `PATCH /api/leads/:id`: updates a lead's status for the existing dashboard UI.

The current dashboard checks for new leads every eight seconds; this implementation does not invent an undocumented DNotifier realtime-publish method. This is polling-based dashboard alerts, not push-based realtime delivery.

## Observability

The DNotifier client sets `logs: true`; the workflow sets `observability: true`. Connect and run at least one request, then inspect Dashboard → Logs and Dashboard → Workflows.

## Production notes

The supplied frontend's dashboard expects lead rows to appear through `/api/leads`. Protect `GET /api/leads` and `PATCH /api/leads/:id` with owner authentication before public deployment. Add rate limiting and an idempotency strategy before accepting untrusted public traffic. Confirm DNotifier AI plan limits and the exact search threshold using real indexed documents.
