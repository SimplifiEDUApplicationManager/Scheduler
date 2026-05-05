/**
 * scripts/seed-from-csv.ts
 *
 * Seeds Supabase with real users and subjects from active_tutors.csv.
 * Idempotent — safe to run multiple times.
 *
 * Usage (from project root):
 *   npx tsx scripts/seed-from-csv.ts [path/to/active_tutors.csv]
 *
 * Defaults to ../../active_tutors.csv (sibling of the project directory).
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Database } from '../lib/types/database';

// ── Env loading ────────────────────────────────────────────────────────────

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env'));
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Types ──────────────────────────────────────────────────────────────────

type Role = 'TUTOR' | 'COORDINATOR' | 'SUPER_ADMIN';

interface CsvRow {
  name:     string;
  email:    string;
  subjects: string[];  // raw "Base Name (Level)" strings from CSV
  role:     Role;
}

// ── CSV parsing ────────────────────────────────────────────────────────────

const ROLE_MAP: Record<string, Role> = {
  'Tutor':       'TUTOR',
  'Coordinator': 'COORDINATOR',
  'Super Admin': 'SUPER_ADMIN',
};

const SKIP_NAMES  = new Set(['General Expenses']);
const SKIP_EMAILS = new Set(['email@pchtutors.com']);

function parseLine(line: string): CsvRow | null {
  if (!line.trim()) return null;

  // Format: Name,Email,Phone,Subjects,Role
  // Subjects field uses "; " as separator and contains no commas.
  const firstComma  = line.indexOf(',');
  const secondComma = line.indexOf(',', firstComma + 1);
  const thirdComma  = line.indexOf(',', secondComma + 1);
  const lastComma   = line.lastIndexOf(',');

  if (firstComma < 0 || secondComma < 0 || thirdComma < 0) return null;
  if (thirdComma === lastComma) return null; // no role column

  const name     = line.slice(0, firstComma).trim();
  const email    = line.slice(firstComma + 1, secondComma).trim().toLowerCase();
  const subjects = line.slice(thirdComma + 1, lastComma).trim();
  const roleRaw  = line.slice(lastComma + 1).trim();

  if (!name || !email || !email.includes('@')) return null;
  if (SKIP_NAMES.has(name) || SKIP_EMAILS.has(email)) return null;

  const role = ROLE_MAP[roleRaw];
  if (!role) return null;

  return {
    name,
    email,
    role,
    subjects: subjects ? subjects.split(';').map(s => s.trim()).filter(Boolean) : [],
  };
}

// ── Subject helpers ────────────────────────────────────────────────────────

/** "Calculus I (College)" → "Calculus I" */
function stripLevel(raw: string): string {
  return raw.replace(/\s*\([^)]+\)$/, '').trim();
}

function categorize(name: string): string {
  const n = name.toLowerCase();
  if (/calculus|algebra|geometry|trigonometry|statistics|probability|pre-calc|pre-algebra|linear algebra/.test(n)) return 'STEM';
  if (/physics|chemistry|biology|anatomy|physiology|ecology|astronomy|oceanography|nutrition|organic|earth science|environmental science/.test(n)) return 'STEM';
  if (/python|java\b|programming|computer science|web design|r programming/.test(n)) return 'STEM';
  if (/history|economics|microeconomics|macroeconomics|politics|geography|sociology|psychology|philosophy|religion|government|political science|human geography/.test(n)) return 'Humanities';
  if (/english|writing|literature|grammar|poetry|essay|shakespeare|journalism|debate|speaking|research papers|esl|great books|study skills|film analysis|modern literature|world literature|american literature|british literature/.test(n)) return 'Humanities';
  if (/spanish|french|german|latin|japanese|italian|mandarin|chinese|korean|arabic/.test(n)) return 'Languages';
  if (/\bsat\b|act prep|\bisee\b|\bhspt\b|\bshsat\b|\bgre\b|\bgmat\b|sat prep|act prep/.test(n)) return 'Test Prep';
  if (/music|art history|theater|drama/.test(n)) return 'Arts';
  if (/marketing|entrepreneurship|introduction to business|accounting/.test(n)) return 'Business';
  return 'Other';
}

// ── Auth helpers ───────────────────────────────────────────────────────────

/** Loads all existing auth users, returns email → uuid map. */
async function loadExistingAuthUsers(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email) map.set(u.email.toLowerCase(), u.id);
    }
    if (!data.nextPage) break;
    page = data.nextPage;
  }
  return map;
}

