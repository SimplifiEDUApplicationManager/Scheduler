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
import { sendInviteEmail, sendMagicLinkEmail } from '@/lib/resend/emails';

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
 * Verify the Supabase hook JWT.
 * hookSecret format: "v1,whsec_<base64-encoded-key>"
 * Supabase signs with HS256 using the raw key bytes decoded from whsec_.
 */
function verifyHookSignature(authHeader: string | null, hookSecret: string): boolean {
  if (!authHeader) return false;
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  const parts = jwt.split('.');
  if (parts.length !== 3) return false;
  const [header, payload, signature] = parts;

  const match = hookSecret.match(/whsec_([A-Za-z0-9+/=]+)/);
  if (!match) return false;
  const keyBytes = Buffer.from(match[1], 'base64');

  const expected = createHmac('sha256', keyBytes)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return expected === signature;
}

export async function POST(req: NextRequest) {
  const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  if (hookSecret) {
    if (!verifyHookSignature(req.headers.get('authorization'), hookSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  } else {
    // magiclink, signup, recovery, email_change
    result = await sendMagicLinkEmail(user.email, actionLink);
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({});
}
