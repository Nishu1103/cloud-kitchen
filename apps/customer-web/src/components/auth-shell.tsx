import { Card, CardBody } from '@ck/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { env } from '@/lib/env';

/**
 * Chrome for the auth screens.
 *
 * Deliberately free of navigation: nothing here should tempt a half-signed-in student
 * back into the app, and there is nothing to browse until the session exists.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <Link href="/" className="font-display text-title-lg font-semibold text-brand">
            {env.appName}
          </Link>
          <h1 className="text-title text-ink">{title}</h1>
          {description ? <p className="text-caption text-ink-muted">{description}</p> : null}
        </div>

        <Card>
          <CardBody className="space-y-4">{children}</CardBody>
        </Card>

        {footer ? <div className="text-center text-caption text-ink-muted">{footer}</div> : null}

        <p className="text-center text-caption text-ink-subtle">
          By continuing you agree to our{' '}
          <Link href="/p/terms" className="underline underline-offset-4 hover:text-ink">
            terms
          </Link>{' '}
          and{' '}
          <Link href="/p/privacy" className="underline underline-offset-4 hover:text-ink">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
