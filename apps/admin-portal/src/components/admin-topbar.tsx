'use client';

import type { NavItem } from '@ck/ui';
import { Button, Menu, MenuContent, MenuItem, MenuTrigger } from '@ck/ui';
import { Bell, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useUnreadCount } from '@/hooks/use-admin';
import { useLogout, useSession } from '@/lib/session';
import { AdminJump } from './admin-jump';

function roleLabel(roles: string[]): string {
  const first = roles[0];
  if (!first) return 'Admin';
  return first.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AdminTopbar({ jumpItems }: { jumpItems: NavItem[] }) {
  const { user } = useSession();
  const logout = useLogout();
  const { data: unread } = useUnreadCount();
  const name = user?.name ?? 'Admin';

  return (
    <div className="flex w-full items-center gap-3">
      <AdminJump items={jumpItems} />

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/notifications"
          aria-label={unread?.unread ? `${unread.unread} unread alerts` : 'Notifications'}
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-ink"
        >
          <Bell aria-hidden className="h-5 w-5" />
          {unread?.unread ? (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />
          ) : null}
        </Link>

        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2 rounded-full px-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-caption font-semibold text-brand">
                {name.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden text-left lg:block">
                <span className="block text-caption font-semibold text-ink">{name}</span>
                <span className="block text-[11px] text-ink-muted">{roleLabel(user?.roles ?? [])}</span>
              </span>
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem
              destructive
              icon={<LogOut aria-hidden className="h-4 w-4" />}
              onSelect={() => logout.mutate()}
            >
              Sign out
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </div>
  );
}
