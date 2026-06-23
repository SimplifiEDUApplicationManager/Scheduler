'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';

type FormState = 'idle' | 'loading' | 'success' | { error: string };

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 8) {
      setFormState({ error: 'Password must be at least 8 characters.' });
      return;
    }
    if (password !== confirm) {
      setFormState({ error: 'Passwords do not match.' });
      return;
    }

    setFormState('loading');
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

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

  const errorMessage = typeof formState === 'object' ? formState.error : undefined;

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
          disabled={formState === 'loading'}
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={formState === 'loading'}
          error={errorMessage}
        />
        <Button type="submit" size="lg" disabled={formState === 'loading'} className="w-full">
          {formState === 'loading' ? 'Updating\u2026' : 'Update password'}
        </Button>
      </form>
    </Card>
  );
}
