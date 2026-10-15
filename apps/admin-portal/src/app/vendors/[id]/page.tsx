'use client';

import { formatMoney, PERMISSIONS, type Vendor } from '@ck/types';
import { Badge, ErrorState, PageHeader, Skeleton, StatusBadge } from '@ck/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { KitchenActions } from '@/components/kitchen-actions';
import { RequireAccess } from '@/components/require-access';
import { useVendor } from '@/hooks/use-admin';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-0">
      <dt className="shrink-0 text-caption text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-body text-ink">{value}</dd>
    </div>
  );
}

function KitchenDetail({ kitchen }: { kitchen: Vendor }) {
  return (
    <>
      <PageHeader
        title={kitchen.name}
        description={kitchen.tagline ?? kitchen.slug}
        breadcrumb={
          <Link href="/vendors" className="text-caption text-brand hover:underline">
            ← Kitchens
          </Link>
        }
        actions={<KitchenActions kitchen={kitchen} size="sm" />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={kitchen.status} kind="vendor" />
        <Badge tone={kitchen.isOpen ? 'success' : 'neutral'} size="sm">
          {kitchen.isOpen ? 'Open' : 'Closed'}
        </Badge>
        {kitchen.ratingCount ? (
          <span className="text-caption text-ink-muted">
            {kitchen.rating.toFixed(1)}★ ({kitchen.ratingCount} reviews)
          </span>
        ) : (
          <span className="text-caption text-ink-subtle">No reviews yet</span>
        )}
      </div>

      {kitchen.rejectionReason ? (
        <p className="mb-4 rounded-2xl bg-warning-soft px-4 py-3 text-caption text-warning-ink">
          Last decision note: {kitchen.rejectionReason}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[1.25rem] bg-surface px-4">
          <h2 className="pt-4 text-body font-semibold text-ink">Profile</h2>
          <dl>
            <Row label="Handle" value={kitchen.slug} />
            <Row
              label="Cuisines"
              value={kitchen.cuisines.length ? kitchen.cuisines.join(', ') : '—'}
            />
            <Row
              label="Fulfilment"
              value={[
                kitchen.acceptsDelivery ? 'Delivery' : null,
                kitchen.acceptsPickup ? 'Pickup' : null,
              ]
                .filter(Boolean)
                .join(' · ') || '—'}
            />
            <Row label="Prep time" value={`${kitchen.avgPrepMinutes} min`} />
            <Row
              label="Contact"
              value={
                [kitchen.contactName, kitchen.contactPhone].filter(Boolean).join(' · ') || '—'
              }
            />
            {kitchen.description ? <Row label="About" value={kitchen.description} /> : null}
          </dl>
        </section>

        <section className="rounded-[1.25rem] bg-surface px-4">
          <h2 className="pt-4 text-body font-semibold text-ink">Commercial</h2>
          <dl>
            <Row label="Commission" value={`${kitchen.commissionPercent}%`} />
            <Row label="Min order" value={formatMoney(kitchen.minOrderAmount)} />
            <Row label="Packaging" value={formatMoney(kitchen.packagingFee)} />
            <Row label="Delivery fee" value={formatMoney(kitchen.deliveryFee)} />
            <Row label="Orders (lifetime)" value={String(kitchen.totalOrders ?? 0)} />
            <Row
              label="Lifetime GMV"
              value={formatMoney(kitchen.lifetimeRevenue ?? 0)}
            />
            <Row
              label="Awaiting payout"
              value={formatMoney(kitchen.pendingSettlement ?? 0)}
            />
          </dl>
        </section>
      </div>

      {kitchen.operatingHours?.length ? (
        <section className="mt-4 rounded-[1.25rem] bg-surface px-4">
          <h2 className="pt-4 text-body font-semibold text-ink">Hours</h2>
          <dl>
            {kitchen.operatingHours.map((slot) => (
              <Row
                key={slot.day}
                label={DAYS[slot.day] ?? `Day ${slot.day}`}
                value={slot.isClosed ? 'Closed' : `${slot.open} – ${slot.close}`}
              />
            ))}
          </dl>
        </section>
      ) : null}

      <p className="mt-4 text-caption text-ink-subtle">
        Open/Closed is the kitchen's own shutter for the shift. Suspend is the campus
        decision — they cannot open again until you reinstate them.
      </p>
    </>
  );
}

function KitchenView({ id }: { id: string }) {
  const kitchen = useVendor(id);

  if (kitchen.isError) {
    return (
      <ErrorState
        title="Kitchen not found"
        message="It may belong to another campus."
        onRetry={() => void kitchen.refetch()}
      />
    );
  }

  if (kitchen.isLoading || !kitchen.data) {
    return <Skeleton className="h-80 rounded-[1.25rem]" />;
  }

  return <KitchenDetail kitchen={kitchen.data} />;
}

export default function KitchenPage() {
  const params = useParams<{ id: string }>();

  return (
    <RequireAccess permission={PERMISSIONS.VENDOR_READ}>
      <KitchenView id={params.id} />
    </RequireAccess>
  );
}
