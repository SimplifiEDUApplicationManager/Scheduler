'use client';

import { useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';

type FormState = 'idle' | 'loading' | 'success' | { error: string };

export function LoginForm({ linkExpired }: { linkExpired?: boolean }) {
  const [email, setEmail] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState('loading');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setFormState({ error: error.message });
    } else {
      setFormState('success');
    }
  }

  if (formState === 'success') {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
        </CardHeader>
        <p className="text-body text-fg-2">
          We sent a magic link to <strong className="text-fg-1">{email}</strong>. Click it to sign
          in — the link expires in 1 hour.
        </p>
      </Card>
    );
  }

  const errorMessage = typeof formState === 'object' ? formState.error : undefined;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in to Simplifi EDU</CardTitle>
      </CardHeader>
      {linkExpired && (
        <p className="text-sm text-danger-ink mb-3">
          That link has expired. Enter your email to get a new one.
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email address"
          type="email"
          placeholder="you@simplifiedu.com"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={formState === 'loading'}
          error={errorMessage}
        />
        <Button type="submit" size="lg" disabled={formState === 'loading'} className="w-full">
          {formState === 'loading' ? 'Sending\u2026' : 'Send magic link'}
        </Button>
      </form>
    </Card>
  );
}
