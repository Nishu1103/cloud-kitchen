'use client';

import { formatMoney, type DeliveryOffer } from '@ck/types';
import { Banknote, MapPin, Store } from 'lucide-react';
import { useAcceptJob, useDeclineJob } from '@/hooks/use-jobs';
import { formatDistance } from '@/lib/dates';
import { SlideToAccept } from './slide-to-accept';

/**
 * A job in the open pool.
 *
 * Pickup name, drop area, fee, cash flag — enough to decide. The customer's name,
 * room and phone arrive only after accept, so watching the pool cannot harvest addresses.
 *
 * There is no countdown: the API does not expire an offer after 30 seconds, and drawing
 * one would make a rider think the job is about to vanish when it is not.
 */
export function OfferCard({ offer }: { offer: DeliveryOffer }) {
  const accept = useAcceptJob();
  const decline = useDeclineJob();
  const pending = accept.isPending || decline.isPending;
  const distance = formatDistance(offer.distanceMeters);

  return (
    <article className="space-y-4 rounded-[1.25rem] bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-caption font-medium uppercase tracking-wide text-brand">New order</p>
          <p className="mt-1 text-title font-semibold text-brand">#{offer.orderCode}</p>
          {distance ? <p className="text-caption text-ink-muted">{distance} away</p> : null}
        </div>
        <div className="text-right">
          <p className="tabular text-title font-semibold text-ink">{formatMoney(offer.earning)}</p>
          <p className="text-caption text-ink-subtle">
            {offer.itemCount} {offer.itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>
      </div>

      <ol className="relative space-y-5 pl-10">
        <span
          aria-hidden
          className="absolute bottom-3 left-[15px] top-3 w-px bg-line-strong"
        />
        <li className="relative">
          <span className="absolute -left-10 flex h-8 w-8 items-center justify-center rounded-full bg-info-soft text-info">
            <Store aria-hidden className="h-4 w-4" />
          </span>
          <p className="text-caption uppercase tracking-wide text-ink-subtle">Pickup</p>
          <p className="text-body font-semibold text-ink">{offer.pickup.name}</p>
          <p className="text-caption text-ink-muted">{offer.pickup.address}</p>
        </li>
        <li className="relative">
          <span className="absolute -left-10 flex h-8 w-8 items-center justify-center rounded-full bg-warning-soft text-warning">
            <MapPin aria-hidden className="h-4 w-4" />
          </span>
          <p className="text-caption uppercase tracking-wide text-ink-subtle">Drop</p>
          <p className="text-body font-semibold text-ink">{offer.dropArea}</p>
        </li>
      </ol>

      {offer.collectCash > 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-warning-soft px-3 py-2 text-caption text-warning-ink">
          <Banknote aria-hidden className="h-4 w-4 shrink-0" />
          Collect {formatMoney(offer.collectCash)} in cash
        </p>
      ) : null}

      <SlideToAccept
        onAccept={() => accept.mutate(offer.id)}
        disabled={pending}
        loading={accept.isPending}
      />
      <button
        type="button"
        className="w-full py-1 text-center text-caption font-medium text-ink-muted"
        disabled={pending}
        onClick={() => decline.mutate(offer.id)}
      >
        Reject order
      </button>
    </article>
  );
}
