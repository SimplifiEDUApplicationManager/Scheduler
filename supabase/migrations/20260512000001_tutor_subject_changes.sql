-- Migration: tutor_subject_changes
-- Introduces a coordinator-approval queue for tutor subject mutations.
-- Tutors no longer write directly to tutor_subjects; instead they submit a
-- TutorSubjectChange (ADD / EDIT / REMOVE) which a coordinator approves or declines.
-- On approval the corresponding tutor_subjects row is created, updated, or deleted.

CREATE TABLE public.tutor_subject_changes (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id             uuid        NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  subject_id           uuid        NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  -- Present for EDIT and REMOVE; null for ADD (no approved row exists yet)
  tutor_subject_id     uuid        REFERENCES public.tutor_subjects(id)    ON DELETE CASCADE,
  change_type          text        NOT NULL CHECK (change_type IN ('ADD', 'EDIT', 'REMOVE')),
  -- Confidence the tutor is requesting; null for REMOVE
  requested_confidence text        CHECK (requested_confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  -- Tutor's explanation; null for REMOVE
  requested_note       text,
  status               text        NOT NULL DEFAULT 'PENDING'
                                   CHECK (status IN ('PENDING', 'APPROVED', 'DECLINED')),
  reviewed_by          uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at          timestamptz,
  decline_reason       text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Enforce at most one PENDING change per tutor+subject at a time.
-- A tutor cannot stack multiple outstanding requests for the same subject.
CREATE UNIQUE INDEX tutor_subject_changes_one_pending
  ON public.tutor_subject_changes (tutor_id, subject_id)
  WHERE (status = 'PENDING');

CREATE INDEX tutor_subject_changes_status_idx  ON public.tutor_subject_changes (status);
CREATE INDEX tutor_subject_changes_tutor_idx   ON public.tutor_subject_changes (tutor_id);
CREATE INDEX tutor_subject_changes_subject_idx ON public.tutor_subject_changes (subject_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.tutor_subject_changes ENABLE ROW LEVEL SECURITY;

-- Tutors can read their own change requests
CREATE POLICY "tutor_subject_changes_tutor_select"
  ON public.tutor_subject_changes FOR SELECT
  USING (tutor_id = auth.uid());

-- Coordinators and super admins can read all pending changes
CREATE POLICY "tutor_subject_changes_coord_select"
  ON public.tutor_subject_changes FOR SELECT
  USING (current_user_role() IN ('COORDINATOR', 'SUPER_ADMIN'));

-- Tutors can insert their own change requests
CREATE POLICY "tutor_subject_changes_tutor_insert"
  ON public.tutor_subject_changes FOR INSERT
  WITH CHECK (tutor_id = auth.uid() AND current_user_role() = 'TUTOR');

-- Coordinators and super admins can update (approve/decline) any change
CREATE POLICY "tutor_subject_changes_coord_update"
  ON public.tutor_subject_changes FOR UPDATE
  USING (current_user_role() IN ('COORDINATOR', 'SUPER_ADMIN'));
