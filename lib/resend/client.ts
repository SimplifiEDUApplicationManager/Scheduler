// lib/resend/client.ts
// Server-side only. Never import from client components.

import { Resend } from 'resend';

let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('Missing env var: RESEND_API_KEY');
    _resend = new Resend(apiKey);
  }
  return _resend;
}

export const FROM = 'Simplifi EDU <info@simplifiedu.com>';
