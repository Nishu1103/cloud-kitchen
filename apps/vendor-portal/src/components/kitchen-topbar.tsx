'use client';

import { PERMISSIONS, VENDOR_STATUS } from '@ck/types';
import {
  Badge,
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Switch,
  Tooltip,
} from '@ck/ui';
import { ExternalLink, LogOut, Settings, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useKitchen, useSetOpenState } from '@/hooks/use-kitchen';
import { env } from '@/lib/env';
import { useLogout, useSession } from '@/lib/session';

/**
 * The bar every screen shares.
 *
 * The open/closed switch lives here rather than on a settings page because it is used
 * mid-service, often with one hand: a kitchen that has run out of gas needs to stop
 * taking orders in one tap from wherever it happens to be.
 */
export function KitchenTopbar() {
  const { user, can } = useSession();
  const { data: kitchen } = useKitchen();
  const setOpen = useSetOpenState();
  const logout = useLogout();

  const approved = kitchen?.status === VENDOR_STATUS.APPROVED;
  const canToggle = can(PERMISSIONS.VENDOR_UPDATE_OWN) && approved;

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-semibold text-ink">
          {kitchen?.name ?? 'Your kitchen'}
        </p>
        {kitchen && !approved ? (
          <p className="text-caption text-ink-muted">
            {kitchen.status === VENDOR_STATUS.PENDING_APPROVAL
              ? 'Waiting for campus approval'
              : 'Not currently accepting orders'}
          </p>
        ) : null}
      </div>

      {kitchen ? (
        <Tooltip
          content={
            canToggle
              ? 'Students can only order while this is on'
              : approved
                ? 'You do not have permission to change this'
                : 'A kitchen can open once the campus approves it'
          }
        >
          <span className="flex items-center gap-2">
            <Switch
              checked={kitchen.isOpen}
              disabled={!canToggle || setOpen.isPending}
              onCheckedChange={(next) => setOpen.mutate(next)}
              aria-label="Accepting orders"
            />
            <Badge tone={kitchen.isOpen ? 'success' : 'neutral'} size="sm">
              {kitchen.isOpen ? 'Open' : 'Closed'}
            </Badge>
          </span>
        </Tooltip>
      ) : null}

      {kitchen?.slug ? (
        <Button variant="ghost" size="icon-sm" asChild>
          <a
            href={`${env.storefrontUrl}/kitchens/${kitchen.slug}`}
            target="_blank"
            // `noreferrer` as well as `noopener`: the storefront is a separate origin and
            // has no business knowing which admin screen linked to it.
            rel="noopener noreferrer"
            aria-label="View your storefront"
          >
            <ExternalLink aria-hidden className="h-4 w-4" />
          </a>
        </Button>
      ) : null}

      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Account menu">
            <UserRound aria-hidden className="h-4 w-4" />
          </Button>
        </MenuTrigger>
        <MenuContent align="end">
          <MenuItem asChild>
            <Link href="/settings" className="flex items-center gap-2">
              <Settings aria-hidden className="h-4 w-4" />
              Kitchen settings
            </Link>
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            destructive
            icon={<LogOut aria-hidden className="h-4 w-4" />}
            onSelect={() => logout.mutate()}
          >
            Sign out {user?.name ? `(${user.name.split(' ')[0]})` : ''}
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}
