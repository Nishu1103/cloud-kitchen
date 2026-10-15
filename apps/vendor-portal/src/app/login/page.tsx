'use client';

import { errorMessage, isApiError } from '@ck/sdk';
import { Alert, Button, Card, CardBody, Field, Input } from '@ck/ui';
import { ChefHat, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
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

  // Somebody already signed in who lands here (a stale bookmark, the back button) is
  // sent on rather than shown a form they do not need.
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
  /**
   * The API binds a session to one portal, so a student account signing in here is
   * refused with a 403 rather than a wrong password. Saying so plainly avoids a kitchen
   * assistant hammering a password that was never the problem.
   */
  const wrongPortal = isApiError(login.error) && login.error.status === 403;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="vendor-header rounded-3xl px-6 py-8 text-center">
          <p className="flex items-center justify-center gap-2 text-title font-semibold text-white">
            <ChefHat aria-hidden className="h-6 w-6" />
            Kitchen
          </p>
          <h1 className="mt-2 text-title-lg font-semibold text-white">Sign in</h1>
          <p className="mt-1 text-caption text-white/80">
            For kitchen owners and staff. Students order on the main site.
          </p>
        </div>

        <Card>
          <CardBody className="space-y-4">
            {expired ? (
              <Alert tone="warning" title="Session expired">
                Sign in again to get back to your orders.
              </Alert>
            ) : null}

            {login.isError ? (
              <Alert
                tone="danger"
                title={
                  rateLimited
                    ? 'Too many attempts'
                    : wrongPortal
                      ? 'Not a kitchen account'
                      : 'Could not sign in'
                }
              >
                {rateLimited
                  ? 'Wait a minute before trying again.'
                  : wrongPortal
                    ? 'This account cannot use the kitchen portal. Ask your campus admin to link it to your kitchen.'
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
                  placeholder="kitchen@campuskitchen.in"
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
