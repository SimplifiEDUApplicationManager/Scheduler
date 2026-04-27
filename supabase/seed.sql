-- Seed data for local development (supabase db reset) and manual remote seeding.
-- All inserts are idempotent (ON CONFLICT DO NOTHING).
-- Fixed UUIDs make seeds stable across resets.
--
-- Run against a remote project:
--   psql "$DATABASE_URL" -f supabase/seed.sql
--
-- Stable UUID assignments:
--   00000000-0000-0000-0000-000000000001  Austin Rubinger    SUPER_ADMIN
--   00000000-0000-0000-0000-000000000002  Sarah Chen         COORDINATOR
--   00000000-0000-0000-0000-000000000003  Mike Torres        COORDINATOR
--   00000000-0000-0000-0000-000000000011  Emma Walsh         TUTOR
--   00000000-0000-0000-0000-000000000012  James Okafor       TUTOR
--   00000000-0000-0000-0000-000000000013  Priya Nair         TUTOR
--   00000000-0000-0000-0000-000000000014  Carlos Rivera      TUTOR

-- ── Auth users ────────────────────────────────────────────────────────────────
-- Inserts into auth.users so Supabase Auth recognises these identities.
-- Passwords are bcrypt hashes of "Password123!" — dev only, never production.

INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  aud, role, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'austin@simplifiedu.com',
    '$2a$10$PgBpBpBpBpBpBpBpBpBpBuEPvFQ3VgFGPdIrqWp8zY6klXaOtM9Oa',
    now(), 'authenticated', 'authenticated',
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'sarah@simplifiedu.com',
    '$2a$10$PgBpBpBpBpBpBpBpBpBpBuEPvFQ3VgFGPdIrqWp8zY6klXaOtM9Oa',
    now(), 'authenticated', 'authenticated',
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'mike@simplifiedu.com',
    '$2a$10$PgBpBpBpBpBpBpBpBpBpBuEPvFQ3VgFGPdIrqWp8zY6klXaOtM9Oa',
    now(), 'authenticated', 'authenticated',
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    'emma@tutors.simplifiedu.com',
    '$2a$10$PgBpBpBpBpBpBpBpBpBpBuEPvFQ3VgFGPdIrqWp8zY6klXaOtM9Oa',
    now(), 'authenticated', 'authenticated',
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    'james@tutors.simplifiedu.com',
    '$2a$10$PgBpBpBpBpBpBpBpBpBpBuEPvFQ3VgFGPdIrqWp8zY6klXaOtM9Oa',
    now(), 'authenticated', 'authenticated',
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000013',
    'priya@tutors.simplifiedu.com',
    '$2a$10$PgBpBpBpBpBpBpBpBpBpBuEPvFQ3VgFGPdIrqWp8zY6klXaOtM9Oa',
    now(), 'authenticated', 'authenticated',
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000014',
    'carlos@tutors.simplifiedu.com',
    '$2a$10$PgBpBpBpBpBpBpBpBpBpBuEPvFQ3VgFGPdIrqWp8zY6klXaOtM9Oa',
    now(), 'authenticated', 'authenticated',
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now()
  )
ON CONFLICT (id) DO NOTHING;

-- ── public.users ──────────────────────────────────────────────────────────────

INSERT INTO public.users (
  id, email, name, role, status, timezone,
  max_weekly_hours, min_weekly_hours,
  bio, meeting_link,
  created_at, updated_at
)
VALUES
  -- Super admin
  (
    '00000000-0000-0000-0000-000000000001',
    'austin@simplifiedu.com', 'Austin Rubinger',
    'SUPER_ADMIN', 'ACTIVE', 'America/New_York',
    40, 6, NULL, NULL,
    now(), now()
  ),
  -- Coordinators
  (
    '00000000-0000-0000-0000-000000000002',
    'sarah@simplifiedu.com', 'Sarah Chen',
    'COORDINATOR', 'ACTIVE', 'America/Chicago',
    40, 6, NULL, NULL,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'mike@simplifiedu.com', 'Mike Torres',
    'COORDINATOR', 'ACTIVE', 'America/Los_Angeles',
    40, 6, NULL, NULL,
    now(), now()
  ),
  -- Tutors
  (
    '00000000-0000-0000-0000-000000000011',
    'emma@tutors.simplifiedu.com', 'Emma Walsh',
    'TUTOR', 'ACTIVE', 'America/New_York',
    25, 10,
    'MIT grad specialising in calculus and physics. Patient with visual learners.',
    'https://meet.google.com/dev-emma',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    'james@tutors.simplifiedu.com', 'James Okafor',
    'TUTOR', 'ACTIVE', 'America/Chicago',
    20, 8,
    'Former high-school English teacher. SAT reading and essay writing specialist.',
    'https://meet.google.com/dev-james',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000013',
    'priya@tutors.simplifiedu.com', 'Priya Nair',
    'TUTOR', 'ACTIVE', 'America/Los_Angeles',
    30, 12,
    'PhD candidate in biochemistry. Teaches biology, chemistry, and AP sciences.',
    'https://meet.google.com/dev-priya',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000014',
    'carlos@tutors.simplifiedu.com', 'Carlos Rivera',
    'TUTOR', 'PENDING', 'America/Denver',
    20, 6,
    'Native Spanish speaker. Teaches conversational and academic Spanish.',
    NULL,
    now(), now()
  )
