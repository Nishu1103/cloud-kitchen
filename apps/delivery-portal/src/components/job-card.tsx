'use client';

import {
  DELIVERY_STATUS,
  formatMoney,
  type DeliveryAssignment,
  type DeliveryEndpoint,
  type DeliveryStatus,
} from '@ck/types';
import { Badge, Button, ConfirmDialog, Field, Input, StatusBadge } from '@ck/ui';
import { Banknote, MapPin, Navigation, Package, Phone, Store } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useUpdateJobStatus } from '@/hooks/use-jobs';
import { formatDistance } from '@/lib/dates';
import { mapLink, type Coordinates } from '@/lib/geo';
import { HandoverDialog } from './handover-dialog';

/**
 * The next step, and what to call it.
 *
 * Mirrors the API's transition table rather than inventing a parallel one: the server
 * rejects anything else, so offering a button the API would refuse is just a way to make
 * a rider feel the app is broken.
 */
const NEXT_STEP: Partial<Record<DeliveryStatus, { status: DeliveryStatus; label: string }>> = {
  [DELIVERY_STATUS.ASSIGNED]: {
    status: DELIVERY_STATUS.ARRIVED_AT_VENDOR,
    label: 'Reached Pickup',
  },
  [DELIVERY_STATUS.ARRIVED_AT_VENDOR]: {
    status: DELIVERY_STATUS.PICKED_UP,
    label: 'Picked Up Order',
  },
  [DELIVERY_STATUS.PICKED_UP]: {
    status: DELIVERY_STATUS.ARRIVED_AT_CUSTOMER,
    label: 'Reached Drop',
  },
};

function currentLeg(status: DeliveryStatus): 'pickup' | 'drop' {
  return status === DELIVERY_STATUS.ASSIGNED || status === DELIVERY_STATUS.ARRIVED_AT_VENDOR
    ? 'pickup'
    : 'drop';
}

