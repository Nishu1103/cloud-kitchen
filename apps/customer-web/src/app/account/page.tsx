'use client';

import { Alert, Avatar } from '@ck/ui';
import {
  Bell,
  ChevronRight,
  CreditCard,
  Headphones,
  LogOut,
  MapPin,
  Sparkles,
  Star,
  UserRound,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { RemoteImage } from '@/components/remote-image';
import { RequireAuth } from '@/components/require-auth';
import { useMyReviews } from '@/hooks/use-account';
import { useOrders } from '@/hooks/use-orders';
import { CAMPUS_BY_PERIOD } from '@/lib/media';
import { useLogout, useSession } from '@/lib/session';

const MENU = [
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/wallet', label: 'Payment Methods', icon: CreditCard },
  { href: '/wallet', label: 'Wallet & Points', icon: Wallet },
  {
    href: '/offers',
    label: 'Kwika Pass',
    icon: Sparkles,
    badge: 'New',
    hint: 'Save up to 25%',
  },
  { href: '/account/notifications', label: 'Notifications', icon: Bell },
  { href: '/support', label: 'Help & Support', icon: Headphones },
] as const;

function AccountHub() {
  const { user } = useSession();
  const logout = useLogout();
  const orders = useOrders({ limit: 1 });
  const reviews = useMyReviews(1);

  if (!user) return null;

  const gold = user.loyaltyPoints >= 1000;
  const backdrop = CAMPUS_BY_PERIOD.noon;

  return (
    <div className="pb-4">
      <section className="relative overflow-hidden">
        <div className="relative h-36 sm:h-44">
          <RemoteImage
            src={backdrop.src}
            alt=""
            fill
            priority
            sizes="100vw"
            className={`object-cover ${backdrop.object}`}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/50 to-canvas" />
          <h1 className="absolute bottom-8 left-5 font-serif text-[2.4rem] font-bold tracking-tight text-white">
            Profile
          </h1>
        </div>
      </section>

      <div className="relative z-10 -mt-6 px-4">
        <section className="relative rounded-[1.6rem] bg-surface px-4 pb-5 pt-12 text-center">
          <Link href="/account/details" className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
            <Avatar
              name={user.name}
              src={user.avatarUrl}
              size="xl"
              className="h-24 w-24 ring-4 ring-canvas"
            />
            <span className="sr-only">Edit profile</span>
          </Link>

          <p className="font-serif text-[1.45rem] font-bold text-ink">{user.name}</p>
          {gold ? (
            <p className="mt-1 inline-flex items-center gap-1 text-caption font-medium text-gold">
              <Star aria-hidden className="h-3.5 w-3.5 fill-current" />
              Gold Member
            </p>
          ) : (
            <p className="mt-1 text-caption text-ink-muted">{user.email}</p>
          )}

          <dl className="mt-5 grid grid-cols-3 overflow-hidden rounded-2xl border border-white/10">
            <Stat href="/orders" label="Orders" value={orders.data?.total ?? '—'} />
            <Stat href="/account/reviews" label="Reviews" value={reviews.data?.total ?? '—'} />
            <Stat
              href="/wallet"
              label="Points"
              value={user.loyaltyPoints.toLocaleString('en-IN')}
              accent
            />
          </dl>
        </section>

        {!user.emailVerified ? (
          <Alert className="mt-4" tone="warning" title="Verify your email">
            Check your inbox for the link. Some campus offers need a verified account.
          </Alert>
        ) : null}

        <section className="mt-6">
          <h2 className="mb-3 font-serif text-title text-ink">My Account</h2>
          <nav className="overflow-hidden rounded-[1.35rem] bg-surface">
            <Link
              href="/account/details"
              className="flex items-center gap-3 border-b border-white/8 px-4 py-3.5"
            >
              <UserRound aria-hidden className="h-5 w-5 text-ink-muted" />
              <span className="flex-1 text-body text-ink">Your details</span>
              <ChevronRight aria-hidden className="h-4 w-4 text-ink-subtle" />
            </Link>
            {MENU.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 border-b border-white/8 px-4 py-3.5 last:border-b-0"
                >
                  <Icon aria-hidden className="h-5 w-5 text-ink-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-body text-ink">
                      {item.label}
                      {'badge' in item && item.badge ? (
                        <span className="rounded-full bg-brand px-2 py-0.5 text-micro font-semibold text-white">
                          {item.badge}
                        </span>
                      ) : null}
                    </span>
                    {'hint' in item && item.hint ? (
                      <span className="block text-caption text-ink-subtle">{item.hint}</span>
                    ) : null}
                  </span>
                  <ChevronRight aria-hidden className="h-4 w-4 text-ink-subtle" />
                </Link>
              );
            })}
          </nav>
        </section>

        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-danger/15 px-4 py-3.5 text-body font-medium text-danger"
        >
          <LogOut aria-hidden className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

function Stat({
  href,
  label,
  value,
  accent,
}: {
  href: string;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <Link href={href} className="border-r border-white/10 px-2 py-3 last:border-r-0">
      <dt className="text-micro uppercase tracking-wide text-ink-subtle">{label}</dt>
      <dd className={`tabular mt-1 font-serif text-title ${accent ? 'text-gold' : 'text-ink'}`}>
        {value}
      </dd>
    </Link>
  );
}

export default function AccountPage() {
  return (
    <RequireAuth>
      <AccountHub />
    </RequireAuth>
  );
}
