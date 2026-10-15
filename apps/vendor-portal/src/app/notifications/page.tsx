'use client';

import { NOTIFICATION_CATEGORY, type AppNotification } from '@ck/types';
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
import {
  Bell,
  IndianRupee,
  Info,
  PackageX,
  ReceiptText,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { RequireAccess } from '@/components/require-access';
import { useMarkAllRead, useMarkRead, useNotifications } from '@/hooks/use-account';

const CATEGORY_ICON: Record<string, typeof Bell> = {
  [NOTIFICATION_CATEGORY.ORDER]: ReceiptText,
  [NOTIFICATION_CATEGORY.PAYMENT]: IndianRupee,
  [NOTIFICATION_CATEGORY.REVIEW]: Star,
  [NOTIFICATION_CATEGORY.INVENTORY]: PackageX,
  [NOTIFICATION_CATEGORY.SYSTEM]: Info,
};

function NotificationRow({ notification }: { notification: AppNotification }) {
  const markRead = useMarkRead();
  const Icon = CATEGORY_ICON[notification.category] ?? Bell;

  const body = (
    <div className="flex items-start gap-3">
      <span
        className={
          notification.readAt
            ? 'mt-0.5 shrink-0 text-ink-subtle'
            : 'mt-0.5 shrink-0 text-brand'
        }
      >
        <Icon aria-hidden className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={
              notification.readAt
                ? 'text-body text-ink-muted'
                : 'text-body font-medium text-ink'
            }
          >
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
    </div>
  );

  return (
    <li>
      <Card
        className={notification.readAt ? undefined : 'border-brand/30 bg-brand-soft/20'}
      >
        <CardBody>
          {/*
            A notification carrying a deep link is navigable; one without is not a
            control, so it stays plain text rather than a button that does nothing.
          */}
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

function NotificationsScreen() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useNotifications({ page, limit: 20 });
  const markAllRead = useMarkAllRead();

  const hasUnread = (data?.items ?? []).some((notification) => !notification.readAt);

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Everything the platform has sent you, whether or not push was on."
        actions={
          hasUnread ? (
            <Button
              variant="secondary"
              loading={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </Button>
          ) : null
        }
      />

      {isError ? (
        <ErrorState message="Could not load your alerts." onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Card>
          <CardBody>
            <SkeletonText lines={6} />
          </CardBody>
        </Card>
      ) : !data?.items.length ? (
        <EmptyState
          icon={<Bell aria-hidden className="h-6 w-6" />}
          title="Nothing here yet"
          description="New orders, reviews and settlements will show up in this list."
        />
      ) : (
        <>
          <ul className="space-y-2">
            {data.items.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} />
            ))}
          </ul>

          <Pagination
            page={data.page}
            limit={data.limit}
            total={data.total}
            onPageChange={setPage}
            className="mt-4"
          />
        </>
      )}
    </>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAccess requiresKitchen={false}>
      <NotificationsScreen />
    </RequireAccess>
  );
}
