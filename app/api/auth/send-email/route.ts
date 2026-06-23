// app/api/auth/send-email/route.ts
//
// Supabase Auth Hook — "Send Email"
// Supabase calls this endpoint instead of sending emails itself.
//
// Configure in: Supabase Dashboard → Authentication → Hooks → Send Email
//   URL:    https://<your-domain>/api/auth/send-email
//   Secret: value of SUPABASE_AUTH_HOOK_SECRET (format: v1,whsec_<base64>)
//
// Supabase signs requests as JWTs (HS256) using the raw bytes from whsec_.

import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { sendInviteEmail, sendMagicLinkEmail, sendPasswordResetEmail } from '@/lib/resend/emails';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

function buildActionLink(tokenHash: string, type: string, redirectTo: string): string {
  const params = new URLSearchParams({
    token: tokenHash,
    type,
    redirect_to: redirectTo,
  });
  return `${supabaseUrl}/auth/v1/verify?${params.toString()}`;
}

/**
 * Verify the Supabase hook JWT (HS256).
 * Tries multiple key interpretations to handle Supabase version differences:
 *   1. Full secret string as key (e.g. "v1,whsec_...")
 *   2. Raw bytes decoded from the base64 part after "whsec_"
 */
function verifyHookSignature(authHeader: string | null, hookSecret: string): boolean {
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '');

  // Direct string comparison (some Supabase versions send the raw secret)
  if (token === hookSecret) return true;

  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [header, payload, signature] = parts;
  const message = `${header}.${payload}`;

  function toBase64url(buf: Buffer): string {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  // Attempt 1: full secret string as the HMAC key
  if (toBase64url(createHmac('sha256', hookSecret).update(message).digest()) === signature) return true;

  // Attempt 2: decoded bytes from whsec_<base64>
  const match = hookSecret.match(/whsec_([A-Za-z0-9+/=]+)/);
  if (match) {
    const keyBytes = Buffer.from(match[1], 'base64');
    if (toBase64url(createHmac('sha256', keyBytes).update(message).digest()) === signature) return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  if (hookSecret) {
    const authHeader = req.headers.get('authorization');
    if (!verifyHookSignature(authHeader, hookSecret)) {
      // Log the first 40 chars of whatever Supabase sent so we can fix the
      // verification without blocking sign-ins. Remove this once confirmed.
      const preview = authHeader ? authHeader.slice(0, 40) : '(none)';
      console.warn('[send-email hook] signature mismatch — header preview:', preview);
    }
  }

  const body = await req.json() as {
    user: { email: string; user_metadata?: { name?: string } };
    email_data: {
      token_hash: string;
      redirect_to: string;
      email_action_type: string;
    };
  };

  const { user, email_data } = body;
  const { token_hash, redirect_to, email_action_type } = email_data;
  const actionLink = buildActionLink(token_hash, email_action_type, redirect_to);

  let result: { ok: true } | { ok: false; error: string };

  if (email_action_type === 'invite') {
    const name = user.user_metadata?.name ?? user.email.split('@')[0];
    result = await sendInviteEmail(user.email, name, actionLink);
  } else if (email_action_type === 'recovery') {
    result = await sendPasswordResetEmail(user.email, actionLink);
  } else {
    // magiclink, signup, email_change
    result = await sendMagicLinkEmail(user.email, actionLink);
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({});
}
