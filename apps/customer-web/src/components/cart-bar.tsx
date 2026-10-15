'use client';

import { formatMoney } from '@ck/types';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/hooks/use-cart';

/**
 * Persistent cart summary.
 *
 * Hidden on cart and checkout. Sits above the phone dock; on desktop it floats
 * in the bottom-right so it does not fight the header nav.
 */
export function CartBar() {
  const pathname = usePathname();
  const { data } = useCart();

  const lineCount = data?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0;

  if (!data || lineCount === 0) return null;
  if (pathname.startsWith('/cart') || pathname.startsWith('/checkout')) return null;

  const total = data.breakdown.grandTotal;

  return (
    <div
      className="fixed inset-x-0 z-30 px-4 lg:inset-x-auto lg:bottom-6 lg:right-8 lg:w-[22rem]"
      style={{
        bottom: 'calc(4.75rem + env(safe-area-inset-bottom))',
      }}
    >
      <Link
        href="/cart"
        className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-full bg-brand px-5 py-3.5 text-brand-ink shadow-brand lg:max-w-none"
      >
        <div className="min-w-0 flex-1 text-brand-ink">
          <p className="truncate text-body font-semibold">
            View Cart ({lineCount}) | {formatMoney(total)}
          </p>
        </div>
      </Link>
    </div>
  );
}
