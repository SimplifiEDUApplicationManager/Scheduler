'use client';

import { NylasScheduling } from '@nylas/react';
import '@nylas/react/style.css';

interface Props {
  configId: string;
  tutorName: string;
}

export function BookingPage({ configId, tutorName }: Props) {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#71717A', marginBottom: 4 }}>Simplifi EDU</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#18181B', margin: 0 }}>
            Book a session with {tutorName}
          </h1>
        </div>
        <NylasScheduling
          configurationId={configId}
          schedulerApiUrl="https://api.us.nylas.com"
        />
      </div>
    </div>
  );
}