function Endpoint({
  endpoint,
  label,
  emphasised,
}: {
  endpoint: DeliveryEndpoint;
  label: string;
  emphasised: boolean;
}) {
  const link = mapLink(endpoint.location?.coordinates, endpoint.name);

  return (
    <div className={emphasised ? 'rounded-2xl bg-brand-soft p-3' : 'rounded-2xl bg-canvas p-3'}>
      <p className="text-micro uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className="text-body font-semibold text-ink">{endpoint.name}</p>
      <p className="text-caption text-ink-muted">{endpoint.address}</p>

      <div className="mt-2 flex items-center gap-2">
        {link ? (
          <Button variant="secondary" size="sm" className="rounded-full" asChild>
            <a href={link}>
              <Navigation aria-hidden className="h-4 w-4" /> Navigate
            </a>
          </Button>
        ) : null}
        {endpoint.phone ? (
          <a
            href={`tel:${endpoint.phone}`}
            aria-label={`Call ${endpoint.name}`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-brand-ink"
          >
            <Phone aria-hidden className="h-4 w-4" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

/**
 * One job in progress.
 *
 * Ordered by what the rider needs next: the current leg is highlighted, handover is
 * the only way to finish, and reporting a failure is available but never the easy path.
 */
export function JobCard({ job, location }: { job: DeliveryAssignment; location?: Coordinates }) {
  const update = useUpdateJobStatus(job.id);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  const [reason, setReason] = useState('');

  const step = NEXT_STEP[job.status];
  const leg = currentLeg(job.status);
  const canDeliver =
    job.status === DELIVERY_STATUS.PICKED_UP ||
    job.status === DELIVERY_STATUS.ARRIVED_AT_CUSTOMER;
  const distance = formatDistance(job.distanceMeters);

  return (
    <article className="space-y-3 rounded-2xl bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-body font-semibold text-brand">#{job.orderCode}</p>
          <p className="text-caption text-ink-muted">
            {formatMoney(job.earning)}
            {distance ? ` · ${distance}` : ''}
            {` · ${job.itemCount} ${job.itemCount === 1 ? 'item' : 'items'}`}
          </p>
        </div>
        <StatusBadge status={job.status} kind="delivery" />
      </div>

      <p
        className={`inline-flex rounded-full px-2.5 py-1 text-micro font-semibold uppercase tracking-wide ${
          job.collectCash > 0
            ? 'bg-warning-soft text-warning-ink'
            : 'bg-brand-soft text-brand'
        }`}
      >
        {job.collectCash > 0
          ? `Collect ${formatMoney(job.collectCash)} cash`
          : 'Payment: Online'}
      </p>

      {job.collectCash > 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-warning-soft px-3 py-2 text-caption text-warning-ink">
          <Banknote aria-hidden className="h-4 w-4 shrink-0" />
          Collect {formatMoney(job.collectCash)} in cash at the door.
        </p>
      ) : null}

      <Endpoint endpoint={job.pickup} label="Pickup" emphasised={leg === 'pickup'} />
      <Endpoint endpoint={job.drop} label="Drop" emphasised={leg === 'drop'} />

      <div className="space-y-2">
        {step ? (
          <Button
            block
            size="lg"
            className="rounded-full"
            loading={update.isPending}
            onClick={() => update.mutate({ status: step.status, location })}
          >
            {step.label}
          </Button>
        ) : null}

        {canDeliver ? (
          <Button
            block
            size="lg"
            className="rounded-full"
            variant="primary"
            onClick={() => setHandoverOpen(true)}
          >
            <Package aria-hidden className="h-4 w-4" /> Confirm handover
          </Button>
        ) : null}

        {step || canDeliver ? (
          <Button block variant="ghost" onClick={() => setFailOpen(true)}>
            Something went wrong
          </Button>
        ) : null}
      </div>

      <HandoverDialog
        job={job}
        open={handoverOpen}
        onOpenChange={setHandoverOpen}
        location={location}
      />

      <ConfirmDialog
        open={failOpen}
        onOpenChange={(next) => {
          setFailOpen(next);
          if (!next) setReason('');
        }}
        title="Report a problem"
        description="Use this only if the delivery cannot be completed. The campus team is notified and the customer is refunded."
        confirmLabel="Report and end job"
        cancelLabel="Go back"
        loading={update.isPending}
        onConfirm={() =>
          update.mutate(
            {
              status: DELIVERY_STATUS.FAILED,
              location,
              failureReason: reason.trim() || undefined,
            },
            { onSuccess: () => setFailOpen(false) },
          )
        }
      >
        <Field label="What happened?" hint="The admin who reviews this only sees what you write.">
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={240}
            placeholder="Nobody at the room, phone switched off"
          />
        </Field>
      </ConfirmDialog>
    </article>
  );
}

/** Compact card for the orders list — opens the run screen. */
export function JobListCard({ job }: { job: DeliveryAssignment }) {
  const distance = formatDistance(job.distanceMeters);

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block space-y-3 rounded-[1.25rem] bg-surface p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-body font-semibold text-brand">#{job.orderCode}</p>
        <p className="tabular text-body font-semibold text-ink">{formatMoney(job.earning)}</p>
      </div>
      <ol className="space-y-2 text-caption">
        <li className="flex items-start gap-2 text-ink-muted">
          <Store aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" />
          <span className="min-w-0 truncate">{job.pickup.name}</span>
        </li>
        <li className="flex items-start gap-2 text-ink-muted">
          <MapPin aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <span className="min-w-0 truncate">{job.drop.address}</span>
        </li>
      </ol>
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={job.status} kind="delivery" size="sm" />
        {distance ? <span className="text-caption font-medium text-brand">{distance}</span> : null}
      </div>
    </Link>
  );
}

/** The compact row used in history, where nothing is actionable any more. */
export function JobHistoryRow({ job }: { job: DeliveryAssignment }) {
  const completed = job.deliveredAt ?? job.createdAt;

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0"
    >
      <div className="min-w-0">
        <p className="truncate text-body font-medium text-ink">#{job.orderCode}</p>
        <p className="flex items-center gap-1 truncate text-caption text-ink-muted">
          <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0" />
          {job.drop.address}
        </p>
        <p className="text-caption text-ink-subtle">
          {new Date(completed).toLocaleString(undefined, {
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="tabular text-body font-semibold text-ink">{formatMoney(job.earning)}</p>
        <Badge tone={job.status === DELIVERY_STATUS.DELIVERED ? 'success' : 'neutral'} size="sm">
          {job.status === DELIVERY_STATUS.DELIVERED ? 'Delivered' : 'Not completed'}
        </Badge>
      </div>
    </Link>
  );
}
