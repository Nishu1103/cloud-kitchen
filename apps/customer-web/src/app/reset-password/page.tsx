'use client';

import { errorMessage } from '@ck/sdk';
import { PASSWORD_RULES, passwordProblem } from '@ck/types';
import { Alert, Button, Field, Input } from '@ck/ui';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthShell } from '@/components/auth-shell';
import { api } from '@/lib/api';

function ResetForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [error, setError] = useState<string | null>(null);

  const reset = useMutation({
    mutationFn: (password: string) => api.auth.resetPassword(token, password),
  });

  if (!token) {
    return (
      <AuthShell title="Link not valid">
        <Alert tone="danger" title="Missing reset token">
          Open the link from your email again, or request a new one.
        </Alert>
        <Button block asChild>
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </AuthShell>
    );
  }

  if (reset.isSuccess) {
    return (
      <AuthShell title="Password updated">
        <div className="space-y-4 text-center">
          <ShieldCheck aria-hidden className="mx-auto h-10 w-10 text-success" />
          <p className="text-body text-ink-muted">
            Every other device has been signed out. Sign in with your new password.
          </p>
          <Button block asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password">
      {reset.isError ? (
        <Alert tone="danger" title="Could not reset your password">
          {errorMessage(reset.error)} Reset links expire after 30 minutes.
        </Alert>
      ) : null}

      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const password = String(form.get('password') ?? '');
          const confirm = String(form.get('confirm') ?? '');

          const issue = passwordProblem(password) ?? (password === confirm ? null : 'Both passwords must match.');
          setError(issue);
          if (issue) return;

          reset.mutate(password);
        }}
      >
        <Field label="New password" hint={PASSWORD_RULES.hint} required>
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            autoFocus
            minLength={PASSWORD_RULES.min}
            maxLength={PASSWORD_RULES.max}
          />
        </Field>

        <Field label="Confirm new password" error={error ?? undefined} required>
          <Input name="confirm" type="password" autoComplete="new-password" required />
        </Field>

        <Button type="submit" block size="lg" loading={reset.isPending}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