ON CONFLICT (id) DO NOTHING;

-- ── subjects ──────────────────────────────────────────────────────────────────

INSERT INTO public.subjects (name, category)
VALUES
  -- STEM
  ('Algebra I',          'STEM'),
  ('Algebra II',         'STEM'),
  ('Geometry',           'STEM'),
  ('Pre-Calculus',       'STEM'),
  ('Calculus AB',        'STEM'),
  ('Calculus BC',        'STEM'),
  ('Statistics',         'STEM'),
  ('Biology',            'STEM'),
  ('Chemistry',          'STEM'),
  ('Physics',            'STEM'),
  ('Computer Science',   'STEM'),
  ('Environmental Science', 'STEM'),
  -- Humanities
  ('Essay Writing',      'Humanities'),
  ('US History',         'Humanities'),
  ('World History',      'Humanities'),
  ('Government & Politics', 'Humanities'),
  ('Literature Analysis','Humanities'),
  ('Philosophy',         'Humanities'),
  -- Languages
  ('Spanish',            'Languages'),
  ('French',             'Languages'),
  ('Mandarin',           'Languages'),
  ('Latin',              'Languages'),
  -- Test Prep
  ('SAT Math',           'Test Prep'),
  ('SAT Reading & Writing', 'Test Prep'),
  ('ACT',                'Test Prep'),
  ('AP Exam Prep',       'Test Prep'),
  ('GRE',                'Test Prep'),
  -- Arts
  ('Music Theory',       'Arts'),
  ('Art History',        'Arts')
ON CONFLICT (name) DO NOTHING;

-- ── tutor_subjects ────────────────────────────────────────────────────────────
-- Reference subjects by name to stay UUID-agnostic.

INSERT INTO public.tutor_subjects (tutor_id, subject_id, confidence, qualification_note, graded_by)
SELECT
  ts.tutor_id,
  s.id AS subject_id,
  ts.confidence::public.confidence_level,
  ts.qualification_note,
  ts.graded_by
