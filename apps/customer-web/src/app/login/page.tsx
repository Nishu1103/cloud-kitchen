'use client';

import { errorMessage, isApiError } from '@ck/sdk';
import { Alert, Button, Field, Input } from '@ck/ui';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AuthShell } from '@/components/auth-shell';
import { env } from '@/lib/env';
import { useLogin, useSession } from '@/lib/session';

/** Only same-origin paths are honoured, so `?next=` cannot be used as an open redirect. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const { user } = useSession();

  const [showPassword, setShowPassword] = useState(false);
  const next = safeNext(params.get('next'));
  const expired = params.get('expired') === '1';

  // A signed-in student who lands here (a stale bookmark, the back button) is sent on
  // rather than shown a form they do not need.
  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    login.mutate(
      {
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
        campusSlug: env.campusSlug,
      },
      { onSuccess: () => router.replace(next) },
    );
  };

  const rateLimited = isApiError(login.error) && login.error.status === 429;

  return (
    <AuthShell
      title="Sign in"
      description="Use your campus email."
      footer={
        <>
          New here?{' '}
          <Link
            href={`/register?next=${encodeURIComponent(next)}`}
            className="font-medium text-brand underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      {expired ? (
        <Alert tone="warning" title="Session expired">
          Sign in again to pick up where you left off.
        </Alert>
      ) : null}

      {login.isError ? (
        <Alert tone="danger" title={rateLimited ? 'Too many attempts' : 'Could not sign in'}>
          {rateLimited
            ? 'Wait a minute before trying again.'
            : errorMessage(login.error)}
        </Alert>
      ) : null}

      <form className="space-y-4" onSubmit={submit}>
        <Field label="Campus email" required>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            placeholder="you@iitkgp.ac.in"
          />
        </Field>

        <Field label="Password" required>
          <Input
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="text-ink-subtle hover:text-ink"
              >
                {showPassword ? (
                  <EyeOff aria-hidden className="h-4 w-4" />
                ) : (
                  <Eye aria-hidden className="h-4 w-4" />
                )}
              </button>
            }
          />
        </Field>

        <Button type="submit" block size="lg" loading={login.isPending}>
          Sign in
        </Button>
      </form>

      <Link
        href="/forgot-password"
        className="block text-center text-caption text-ink-muted underline-offset-4 hover:text-ink hover:underline"
      >
        Forgot your password?
      </Link>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
