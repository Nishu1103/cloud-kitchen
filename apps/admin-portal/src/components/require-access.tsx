'use client';

import type { Permission } from '@ck/types';
import { Button, EmptyState, Spinner } from '@ck/ui';
import { Lock, ShieldOff } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useSession } from '@/lib/session';

/**
 * Gate for a screen that needs a session and optionally a permission.
 *
 * Presentation only — the API enforces both on every request. Permissions are
 * checked, never roles.
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
        title="Sign in to continue"
        description="Campus operations live behind your admin account."
        action={
          <Button asChild>
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
        description="Your account does not include this permission. A super admin can grant it."
      />
    );
  }

  return <>{children}</>;
}
