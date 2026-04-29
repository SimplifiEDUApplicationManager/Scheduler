import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const NYLAS_API = 'https://api.us.nylas.com';

type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
type HoursMap = Record<DayKey, [number, number][]>;

// Nylas day numbers: 0=Sun, 1=Mon … 6=Sat
const DAY_INDEX: Record<DayKey, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

function toNylasOpenHours(hours: HoursMap) {
  // Build a map of "HH:00-HH:00" → days[], then emit one rule per unique window.
  const windows: Record<string, number[]> = {};
  const hh = (n: number) => String(n).padStart(2, '0') + ':00';

  for (const dayKey of Object.keys(hours) as DayKey[]) {
    const blocks = hours[dayKey];
    for (const block of blocks) {
      const [start, end] = block;
      const wKey = `${hh(start)}-${hh(end)}`;
      if (!windows[wKey]) windows[wKey] = [];
      windows[wKey].push(DAY_INDEX[dayKey]);
    }
  }

  return Object.entries(windows).map(([wKey, days]) => {
    const [start, end] = wKey.split('-');
    return { days, start, end, exdates: [] };
  });
}

/**
 * PATCH /api/nylas/scheduler
 * Updates the tutor's Nylas Scheduler configuration with new working hours and break time.
 * Called from the onboarding Hours step and from the Settings page.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as { hours: HoursMap; breakMin: number };
  const { hours, breakMin } = body;

  // Fetch user's Nylas identifiers
  const { data: userRow, error: dbError } = await supabase
    .from('users')
    .select('name, email, nylas_grant_id, nylas_scheduler_config_id')
    .eq('id', user.id)
    .single();

  if (dbError || !userRow) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { nylas_grant_id, nylas_scheduler_config_id, name, email } = userRow;

  if (!nylas_grant_id || !nylas_scheduler_config_id) {
    return NextResponse.json({ error: 'Calendar not connected' }, { status: 422 });
  }

  const openHours = toNylasOpenHours(hours);

  // PATCH the existing Scheduler configuration
  const res = await fetch(
    `${NYLAS_API}/v3/scheduling/configurations/${nylas_scheduler_config_id}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.NYLAS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        participants: [
          {
            name,
            email,
            is_organizer: true,
            availability: {
              calendar_ids: ['primary'],
              open_hours:   openHours,
            },
            booking: { calendar_id: 'primary' },
          },
        ],
        availability: {
          duration_minutes:  60,
          // interval_minutes acts as the slot size; breakMin is added as a buffer
          interval_minutes:  breakMin > 0 ? breakMin : 15,
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('[nylas/scheduler] PATCH failed:', err);
    return NextResponse.json({ error: 'Nylas error', detail: err }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