async function getOrCreateAuthUser(
  email: string,
  name: string,
  existingAuthUsers: Map<string, string>,
): Promise<string | null> {
  const existing = existingAuthUsers.get(email);
  if (existing) return existing;

  // Create confirmed auth user (no password — will use magic link to log in)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name },
  });

  if (error) {
    console.error(`  auth.createUser failed: ${error.message}`);
    return null;
  }

  existingAuthUsers.set(email, data.user.id);
  return data.user.id;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const csvPath = process.argv[2]
    ?? path.resolve(process.cwd(), '..', 'active_tutors.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found at: ${csvPath}`);
    console.error('Pass the path as an argument: npx tsx scripts/seed-from-csv.ts /path/to/active_tutors.csv');
    process.exit(1);
  }

  const lines = fs.readFileSync(csvPath, 'utf-8').split('\n');
  const rows: CsvRow[] = [];
  for (const line of lines.slice(1)) {
    const row = parseLine(line);
    if (row) rows.push(row);
  }
  console.log(`Parsed ${rows.length} users from CSV\n`);

  // ── Step 1: subjects ─────────────────────────────────────────────────────

  // Fetch existing subjects
  const { data: existingSubjects, error: fetchErr } = await supabase
    .from('subjects')
    .select('id, name');
  if (fetchErr) throw fetchErr;

  const subjectMap = new Map<string, string>(); // base name → id
  for (const s of existingSubjects ?? []) subjectMap.set(s.name, s.id);

  // Collect new base names from tutors
  const toInsert: { name: string; category: string }[] = [];
  for (const row of rows) {
    if (row.role !== 'TUTOR') continue;
    for (const raw of row.subjects) {
      const name = stripLevel(raw);
      if (name && !subjectMap.has(name) && !toInsert.some(s => s.name === name)) {
        toInsert.push({ name, category: categorize(name) });
      }
    }
  }

  if (toInsert.length > 0) {
    console.log(`Inserting ${toInsert.length} new subjects...`);
    const { data: inserted, error } = await supabase
      .from('subjects')
      .insert(toInsert)
      .select('id, name');
    if (error) throw error;
    for (const s of inserted ?? []) subjectMap.set(s.name, s.id);
    console.log(`  Done — ${inserted?.length ?? 0} inserted\n`);
  } else {
    console.log('No new subjects to insert\n');
  }

  // ── Step 2: auth users + public.users ────────────────────────────────────

  console.log('Loading existing auth users...');
  const existingAuthUsers = await loadExistingAuthUsers();
  console.log(`  Found ${existingAuthUsers.size} existing auth users\n`);

  console.log('Creating users...');
  const userIdMap = new Map<string, string>(); // email → uuid

  for (const row of rows) {
    process.stdout.write(`  ${row.name} <${row.email}> [${row.role}] ... `);
    try {
      const id = await getOrCreateAuthUser(row.email, row.name, existingAuthUsers);
      if (!id) { process.stdout.write('SKIP (auth failed)\n'); continue; }

      const { error } = await supabase.from('users').upsert({
        id,
        email:            row.email,
        name:             row.name,
        role:             row.role,
        status:           'ACTIVE',
        max_weekly_hours: row.role === 'TUTOR' ? 20 : 40,
        min_weekly_hours: 6,
      }, { onConflict: 'id' });

      if (error) throw error;
      userIdMap.set(row.email, id);
      process.stdout.write('OK\n');
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      process.stdout.write(`ERROR — ${msg}\n`);
    }
  }

  // ── Step 3: tutor_subjects ───────────────────────────────────────────────

  console.log('\nLinking tutor subjects...');
  let linkedCount = 0;

  for (const row of rows) {
    if (row.role !== 'TUTOR' || row.subjects.length === 0) continue;
    const tutorId = userIdMap.get(row.email);
    if (!tutorId) continue;

    const seen = new Set<string>();
    const links = row.subjects
      .map(raw => ({ tutor_id: tutorId, subject_id: subjectMap.get(stripLevel(raw)) ?? null }))
      .filter((l): l is { tutor_id: string; subject_id: string } => l.subject_id !== null)
      .filter(l => { if (seen.has(l.subject_id)) return false; seen.add(l.subject_id); return true; });

    if (links.length === 0) continue;

    const { error } = await supabase.from('tutor_subjects').upsert(
      links.map(l => ({
        tutor_id:   l.tutor_id,
        subject_id: l.subject_id,
        confidence: 'UNPROVEN' as const,
      })),
      { onConflict: 'tutor_id,subject_id' },
    );

    if (error) {
      console.error(`  ERROR linking subjects for ${row.email}: ${error.message}`);
    } else {
      linkedCount += links.length;
    }
  }

  console.log(`  Linked ${linkedCount} tutor-subject pairs\n`);
  console.log('Seed complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
