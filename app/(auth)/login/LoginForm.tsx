'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';

type FormState = 'idle' | 'loading' | { error: string };

export function LoginForm({ linkExpired }: { linkExpired?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState('loading');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setFormState({ error: error.message });
    } else {
      router.replace('/');
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setFormState({ error: 'Enter your email address first.' });
      return;
    }
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setResetSent(true);
  }

  const errorMessage = typeof formState === 'object' ? formState.error : undefined;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in to Simplifi EDU</CardTitle>
      </CardHeader>
      {linkExpired && (
        <p className="text-sm text-danger-ink mb-3">
          That link has expired. Please sign in with your password.
        </p>
      )}
      {resetSent && (
        <p className="text-sm text-fg-2 mb-3">
          Password reset email sent to <strong className="text-fg-1">{email}</strong>.
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
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={formState === 'loading'}
          error={errorMessage}
        />
        <button
          type="button"
          onClick={handleForgotPassword}
          className="text-xs text-fg-3 hover:text-fg-1 transition-colors text-left -mt-2"
        >
          Forgot password?
        </button>
        <Button type="submit" size="lg" disabled={formState === 'loading'} className="w-full">
          {formState === 'loading' ? 'Signing in\u2026' : 'Sign in'}
        </Button>
      </form>
    </Card>
  );
}
