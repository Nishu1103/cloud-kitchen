'use client';

import { errorMessage } from '@ck/sdk';
import { PASSWORD_RULES, PHONE_PATTERN, passwordProblem } from '@ck/types';
import { Alert, Button, Field, Input } from '@ck/ui';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AuthShell } from '@/components/auth-shell';
import { api } from '@/lib/api';
import { env } from '@/lib/env';

function RegisterForm() {
  const params = useSearchParams();
  const next = params.get('next');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const register = useMutation({
    mutationFn: (payload: {
      name: string;
      email: string;
      password: string;
      phone?: string;
      referralCode?: string;
    }) => api.auth.register({ ...payload, campusSlug: env.campusSlug }),
  });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const phone = String(form.get('phone') ?? '').trim();
    const referralCode = String(form.get('referralCode') ?? '').trim();

    // Validated here against the same shared rules the API enforces, so a weak password
    // is caught before a round trip rather than after one.
    const found: Record<string, string> = {};
    if (name.length < 2) found.name = 'Enter your full name.';
    const passwordIssue = passwordProblem(password);
    if (passwordIssue) found.password = passwordIssue;
    if (phone && !PHONE_PATTERN.test(phone)) {
      found.phone = 'Enter a 10-digit Indian mobile number.';
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    register.mutate({
      name,
      email,
      password,
      phone: phone || undefined,
      referralCode: referralCode || undefined,
    });
  };

  if (register.isSuccess) {
    return (
      <AuthShell
        title="Check your email"
        description="We sent a verification link to finish setting up your account."
      >
        <div className="space-y-4 text-center">
          <CheckCircle2 aria-hidden className="mx-auto h-10 w-10 text-success" />
          <p className="text-body text-ink-muted">
            {register.data?.emailVerificationRequired
              ? 'Verify your email, then sign in and start ordering.'
              : 'Your account is ready.'}
          </p>
          <Button block asChild>
            <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}>
              Go to sign in
            </Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      description="One account for every kitchen on campus."
      footer={
        <>
          Already registered?{' '}
          <Link
            href="/login"
            className="font-medium text-brand underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      {register.isError ? (
        <Alert tone="danger" title="Could not create your account">
          {errorMessage(register.error)}
        </Alert>
      ) : null}

      <form className="space-y-4" onSubmit={submit} noValidate>
        <Field label="Full name" error={errors.name} required>
          <Input name="name" autoComplete="name" required autoFocus maxLength={80} />
        </Field>

        <Field label="Campus email" hint="Your campus address gets you campus pricing." required>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@iitkgp.ac.in"
          />
        </Field>

        <Field label="Password" error={errors.password} hint={PASSWORD_RULES.hint} required>
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_RULES.min}
            maxLength={PASSWORD_RULES.max}
          />
        </Field>

        <Field
          label="Mobile"
          error={errors.phone}
          hint="Optional, but riders use it to reach you."
        >
          <Input
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="9876543210"
          />
        </Field>

        <Field label="Referral code" hint="Optional.">
          <Input name="referralCode" maxLength={12} className="uppercase" />
        </Field>

        <Button type="submit" block size="lg" loading={register.isPending}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
