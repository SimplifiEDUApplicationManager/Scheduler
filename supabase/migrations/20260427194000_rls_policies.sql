-- Migration: rls_policies
-- Enable Row Level Security on all V2 tables.
-- Policy matrix:
--   SUPER_ADMIN  → full access on every table
--   COORDINATOR  → full access on every table (read + write)
--   TUTOR        → read/write their own rows only; read-only on reference tables

-- ── Helper: current user's role ───────────────────────────────────────────────
-- SECURITY DEFINER so it can query public.users even after RLS is enabled.
-- STABLE allows the planner to call it once per query rather than per-row.
CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid()
$$;

-- ── users ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Super admins: unrestricted
CREATE POLICY "users_super_admin_all" ON public.users
  FOR ALL USING (public.auth_role() = 'SUPER_ADMIN');

-- Coordinators: read all rows, insert tutors/coordinators only
CREATE POLICY "users_coordinator_select" ON public.users
  FOR SELECT USING (public.auth_role() = 'COORDINATOR');

CREATE POLICY "users_coordinator_insert" ON public.users
  FOR INSERT WITH CHECK (
    public.auth_role() = 'COORDINATOR'
    AND role IN ('TUTOR', 'COORDINATOR')
  );

-- Tutors: read and update their own row only
CREATE POLICY "users_tutor_select_own" ON public.users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_tutor_update_own" ON public.users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── subjects ──────────────────────────────────────────────────────────────────
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Super admins: unrestricted
CREATE POLICY "subjects_super_admin_all" ON public.subjects
  FOR ALL USING (public.auth_role() = 'SUPER_ADMIN');

-- Coordinators: full CRUD (they own the master list)
CREATE POLICY "subjects_coordinator_all" ON public.subjects
  FOR ALL USING (public.auth_role() = 'COORDINATOR');

-- Tutors: read-only (select from the managed list)
CREATE POLICY "subjects_tutor_select" ON public.subjects
  FOR SELECT USING (public.auth_role() = 'TUTOR');

-- ── tutor_context ─────────────────────────────────────────────────────────────
ALTER TABLE public.tutor_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tutor_context_super_admin_all" ON public.tutor_context
  FOR ALL USING (public.auth_role() = 'SUPER_ADMIN');

-- Coordinators: full CRUD (they write and read context notes)
CREATE POLICY "tutor_context_coordinator_all" ON public.tutor_context
  FOR ALL USING (public.auth_role() = 'COORDINATOR');

-- Tutors: read their own context only
CREATE POLICY "tutor_context_tutor_select_own" ON public.tutor_context
  FOR SELECT USING (tutor_id = auth.uid());

-- ── tutor_subjects ────────────────────────────────────────────────────────────
ALTER TABLE public.tutor_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tutor_subjects_super_admin_all" ON public.tutor_subjects
  FOR ALL USING (public.auth_role() = 'SUPER_ADMIN');

-- Coordinators: full CRUD (grade and manage subject lists)
CREATE POLICY "tutor_subjects_coordinator_all" ON public.tutor_subjects
  FOR ALL USING (public.auth_role() = 'COORDINATOR');

-- Tutors: view their own subject entries
CREATE POLICY "tutor_subjects_tutor_select_own" ON public.tutor_subjects
  FOR SELECT USING (tutor_id = auth.uid());

-- Tutors: add subjects they teach
CREATE POLICY "tutor_subjects_tutor_insert_own" ON public.tutor_subjects
  FOR INSERT WITH CHECK (tutor_id = auth.uid());

-- Tutors: update their own qualification_note
CREATE POLICY "tutor_subjects_tutor_update_own" ON public.tutor_subjects
  FOR UPDATE USING (tutor_id = auth.uid())
  WITH CHECK (tutor_id = auth.uid());

-- ── proposals ─────────────────────────────────────────────────────────────────
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposals_super_admin_all" ON public.proposals
  FOR ALL USING (public.auth_role() = 'SUPER_ADMIN');

-- Coordinators: full CRUD (they create proposals)
CREATE POLICY "proposals_coordinator_all" ON public.proposals
  FOR ALL USING (public.auth_role() = 'COORDINATOR');

-- Tutors: see proposals addressed to them
CREATE POLICY "proposals_tutor_select_own" ON public.proposals
  FOR SELECT USING (tutor_id = auth.uid());

-- Tutors: accept or decline proposals addressed to them
CREATE POLICY "proposals_tutor_update_own" ON public.proposals
  FOR UPDATE USING (tutor_id = auth.uid())
  WITH CHECK (tutor_id = auth.uid());

-- ── holds ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "holds_super_admin_all" ON public.holds
  FOR ALL USING (public.auth_role() = 'SUPER_ADMIN');

-- Coordinators: full CRUD (they place and release holds)
CREATE POLICY "holds_coordinator_all" ON public.holds
  FOR ALL USING (public.auth_role() = 'COORDINATOR');

-- Tutors: view holds placed on their calendar
CREATE POLICY "holds_tutor_select_own" ON public.holds
  FOR SELECT USING (tutor_id = auth.uid());
