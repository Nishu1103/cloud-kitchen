'use client';

import { PERMISSIONS } from '@ck/types';
import { Badge } from '@ck/ui';
import {
  BarChart3,
  Bell,
  ChevronRight,
  ExternalLink,
  LogOut,
  Megaphone,
  Settings,
  Star,
  Tags,
  UtensilsCrossed,
} from 'lucide-react';
import Link from 'next/link';
import { KitchenOpenSwitch } from '@/components/kitchen-open-switch';
import { RequireAccess } from '@/components/require-access';
import { VendorScreen } from '@/components/vendor-screen';
import { useUnreadCount } from '@/hooks/use-account';
import { useKitchen } from '@/hooks/use-kitchen';
import { env } from '@/lib/env';
import { useLogout, useSession } from '@/lib/session';
import { useRealtimeStatus } from '@/lib/realtime';

export default function MorePage() {
  const { can, user } = useSession();
  const { data: kitchen } = useKitchen();
  const { data: unread } = useUnreadCount();
  const logout = useLogout();
  const status = useRealtimeStatus();

  const links = [
    can(PERMISSIONS.ANALYTICS_VIEW_OWN)
      ? { href: '/analytics', label: 'Analytics', hint: 'Sales, payout, top dishes', icon: BarChart3 }
      : null,
    can(PERMISSIONS.COUPON_MANAGE)
      ? { href: '/coupons', label: 'Promotions', hint: 'Offers students can apply', icon: Tags }
      : null,
    can(PERMISSIONS.ANNOUNCEMENT_SEND_VENDOR_SCOPE)
      ? {
          href: '/promotions',
          label: 'Push to customers',
          hint: 'Capped at two a day',
          icon: Megaphone,
        }
      : null,
    can(PERMISSIONS.REVIEW_REPLY)
      ? { href: '/reviews', label: 'Reviews', hint: 'Replies from the kitchen', icon: Star }
      : null,
    can(PERMISSIONS.CATEGORY_MANAGE)
      ? { href: '/menu/sections', label: 'Menu sections', hint: 'How dishes are grouped', icon: UtensilsCrossed }
      : null,
    {
      href: '/notifications',
      label: 'Alerts',
      hint: unread?.unread ? `${unread.unread} unread` : 'Order and kitchen alerts',
      icon: Bell,
      badge: unread?.unread,
    },
    { href: '/settings', label: 'Kitchen settings', hint: 'Hours, fees, storefront', icon: Settings },
  ].filter(Boolean) as {
    href: string;
    label: string;
    hint: string;
    icon: typeof BarChart3;
    badge?: number;
  }[];

  return (
    <RequireAccess>
      <VendorScreen title="More">
        <div className="space-y-4">
          <section className="rounded-2xl bg-surface p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-body font-semibold text-ink">
                  {kitchen?.name ?? 'Your kitchen'}
                </p>
                <p className="truncate text-caption text-ink-muted">{user?.name}</p>
              </div>
              <Badge tone={status === 'connected' ? 'success' : 'warning'} size="sm">
                {status === 'connected' ? 'Live' : 'Reconnecting'}
              </Badge>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
              <span className="text-caption text-ink-muted">Accepting orders</span>
              <KitchenOpenSwitch />
            </div>
          </section>

          <ul className="overflow-hidden rounded-2xl bg-surface shadow-sm">
            {links.map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3.5 ${
                      index > 0 ? 'border-t border-line' : ''
                    }`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
                      <Icon aria-hidden className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-medium text-ink">{item.label}</span>
                      <span className="block truncate text-caption text-ink-muted">{item.hint}</span>
                    </span>
                    {item.badge ? (
                      <Badge tone="danger" size="sm">
                        {item.badge}
                      </Badge>
                    ) : null}
                    <ChevronRight aria-hidden className="h-4 w-4 text-ink-subtle" />
                  </Link>
                </li>
              );
            })}
          </ul>

          {kitchen?.slug ? (
            <a
              href={`${env.storefrontUrl}/kitchens/${kitchen.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl bg-surface px-4 py-3 text-caption font-medium text-brand shadow-sm"
            >
              View storefront
              <ExternalLink aria-hidden className="h-4 w-4" />
            </a>
          ) : null}

          <button
            type="button"
            onClick={() => logout.mutate()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-caption font-medium text-danger-ink"
          >
            <LogOut aria-hidden className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </VendorScreen>
    </RequireAccess>
  );
}
