'use client';

import { PERMISSIONS } from '@ck/types';
import { Alert, Button, EmptyState, ErrorState, Pagination, Skeleton } from '@ck/ui';
import { Bike, Package } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { JobHistoryRow, JobListCard } from '@/components/job-card';
import { OfferCard } from '@/components/offer-card';
import { RequireAccess } from '@/components/require-access';
import { RiderScreen } from '@/components/rider-screen';
import { useActiveJobs, useEarnings, useJobHistory, useOffers, useSetOnline } from '@/hooks/use-jobs';
import { useLocationPing } from '@/hooks/use-location-ping';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
] as const;

function AllAndActive({ mode }: { mode: 'all' | 'active' }) {
  const { data: offers, isError: offersError, refetch: refetchOffers } = useOffers();
  const { data: jobs, isLoading, isError, refetch } = useActiveJobs();
  const { data: summary } = useEarnings();
  const setOnline = useSetOnline();
  const active = jobs?.items ?? [];
  const incoming = mode === 'all' ? (offers?.items ?? []) : [];
  useLocationPing(active.length > 0);
  const offline = offers?.reason === 'offline';

  if (isError || offersError) {
    return (
      <ErrorState
        title="Could not load jobs"
        onRetry={() => {
          void refetch();
          void refetchOffers();
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {offline && mode === 'all' ? (
        <Alert tone="warning" title="You are offline">
          Jobs are only offered while you are online.
          <div className="mt-2">
            <Button size="sm" loading={setOnline.isPending} onClick={() => setOnline.mutate(true)}>
              Go online
            </Button>
          </div>
        </Alert>
      ) : null}

      {incoming.map((offer) => (
        <OfferCard key={offer.id} offer={offer} />
      ))}

      {active.map((job) => (
        <JobListCard key={job.id} job={job} />
      ))}

      {incoming.length === 0 && active.length === 0 && !offline ? (
        <EmptyState
          icon={<Package aria-hidden className="h-6 w-6" />}
          title={mode === 'active' ? 'Nothing on the road' : 'No jobs right now'}
          description={
            summary?.isOnline
              ? 'This list updates the moment a kitchen has an order ready.'
              : 'Go online to start receiving jobs.'
          }
        />
      ) : null}
    </div>
  );
}

function Completed() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useJobHistory(page);

  if (isError) {
    return <ErrorState title="Could not load your history" onRetry={() => void refetch()} />;
  }

  if (isLoading) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }

  if (!data?.items.length) {
    return (
      <EmptyState
        icon={<Bike aria-hidden className="h-6 w-6" />}
        title="No finished jobs yet"
        description="Deliveries you complete show up here with what you earned."
      />
    );
  }

  return (
    <div className="rounded-2xl bg-surface px-4">
      {data.items.map((job) => (
        <JobHistoryRow key={job.id} job={job} />
      ))}
      <div className="py-3">
        <Pagination
          page={data.page}
          limit={data.limit}
          total={data.total}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

function OrdersScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = TABS.find((item) => item.id === params.get('tab'))?.id ?? 'all';
  const { data: activeJobs } = useActiveJobs();
  const activeCount = activeJobs?.items.length ?? 0;

  return (
    <RiderScreen title="Orders">
      <div role="tablist" aria-label="Order lists" className="mb-4 flex gap-1.5">
        {TABS.map((item) => {
          const selected = item.id === tab;
          const label =
            item.id === 'active' ? `Active (${activeCount})` : item.label;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => router.replace(`/jobs?tab=${item.id}`)}
              className={`rounded-full px-4 py-2 text-caption font-medium ${
                selected ? 'bg-brand text-brand-ink' : 'bg-surface text-ink-muted'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === 'completed' ? <Completed /> : <AllAndActive mode={tab} />}
    </RiderScreen>
  );
}

export default function JobsPage() {
  return (
    <RequireAccess permission={PERMISSIONS.DELIVERY_READ_OWN}>
      <OrdersScreen />
    </RequireAccess>
  );
}
