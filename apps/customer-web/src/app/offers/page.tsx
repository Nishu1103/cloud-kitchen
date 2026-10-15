'use client';

import { formatMoney } from '@ck/types';
import { toast } from '@ck/ui';
import { Copy, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { AccountPanel, AccountSubhead } from '@/components/account-subhead';
import { RemoteImage } from '@/components/remote-image';
import { RequireAuth } from '@/components/require-auth';
import { useCoupons } from '@/hooks/use-catalog';
import { OFFER_TILES } from '@/lib/media';
import { useSession } from '@/lib/session';

function OffersBody() {
  const { user } = useSession();
  const coupons = useCoupons();
  const points = user?.loyaltyPoints ?? 0;
  const nextAt = Math.max(2000, Math.ceil((points + 1) / 1000) * 1000);

  const copy = async (code: string) => {
    await navigator.clipboard.writeText(code).catch(() => undefined);
    toast.success(`Copied ${code}`);
  };

  return (
    <div>
      <AccountSubhead title="Kwika Pass" subtitle="Offers and points on this campus" backHref="/account" />
      <div className="space-y-6 px-4">
      <AccountPanel className="relative overflow-hidden p-5">
        <p className="text-caption uppercase tracking-wide text-ink-subtle">Your Kwike Points</p>
        <p className="font-serif text-display text-gold">{points.toLocaleString('en-IN')}</p>
        <p className="mt-1 text-caption text-ink-muted">Next reward at {nextAt.toLocaleString('en-IN')} pts.</p>
        <Sparkles aria-hidden className="absolute right-5 top-5 h-16 w-16 text-gold/30" />
      </AccountPanel>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-serif text-title text-ink">Active Offers</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(coupons.data ?? []).slice(0, 4).map((coupon, index) => (
            <button
              key={coupon.id}
              type="button"
              onClick={() => void copy(coupon.code)}
              className={
                index % 2 === 0
                  ? 'rounded-2xl bg-gradient-to-br from-danger/25 to-surface p-3 text-left'
                  : 'rounded-2xl bg-gradient-to-br from-success/20 to-surface p-3 text-left'
              }
            >
              <p className="font-serif text-body font-semibold text-ink">{coupon.title}</p>
              <p className="mt-1 text-caption text-ink-muted">
                On orders above {formatMoney(coupon.minOrderAmount)}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-white/20 px-2 py-1 text-micro text-ink">
                <Copy aria-hidden className="h-3 w-3" />
                {coupon.code}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-serif text-title text-ink">
          More for you <span className="text-gold">✦</span>
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {OFFER_TILES.map((tile) => (
            <Link
              key={tile.title}
              href={tile.href}
              className="relative aspect-square overflow-hidden rounded-2xl"
            >
              <RemoteImage src={tile.image} alt="" fill sizes="50vw" className="object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 p-3">
                <span className="block font-serif text-body font-semibold text-white">{tile.title}</span>
                <span className="text-caption text-white/80">{tile.subtitle}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
      </div>
    </div>
  );
}

export default function OffersPage() {
  return (
    <RequireAuth>
      <OffersBody />
    </RequireAuth>
  );
}
