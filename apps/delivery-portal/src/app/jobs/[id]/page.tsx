'use client';

import { DELIVERY_STATUS, PERMISSIONS, formatMoney } from '@ck/types';
import { ErrorState, Skeleton } from '@ck/ui';
import { useParams } from 'next/navigation';
import { JobCard } from '@/components/job-card';
import { RequireAccess } from '@/components/require-access';
import { RiderScreen } from '@/components/rider-screen';
import { RouteMap } from '@/components/route-map';
import { isActiveJob, useJob } from '@/hooks/use-jobs';
import { useLocationPing } from '@/hooks/use-location-ping';
import { formatDistance } from '@/lib/dates';
import { distanceMetres } from '@/lib/geo';

function remainingLabel(
  status: string,
  lastFix: [number, number] | undefined,
  pickup?: [number, number],
  drop?: [number, number],
): string | null {
  const toPickup =
    status === DELIVERY_STATUS.ASSIGNED || status === DELIVERY_STATUS.ARRIVED_AT_VENDOR;
  const target = toPickup ? pickup : drop;
  if (!lastFix || !target) return null;
  const label = formatDistance(distanceMetres(lastFix, target));
  if (!label) return null;
  return `${label} to ${toPickup ? 'pickup' : 'drop'}`;
}

function JobDetail({ id }: { id: string }) {
  const { data: job, isLoading, isError, refetch } = useJob(id);
  const active = job ? isActiveJob(job.status) : false;
  const { lastFix } = useLocationPing(active);

  if (isLoading) {
    return (
      <RiderScreen title="Order" backHref="/jobs">
        <Skeleton className="h-80 rounded-[1.5rem]" />
      </RiderScreen>
    );
  }

  if (isError || !job) {
    return (
      <RiderScreen title="Order" backHref="/jobs">
        <ErrorState
          title="We could not find this job"
          message="It may have been taken by someone else, or it is older than the first page of history."
          onRetry={() => refetch()}
        />
      </RiderScreen>
    );
  }

  const banner = remainingLabel(
    job.status,
    lastFix,
    job.pickup.location?.coordinates,
    job.drop.location?.coordinates,
  );

  return (
    <RiderScreen title={`#${job.orderCode}`} backHref="/jobs">
      <div className="space-y-4">
        <div className="relative">
          <RouteMap
            rider={lastFix}
            pickup={job.pickup.location?.coordinates}
            drop={job.drop.location?.coordinates}
            caption={`Route for order ${job.orderCode}`}
          />
          {banner ? (
            <p className="absolute inset-x-4 top-4 rounded-2xl rider-purple px-4 py-2 text-center text-caption font-semibold text-white">
              {banner}
            </p>
          ) : null}
        </div>

        <p className="text-caption text-ink-muted">
          {formatMoney(job.earning)} earning
          {job.itemCount
            ? ` · ${job.itemCount} ${job.itemCount === 1 ? 'item' : 'items'}`
            : ''}
        </p>

        <JobCard job={job} location={lastFix} />
      </div>
    </RiderScreen>
  );
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <RequireAccess permission={PERMISSIONS.DELIVERY_READ_OWN}>
      <JobDetail id={params.id} />
    </RequireAccess>
  );
}
