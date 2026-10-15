'use client';

import type { AppNotification } from '@ck/types';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SkeletonText,
} from '@ck/ui';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PushPrompt } from '@/components/push-prompt';
import { RequireAccess } from '@/components/require-access';
import { useMarkAllRead, useMarkRead, useNotifications } from '@/hooks/use-admin';

function NotificationRow({ notification }: { notification: AppNotification }) {
  const markRead = useMarkRead();
  const body = (
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-2">
        <p className={notification.readAt ? 'text-body text-ink-muted' : 'text-body font-medium text-ink'}>
          {notification.title}
        </p>
        {!notification.readAt ? (
          <Badge tone="brand" size="sm">
            New
          </Badge>
        ) : null}
      </div>
      <p className="text-caption text-ink-muted">{notification.body}</p>
      <p className="text-caption text-ink-subtle">
        {new Date(notification.createdAt).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </p>
    </div>
  );

  return (
    <li>
      <Card className={notification.readAt ? undefined : 'border-brand/30 bg-brand-soft/20'}>
        <CardBody>
          {notification.deepLink ? (
            <Link
              href={notification.deepLink}
              className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
              onClick={() => {
                if (!notification.readAt) markRead.mutate([notification.id]);
              }}
            >
              {body}
            </Link>
          ) : (
            body
          )}
        </CardBody>
      </Card>
    </li>
  );
}

function Alerts() {
  const [page, setPage] = useState(1);
  const feed = useNotifications(page);
  const markAll = useMarkAllRead();
  const hasUnread = (feed.data?.items ?? []).some((item) => !item.readAt);

  return (
    <>
      <PageHeader
        title="Alerts"
        description="In-app notices for this account. Push is optional; this list is not."
        actions={
          hasUnread ? (
            <Button variant="secondary" size="sm" loading={markAll.isPending} onClick={() => markAll.mutate()}>
              Mark all read
            </Button>
          ) : null
        }
      />
      <PushPrompt />
      {feed.isError ? (
        <ErrorState title="Could not load alerts" onRetry={() => void feed.refetch()} />
      ) : feed.isLoading ? (
        <Card>
          <CardBody>
            <SkeletonText lines={6} />
          </CardBody>
        </Card>
      ) : !feed.data?.items.length ? (
        <EmptyState
          icon={<Bell aria-hidden className="h-6 w-6" />}
          title="No alerts yet"
          description="Kitchen applications, complaints and broadcasts will land here."
        />
      ) : (
        <>
          <ul className="space-y-2">
            {feed.data.items.map((item) => (
              <NotificationRow key={item.id} notification={item} />
            ))}
          </ul>
          <Pagination
            page={feed.data.page}
            limit={feed.data.limit}
            total={feed.data.total}
            onPageChange={setPage}
            className="mt-4"
          />
        </>
      )}
    </>
  );
}

export default function AlertsPage() {
  return (
    <RequireAccess>
      <Alerts />
    </RequireAccess>
  );
}
