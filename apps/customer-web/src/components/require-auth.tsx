'use client';

import { Button, EmptyState, Spinner } from '@ck/ui';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useSession } from '@/lib/session';

/**
 * Gate for screens that need a session.
 *
 * Presentation only — the API enforces access on every request, so this exists to avoid
 * showing an empty screen and a wall of 401s, not as a security boundary. Tokens are in
 * httpOnly cookies, which is also why this check happens on the client: the server
 * component cannot read the session without forwarding cookies to the API.
 */
export function RequireAuth({ children, message }: { children: ReactNode; message?: string }) {
  const { user, isLoading } = useSession();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Checking your session" />
      </div>
    );
  }

  if (!user) {
    return (
      <EmptyState
        icon={<Lock aria-hidden className="h-6 w-6" />}
        title="Sign in to continue"
        description={message ?? 'Your cart, orders and wallet live in your account.'}
        action={
          <Button asChild>
            {/* Returns to where they were headed instead of dumping them on the home page. */}
            <Link href={`/login?next=${encodeURIComponent(pathname)}`}>Sign in</Link>
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
