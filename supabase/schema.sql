create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id text not null,
  name text,
  contact text,
  need text,
  urgency text,
  intent text not null check (intent in ('faq', 'hot_lead', 'needs_human')),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  raw_message text not null
);

create index if not exists leads_created_at_idx
  on public.leads (created_at desc);
create index if not exists leads_session_id_idx
  on public.leads (session_id);

-- Important: keep RLS enabled and do not grant public read/write access.
-- These routes use SUPABASE_KEY only on the server. Add authentication/authorization
-- before exposing /api/leads or the status PATCH route to a public deployment.
alter table public.leads enable row level security;
