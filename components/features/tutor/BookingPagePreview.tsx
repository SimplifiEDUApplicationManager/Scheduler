'use client';

import { useState } from 'react';
import type { Tutor } from '@/lib/types/domain';
import { Avatar } from '@/components/ui/Avatar';


const SLOTS_BY_DAY = [
  ['9:00 AM', '10:00 AM', '2:00 PM', '3:30 PM', '5:00 PM'],
  ['10:00 AM', '11:30 AM', '1:00 PM', '4:00 PM'],
  ['9:30 AM', '12:00 PM', '2:30 PM', '4:30 PM', '6:00 PM'],
  ['11:00 AM', '1:30 PM', '3:00 PM', '5:30 PM'],
  ['9:00 AM', '10:30 AM', '2:00 PM'],
];

function getUpcomingWeekdays(count: number) {
  const days: { label: string; num: number; month: string }[] = [];
  const d = new Date(); d.setDate(d.getDate() + 1);
  while (days.length < count) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      days.push({
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        num: d.getDate(),
        month: d.toLocaleDateString('en-US', { month: 'short' }),
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export function BookingPagePreview({ tutor, bookingUrl }: { tutor: Tutor; bookingUrl?: string }) {
  const [selectedDay, setSelectedDay]   = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [duration, setDuration]         = useState(60);
  const days  = getUpcomingWeekdays(5);
  const slots = SLOTS_BY_DAY[selectedDay] ?? [];
  const tz    = tutor.tz.split('/')[1]?.replace('_', ' ') ?? tutor.tz;

  return (
    <div style={{ border: '1px solid #E4E4E7', borderRadius: 12, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 2px rgba(22,32,51,0.04)' }}>
      {/* Browser chrome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F4F4F5', borderBottom: '1px solid #E4E4E7' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#EF4444', '#F59E0B', '#22C55E'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: 999, background: c }} />)}
        </div>
        <div style={{ flex: 1, background: '#fff', border: '1px solid #E4E4E7', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#71717A', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="#A1A1AA" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
            <rect x={2} y={4} width={6} height={5} rx={1} /><path d="M3.5 4V3a1.5 1.5 0 013 0v1" />
          </svg>
          {bookingUrl ? bookingUrl.replace(/^https?:\/\//, '') : 'book.nylas.com/…'}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Preview</span>
      </div>

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', minHeight: 300 }}>
        {/* Left: tutor info */}
        <div style={{ padding: 16, borderRight: '1px solid #F5F5F5', background: 'linear-gradient(180deg, #FAFAFA 0%, #fff 100%)' }}>
          <div style={{ marginBottom: 10 }}><Avatar initials={tutor.initials} size="xl" tone="brand" /></div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#18181B' }}>{tutor.name}</div>
          <div style={{ fontSize: 11, color: '#71717A', marginTop: 2 }}>Simplifi EDU Tutor</div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F5F5F5', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { icon: '⏱', text: `${duration} min session` },
              { icon: '🔗', text: 'Google Meet · auto-generated' },
              { icon: '🌐', text: tz },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#52525B' }}>
                <span style={{ fontSize: 12 }}>{icon}</span> {text}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F5F5F5' }}>
            <div style={{ fontSize: 10, color: '#A1A1AA', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Session length</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[30, 60, 90].map(v => (
                <button key={v} onClick={() => setDuration(v)} style={{ flex: 1, height: 26, borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', background: duration === v ? '#2B7265' : '#fff', color: duration === v ? '#fff' : '#3F3F46', border: `1px solid ${duration === v ? '#2B7265' : '#E4E4E7'}` }}>
                  {v}m
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: day + slot picker */}
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#18181B', marginBottom: 2 }}>Select a time</div>
          <div style={{ fontSize: 11, color: '#A1A1AA', marginBottom: 12 }}>All times shown in your local timezone.</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {days.map((day, i) => {
              const active = selectedDay === i;
              return (
                <button key={i} onClick={() => { setSelectedDay(i); setSelectedSlot(null); }} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, background: active ? '#18181B' : '#fff', color: active ? '#fff' : '#3F3F46', border: `1px solid ${active ? '#18181B' : '#E4E4E7'}`, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: active ? 'rgba(255,255,255,0.6)' : '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{day.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{day.num}</div>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {slots.map((t, i) => {
              const active = selectedSlot === i;
              return (
                <button key={i} onClick={() => setSelectedSlot(i)} style={{ height: 34, borderRadius: 8, background: active ? '#2B7265' : '#fff', color: active ? '#fff' : '#18181B', border: `1px solid ${active ? '#2B7265' : '#E4E4E7'}`, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                  {t}
                </button>
              );
            })}
          </div>
          {selectedSlot !== null && slots[selectedSlot] && (
            <div style={{ marginTop: 12, padding: 12, background: '#F0FDF9', border: '1px solid #A7F3D0', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F4D40' }}>{days[selectedDay].label}, {days[selectedDay].month} {days[selectedDay].num} · {slots[selectedSlot]}</div>
                <div style={{ fontSize: 11, color: '#47624E', marginTop: 2 }}>{duration}-minute session with {tutor.name.split(' ')[0]}</div>
              </div>
              <button style={{ height: 30, padding: '0 14px', borderRadius: 8, background: '#18181B', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>Confirm →</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '8px 14px', borderTop: '1px solid #F5F5F5', background: '#FAFAFA', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#A1A1AA' }}>
        <span>Powered by Nylas Scheduler</span>
        <span>This is a live preview of what students see.</span>
      </div>
    </div>
  );
}
