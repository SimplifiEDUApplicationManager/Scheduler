'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';

type PageState = 'verifying' | 'ready' | 'loading' | 'success' | { error: string };

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<PageState>('verifying');

  // On mount, exchange the token_hash from the URL for a session
  useEffect(() => {
    const supabase = createClient();
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type');

    if (tokenHash && type === 'recovery') {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        .then(({ error }) => {
          setState(error ? { error: error.message } : 'ready');
        });
    } else {
      // No token — user might have arrived via auth callback redirect
      supabase.auth.getUser().then(({ data: { user } }) => {
        setState(user ? 'ready' : { error: 'Invalid or expired reset link. Please request a new one.' });
      });
    }
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 8) {
      setState({ error: 'Password must be at least 8 characters.' });
      return;
    }
    if (password !== confirm) {
      setState({ error: 'Passwords do not match.' });
      return;
    }

    setState('loading');
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setState({ error: error.message });
    } else {
      setState('success');
    }
  }

  if (state === 'verifying') {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Verifying link...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (state === 'success') {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Password updated</CardTitle>
        </CardHeader>
        <p className="text-body text-fg-2 mb-4">
          Your password has been changed. You can now sign in with your new password.
        </p>
        <Button size="lg" className="w-full" onClick={() => router.replace('/login')}>
          Go to sign in
        </Button>
      </Card>
    );
  }

  const errorMessage = typeof state === 'object' ? state.error : undefined;
  const isReady = state === 'ready' || state === 'loading';

  if (!isReady && errorMessage) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Reset link expired</CardTitle>
        </CardHeader>
        <p className="text-sm text-danger-ink mb-4">{errorMessage}</p>
        <Button size="lg" className="w-full" onClick={() => router.replace('/login')}>
          Back to sign in
        </Button>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={state === 'loading'}
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={state === 'loading'}
          error={typeof state === 'object' ? state.error : undefined}
        />
        <Button type="submit" size="lg" disabled={state === 'loading'} className="w-full">
          {state === 'loading' ? 'Updating\u2026' : 'Update password'}
        </Button>
      </form>
    </Card>
  );
}
