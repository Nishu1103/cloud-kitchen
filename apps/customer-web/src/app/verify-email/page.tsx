'use client';

import { errorMessage } from '@ck/sdk';
import { Alert, Button, Spinner } from '@ck/ui';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AuthShell } from '@/components/auth-shell';
import { api } from '@/lib/api';

function Verify() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  // A query rather than a mutation so React Query dedupes it: email clients and link
  // scanners routinely open the URL more than once, and the token is single-use.
  const { isLoading, isError, error, isSuccess } = useQuery({
    queryKey: ['verify-email', token],
    queryFn: () => api.auth.verifyEmail(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  if (!token) {
    return (
      <AuthShell title="Link not valid">
        <Alert tone="danger" title="Missing verification token">
          Open the link from your email again.
        </Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Verifying your email">
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-ink-muted">
          <Spinner /> <span className="text-body">One moment…</span>
        </div>
      ) : isError ? (
        <div className="space-y-4">
          <Alert tone="danger" title="Could not verify">
            {errorMessage(error)} The link may have expired or already been used.
          </Alert>
          <Button variant="secondary" block asChild>
            <Link href="/login">Go to sign in</Link>
          </Button>
        </div>
      ) : isSuccess ? (
        <div className="space-y-4 text-center">
          <CheckCircle2 aria-hidden className="mx-auto h-10 w-10 text-success" />
          <p className="text-body text-ink-muted">Your email is verified.</p>
          <Button block asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      ) : null}
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
