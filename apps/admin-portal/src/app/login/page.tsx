'use client';

import { errorMessage, isApiError } from '@ck/sdk';
import { Alert, Button, Card, CardBody, Field, Input } from '@ck/ui';
import { Eye, EyeOff, Flag } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { env } from '@/lib/env';
import { useLogin, useSession } from '@/lib/session';

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
  const wrongPortal = isApiError(login.error) && login.error.status === 403;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-muted px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <p className="flex items-center justify-center gap-2 text-title-lg font-semibold text-brand">
            <Flag aria-hidden className="h-6 w-6" />
            {env.appName}
          </p>
          <h1 className="text-title text-ink">Admin sign in</h1>
          <p className="text-caption text-ink-muted">
            Campus operators and super admins. Kitchens and riders have their own portals.
          </p>
        </div>

        <Card>
          <CardBody className="space-y-4">
            {expired ? (
              <Alert tone="warning" title="Session expired">
                Sign in again to continue.
              </Alert>
            ) : null}

            {login.isError ? (
              <Alert
                tone="danger"
                title={
                  rateLimited
                    ? 'Too many attempts'
                    : wrongPortal
                      ? 'Not an admin account'
                      : 'Could not sign in'
                }
              >
                {rateLimited
                  ? 'Wait a minute before trying again.'
                  : wrongPortal
                    ? 'This account cannot use the admin portal.'
                    : errorMessage(login.error)}
              </Alert>
            ) : null}

            <form className="space-y-4" onSubmit={submit}>
              <Field label="Work email" required>
                <Input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  placeholder="admin@campuskitchen.in"
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
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
