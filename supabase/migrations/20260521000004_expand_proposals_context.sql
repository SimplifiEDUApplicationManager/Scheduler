-- Expand proposals with structured student context and free-form schedule notes.
-- All columns are nullable — existing proposals remain valid.
--
-- student_grade:   grade level text, e.g. "11th grade" or "Junior"
-- parent_name:     parent/guardian name for coordinator reference
-- test_name:       the test or subject being prepped for, e.g. "SAT", "AP Calc BC"
-- starting_score:  student's current/recent score (integer)
-- goal_score:      target score (integer)
-- test_dates:      free-form text, e.g. "May 3, June 7"
-- accommodations:  free-form text describing any accommodations
-- schedule_notes:  free-form schedule description alongside the structured tuples,
--                  e.g. "Weekday evenings, 4–7:30 — could stretch to 8:30 on Tues"

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS student_grade  text,
  ADD COLUMN IF NOT EXISTS parent_name    text,
  ADD COLUMN IF NOT EXISTS test_name      text,
  ADD COLUMN IF NOT EXISTS starting_score smallint,
  ADD COLUMN IF NOT EXISTS goal_score     smallint,
  ADD COLUMN IF NOT EXISTS test_dates     text,
  ADD COLUMN IF NOT EXISTS accommodations text,
  ADD COLUMN IF NOT EXISTS schedule_notes text;
