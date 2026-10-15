'use client';

import { Alert, Button, Field, Input } from '@ck/ui';
import { useMutation } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { api } from '@/lib/api';
import { env } from '@/lib/env';

export default function ForgotPasswordPage() {
  const request = useMutation({
    mutationFn: (email: string) => api.auth.forgotPassword(email, env.campusSlug),
  });

  // Success and failure are shown identically on purpose: a distinct "no such account"
  // message would turn this form into a way to enumerate who has registered.
  if (request.isSuccess || request.isError) {
    return (
      <AuthShell title="Check your email">
        <div className="space-y-4 text-center">
          <MailCheck aria-hidden className="mx-auto h-10 w-10 text-brand" />
          <p className="text-body text-ink-muted">
            If that address has an account, a reset link is on its way. The link expires in
            30 minutes.
          </p>
          <Button variant="secondary" block asChild>
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      description="We will email you a link."
      footer={
        <Link href="/login" className="font-medium text-brand underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <Alert tone="info">
        Use the campus email you registered with.
      </Alert>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          request.mutate(String(form.get('email') ?? '').trim());
        }}
      >
        <Field label="Campus email" required>
          <Input name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <Button type="submit" block size="lg" loading={request.isPending}>
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
