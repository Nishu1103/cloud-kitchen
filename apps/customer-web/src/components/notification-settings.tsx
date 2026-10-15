'use client';

import {
  categoryPreferenceKey,
  channelPreferenceKey,
  NOTIFICATION_CATEGORY,
  NOTIFICATION_CHANNEL,
} from '@ck/types';
import { Alert, Card, CardBody, CardHeader, SkeletonText, Switch, toast } from '@ck/ui';
import { useEffect, useState } from 'react';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/hooks/use-account';
import { disablePush, enablePush, permissionState, pushSupport } from '@/lib/push';

/**
 * Order updates are absent on purpose: "your food is ready" is transactional and cannot
 * be muted, which is also why muting a category never stops the in-app centre.
 */
const CATEGORIES = [
  {
    key: categoryPreferenceKey(NOTIFICATION_CATEGORY.PROMOTION),
    label: 'Offers and campus deals',
    hint: 'Flash sales, coupons and kitchen specials.',
  },
  {
    key: categoryPreferenceKey(NOTIFICATION_CATEGORY.REVIEW),
    label: 'Review reminders',
    hint: 'A nudge to rate an order after it arrives.',
  },
  {
    key: categoryPreferenceKey(NOTIFICATION_CATEGORY.SYSTEM),
    label: 'Campus announcements',
    hint: 'Mess closures, festival timings and platform notices.',
  },
] as const;

const CHANNELS = [
  { key: channelPreferenceKey(NOTIFICATION_CHANNEL.PUSH), label: 'Push notifications' },
  { key: channelPreferenceKey(NOTIFICATION_CHANNEL.EMAIL), label: 'Email' },
] as const;

export function NotificationSettings({ embedded = false }: { embedded?: boolean }) {
  const { data, isLoading } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  const [pushGranted, setPushGranted] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const blocked = typeof window === 'undefined' ? null : pushSupport();

  useEffect(() => {
    setPushGranted(permissionState() === 'granted');
  }, []);

  // Absent means on: a fresh account should receive everything until it opts out.
  const enabled = (key: string) => data?.[key] !== false;

  const setPreference = (key: string, value: boolean) => {
    update.mutate({ ...(data ?? {}), [key]: value });
  };

  const togglePush = async (next: boolean) => {
    setPushBusy(true);
    try {
      if (!next) {
        await disablePush();
        setPushGranted(false);
        toast.success('This device will stop receiving push alerts.');
        return;
      }

      const outcome = await enablePush();
      if (outcome.status === 'registered') {
        setPushGranted(true);
        toast.success('Push alerts on for this device.');
      } else if (outcome.status === 'denied') {
        toast.error('Your browser blocked notifications. Allow them in site settings.');
      } else {
        toast.error(outcome.reason);
      }
    } finally {
      setPushBusy(false);
    }
  };

  const body = (
    <div className="space-y-4">
        {isLoading ? (
          <SkeletonText lines={4} />
        ) : (
          <>
            <div className="space-y-3">
              <p className="text-caption font-semibold uppercase tracking-wide text-ink-subtle">
                This device
              </p>
              {blocked && blocked.status === 'needs-install' ? (
                <Alert tone="info" title="Add to Home Screen first">
                  {blocked.reason}. Tap Share, then &ldquo;Add to Home Screen&rdquo;, and open the
                  app from there.
                </Alert>
              ) : blocked && 'reason' in blocked ? (
                <Alert tone="info">{blocked.reason}</Alert>
              ) : (
                <Switch
                  checked={pushGranted}
                  disabled={pushBusy}
                  onCheckedChange={(next) => void togglePush(next)}
                  label="Push alerts on this device"
                  hint="Order updates reach you even with the app closed."
                />
              )}
            </div>

            <div className="space-y-3 border-t border-white/8 pt-4">
              <p className="text-caption font-semibold uppercase tracking-wide text-ink-subtle">
                What to send
              </p>
              {CATEGORIES.map((category) => (
                <Switch
                  key={category.key}
                  checked={enabled(category.key)}
                  onCheckedChange={(next) => setPreference(category.key, next)}
                  label={category.label}
                  hint={category.hint}
                />
              ))}
            </div>

            <div className="space-y-3 border-t border-white/8 pt-4">
              <p className="text-caption font-semibold uppercase tracking-wide text-ink-subtle">
                How to send it
              </p>
              {CHANNELS.map((channel) => (
                <Switch
                  key={channel.key}
                  checked={enabled(channel.key)}
                  onCheckedChange={(next) => setPreference(channel.key, next)}
                  label={channel.label}
                />
              ))}
            </div>
          </>
        )}
    </div>
  );

  if (embedded) {
    return <section className="rounded-[1.35rem] bg-surface p-4">{body}</section>;
  }

  return (
    <Card>
      <CardHeader
        title="Notifications"
        description="Order updates always arrive. Everything else is your call."
      />
      <CardBody>{body}</CardBody>
    </Card>
  );
}
