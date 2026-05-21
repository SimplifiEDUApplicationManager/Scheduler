-- Migration: fix availability RLS policies + max_weekly_hours constraint
-- Run after 20260520_tutor_availability.sql.

-- ── Fix max_weekly_hours constraint ───────────────────────────────────────────
-- The old constraint required >= 6, but coordinator-approved LOW_MAX_HOURS
-- requests can set values down to 1. Widen the floor to 1.

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_max_weekly_hours_range,
  ADD CONSTRAINT users_max_weekly_hours_range
    CHECK (max_weekly_hours >= 1 AND max_weekly_hours <= 40);

-- ── RLS: tutor_availability_requests ─────────────────────────────────────────

ALTER TABLE public.tutor_availability_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tar_super_admin_all" ON public.tutor_availability_requests
  FOR ALL USING (public.auth_role() = 'SUPER_ADMIN');

-- Coordinators: read and update any request (approve / decline)
CREATE POLICY "tar_coordinator_all" ON public.tutor_availability_requests
  FOR ALL USING (public.auth_role() = 'COORDINATOR');

-- Tutors: read, insert, and delete their own requests
CREATE POLICY "tar_tutor_select_own" ON public.tutor_availability_requests
  FOR SELECT USING (tutor_id = auth.uid());

CREATE POLICY "tar_tutor_insert_own" ON public.tutor_availability_requests
  FOR INSERT WITH CHECK (tutor_id = auth.uid());

CREATE POLICY "tar_tutor_delete_own" ON public.tutor_availability_requests
  FOR DELETE USING (tutor_id = auth.uid());

-- ── RLS: tutor_availability_activity ─────────────────────────────────────────

ALTER TABLE public.tutor_availability_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "taa_super_admin_all" ON public.tutor_availability_activity
  FOR ALL USING (public.auth_role() = 'SUPER_ADMIN');

-- Coordinators: read all activity (for the updates feed) + insert when approving/declining
CREATE POLICY "taa_coordinator_all" ON public.tutor_availability_activity
  FOR ALL USING (public.auth_role() = 'COORDINATOR');

-- Tutors: read their own activity; insert their own (profile/scheduler routes log on their behalf)
CREATE POLICY "taa_tutor_select_own" ON public.tutor_availability_activity
  FOR SELECT USING (tutor_id = auth.uid());

CREATE POLICY "taa_tutor_insert_own" ON public.tutor_availability_activity
  FOR INSERT WITH CHECK (tutor_id = auth.uid());