FROM (
  VALUES
    -- Emma Walsh: maths and physics
    ('00000000-0000-0000-0000-000000000011'::uuid, 'Calculus AB',   'HIGH',     'Taught 200+ hours of AP Calc AB.', '00000000-0000-0000-0000-000000000002'::uuid),
    ('00000000-0000-0000-0000-000000000011'::uuid, 'Calculus BC',   'HIGH',     'Scored 5 on AP Calc BC; tutored since 2021.', '00000000-0000-0000-0000-000000000002'::uuid),
    ('00000000-0000-0000-0000-000000000011'::uuid, 'Physics',       'HIGH',     'MIT undergrad coursework; 150+ hours tutored.', '00000000-0000-0000-0000-000000000002'::uuid),
    ('00000000-0000-0000-0000-000000000011'::uuid, 'Pre-Calculus',  'MEDIUM',   'Comfortable with all pre-calc topics.', '00000000-0000-0000-0000-000000000002'::uuid),
    ('00000000-0000-0000-0000-000000000011'::uuid, 'Statistics',    'UNPROVEN', 'I can cover intro stats; not yet graded.', NULL),

    -- James Okafor: writing and test prep
    ('00000000-0000-0000-0000-000000000012'::uuid, 'Essay Writing',          'HIGH',   '8 years classroom teaching; 500+ student essays graded.', '00000000-0000-0000-0000-000000000002'::uuid),
    ('00000000-0000-0000-0000-000000000012'::uuid, 'SAT Reading & Writing',  'HIGH',   'Average student score increase: +120 pts.', '00000000-0000-0000-0000-000000000002'::uuid),
    ('00000000-0000-0000-0000-000000000012'::uuid, 'Literature Analysis',    'HIGH',   'English Lit major; AP Lit teacher for 5 years.', '00000000-0000-0000-0000-000000000002'::uuid),
    ('00000000-0000-0000-0000-000000000012'::uuid, 'US History',             'MEDIUM', 'Taught as part of combined Humanities block.', '00000000-0000-0000-0000-000000000003'::uuid),
    ('00000000-0000-0000-0000-000000000012'::uuid, 'ACT',                    'MEDIUM', 'Familiar with ACT English and Reading sections.', '00000000-0000-0000-0000-000000000002'::uuid),

    -- Priya Nair: life sciences and chemistry
    ('00000000-0000-0000-0000-000000000013'::uuid, 'Biology',       'HIGH',   'PhD candidate in biochemistry; 300+ hours tutored.', '00000000-0000-0000-0000-000000000003'::uuid),
    ('00000000-0000-0000-0000-000000000013'::uuid, 'Chemistry',     'HIGH',   'Biochem PhD; TA for gen chem two years running.', '00000000-0000-0000-0000-000000000003'::uuid),
    ('00000000-0000-0000-0000-000000000013'::uuid, 'AP Exam Prep',  'HIGH',   'AP Bio and AP Chem specialist.', '00000000-0000-0000-0000-000000000003'::uuid),
    ('00000000-0000-0000-0000-000000000013'::uuid, 'Statistics',    'MEDIUM', 'Solid stats background from research methods coursework.', '00000000-0000-0000-0000-000000000003'::uuid),
    ('00000000-0000-0000-0000-000000000013'::uuid, 'Algebra II',    'LOW',    'Can cover basics but prefer to focus on sciences.', '00000000-0000-0000-0000-000000000003'::uuid),

    -- Carlos Rivera: Spanish (PENDING tutor, so UNPROVEN grades)
    ('00000000-0000-0000-0000-000000000014'::uuid, 'Spanish',       'UNPROVEN', 'Native speaker from Mexico City; currently setting up calendar.', NULL)
) AS ts(tutor_id, subject_name, confidence, qualification_note, graded_by)
JOIN public.subjects s ON s.name = ts.subject_name
ON CONFLICT (tutor_id, subject_id) DO NOTHING;

-- ── tutor_context ─────────────────────────────────────────────────────────────

INSERT INTO public.tutor_context (tutor_id, context, updated_by)
VALUES
  (
    '00000000-0000-0000-0000-000000000011',
    '{
      "teaching_style": "Visual and structured. Emma works best with students who respond to diagrams and step-by-step breakdowns. Avoid purely verbal explanations.",
      "strengths": ["calculus", "physics", "patient with struggling students"],
      "avoid": ["last-minute bookings", "sessions longer than 90 min"],
      "coordinator_notes": "Emma prefers a maximum of 3 students per day. She''s excellent for students prepping for MIT/Caltech applications."
    }'::jsonb,
    '00000000-0000-0000-0000-000000000002'
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    '{
      "teaching_style": "Socratic. James asks questions rather than lecturing. Best for self-motivated students who can handle being challenged.",
      "strengths": ["essay structure", "SAT verbal", "college application essays"],
      "avoid": ["STEM subjects", "students below 7th grade reading level"],
      "coordinator_notes": "James is our go-to for competitive college essay prep. Book him early — he fills up fast in Oct/Nov."
    }'::jsonb,
    '00000000-0000-0000-0000-000000000002'
  ),
  (
    '00000000-0000-0000-0000-000000000013',
    '{
      "teaching_style": "Concept-first. Priya always explains the ''why'' before procedures. Great for curious students; may frustrate students who just want the formula.",
      "strengths": ["AP Biology", "AP Chemistry", "lab report writing"],
      "avoid": ["pure maths beyond algebra", "test-taking strategy coaching"],
      "coordinator_notes": "Priya is finishing her dissertation — limit to 4 sessions/week max until June."
    }'::jsonb,
    '00000000-0000-0000-0000-000000000003'
  )
ON CONFLICT (tutor_id) DO NOTHING;
