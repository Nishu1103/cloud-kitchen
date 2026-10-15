'use client';

import type { Permission } from '@ck/types';
import { Button, EmptyState, Spinner } from '@ck/ui';
import { Lock, ShieldOff } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useSession } from '@/lib/session';

/**
 * Gate for a screen that needs a session or a permission.
 *
 * Presentation only — the API enforces both on every request, so this exists to avoid
 * showing an empty screen and a wall of 401s, not as a security boundary. Tokens live in
 * httpOnly cookies, which is also why the check happens on the client: a server
 * component cannot read the session without forwarding cookies to the API.
 *
 * Permissions are checked, never roles. A campus can define its own bundles, and a
 * trainee rider who cannot yet accept jobs is a permission difference, not a new role.
 */
export function RequireAccess({
  children,
  permission,
}: {
  children: ReactNode;
  permission?: Permission;
}) {
  const { user, isLoading, can } = useSession();
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
        title="Sign in to start your shift"
        description="Your jobs and earnings live in your account."
        action={
          <Button asChild>
            {/* Returns to where they were headed instead of dumping them on the run screen. */}
            <Link href={`/login?next=${encodeURIComponent(pathname)}`}>Sign in</Link>
          </Button>
        }
      />
    );
  }

  if (permission && !can(permission)) {
    return (
      <EmptyState
        icon={<ShieldOff aria-hidden className="h-6 w-6" />}
        title="You do not have access to this"
        description="Your account does not include this permission. Ask your campus admin."
      />
    );
  }

  return <>{children}</>;
}
