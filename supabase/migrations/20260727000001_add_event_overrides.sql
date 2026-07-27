-- Event overrides: tutors can pin/unpin Google Calendar events as tutoring sessions.
-- Stores manual overrides for capacity counting. Priority: manual override > auto-detection > default.

create table if not exists public.event_overrides (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  nylas_event_id   text not null,
  master_event_id  text,          -- recurring master ID; when set, override applies to all instances
  counted          boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, nylas_event_id)
);

-- Index for fast lookup by user + master event (recurring series override)
create index if not exists idx_event_overrides_user_master
  on public.event_overrides (user_id, master_event_id)
  where master_event_id is not null;

-- RLS: tutors can only see and manage their own overrides
alter table public.event_overrides enable row level security;

create policy "Users can view own overrides"
  on public.event_overrides for select
  using (auth.uid() = user_id);

create policy "Users can insert own overrides"
  on public.event_overrides for insert
  with check (auth.uid() = user_id);

create policy "Users can update own overrides"
  on public.event_overrides for update
  using (auth.uid() = user_id);

create policy "Users can delete own overrides"
  on public.event_overrides for delete
  using (auth.uid() = user_id);
