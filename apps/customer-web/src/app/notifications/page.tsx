'use client';

import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, SkeletonText, cn } from '@ck/ui';
import { BellOff, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PushPrompt } from '@/components/push-prompt';
import { RequireAuth } from '@/components/require-auth';
import { useMarkNotificationsRead, useNotifications } from '@/hooks/use-account';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function NotificationCentre() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, isLoading, isError, refetch } = useNotifications({ limit: 30, unreadOnly });
  const markRead = useMarkNotificationsRead();

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      {/* The in-app centre is the guarantee; push is the convenience on top of it. */}
      <PushPrompt />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant={unreadOnly ? 'soft' : 'ghost'}
            size="sm"
            onClick={() => setUnreadOnly((value) => !value)}
          >
            Unread only
          </Button>
          {data?.unread ? <Badge tone="brand" size="sm">{data.unread} unread</Badge> : null}
        </div>
        {items.some((item) => !item.readAt) ? (
          <Button
            variant="ghost"
            size="sm"
            loading={markRead.isPending}
            onClick={() => markRead.mutate(undefined)}
            leadingIcon={<CheckCheck aria-hidden className="h-4 w-4" />}
          >
            Mark all read
          </Button>
        ) : null}
      </div>

      {isError ? (
        <ErrorState message="We could not load your notifications." onRetry={() => refetch()} />
      ) : isLoading ? (
        <Card className="p-4">
          <SkeletonText lines={6} />
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BellOff aria-hidden className="h-6 w-6" />}
          title={unreadOnly ? 'Nothing unread' : 'No notifications yet'}
          description="Order updates, offers and campus announcements land here."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const body = (
              <div className="flex items-start gap-3 p-4">
                <span
                  aria-hidden
                  className={cn(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    item.readAt ? 'bg-transparent' : 'bg-brand',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-body',
                      item.readAt ? 'text-ink' : 'font-semibold text-ink',
                    )}
                  >
                    {item.title}
                  </p>
                  <p className="text-caption text-ink-muted">{item.body}</p>
                  <p className="text-caption text-ink-subtle">{relativeTime(item.createdAt)}</p>
                </div>
              </div>
            );

            return (
              <li key={item.id}>
                {item.deepLink ? (
                  <Card interactive asChild>
                    <Link
                      href={item.deepLink}
                      onClick={() => {
                        if (!item.readAt) markRead.mutate([item.id]);
                      }}
                    >
                      {body}
                    </Link>
                  </Card>
                ) : (
                  <Card
                    onClick={() => {
                      if (!item.readAt) markRead.mutate([item.id]);
                    }}
                  >
                    {body}
                  </Card>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Notifications" />
      <RequireAuth message="Sign in to see your notifications.">
        <NotificationCentre />
      </RequireAuth>
    </div>
  );
}
