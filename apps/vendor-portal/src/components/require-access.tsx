'use client';

import type { Permission } from '@ck/types';
import { Button, EmptyState, Spinner } from '@ck/ui';
import { Lock, ShieldOff, Store } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useSession } from '@/lib/session';

/**
 * Gate for a screen that needs a session, a permission, or a linked kitchen.
 *
 * Presentation only — the API enforces all three on every request, so this exists to
 * avoid showing an empty screen and a wall of 401s, not as a security boundary. Tokens
 * live in httpOnly cookies, which is also why the check happens on the client: a server
 * component cannot read the session without forwarding cookies to the API.
 *
 * Permissions are checked, never roles. "Owner" and "staff" are just bundles, and a
 * campus can define its own.
 */
export function RequireAccess({
  children,
  permission,
  requiresKitchen = true,
}: {
  children: ReactNode;
  permission?: Permission;
  /** Screens that need a kitchen to exist; onboarding is the exception. */
  requiresKitchen?: boolean;
}) {
  const { user, isLoading, can, vendorId } = useSession();
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
        description="Your kitchen's orders, menu and earnings live in your account."
        action={
          <Button asChild>
            {/* Returns to where they were headed instead of dumping them on the board. */}
            <Link href={`/login?next=${encodeURIComponent(pathname)}`}>Sign in</Link>
          </Button>
        }
      />
    );
  }

  if (requiresKitchen && !vendorId) {
    return (
      <EmptyState
        icon={<Store aria-hidden className="h-6 w-6" />}
        title="No kitchen linked yet"
        description="This account is not attached to a kitchen. Ask your campus admin to link it, or finish onboarding if you are setting one up."
      />
    );
  }

  if (permission && !can(permission)) {
    return (
      <EmptyState
        icon={<ShieldOff aria-hidden className="h-6 w-6" />}
        title="You do not have access to this"
        description="Your account does not include this permission. The kitchen owner can grant it."
      />
    );
  }

  return <>{children}</>;
}
