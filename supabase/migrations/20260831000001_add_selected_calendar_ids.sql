-- Allow tutors to choose which Google calendars are read for availability.
-- NULL means "all writable calendars" (backwards-compatible default).
alter table public.users
  add column if not exists selected_calendar_ids jsonb default null;

comment on column public.users.selected_calendar_ids is
  'JSON array of Nylas calendar IDs the tutor opted in to. NULL = all writable calendars.';
