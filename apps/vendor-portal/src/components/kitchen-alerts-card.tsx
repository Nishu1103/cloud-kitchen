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
import { isAlertSoundEnabled, setAlertSoundEnabled } from '@/lib/alert-sound';
import { disablePush, enablePush, permissionState, pushSupport } from '@/lib/push';

/**
 * New orders are deliberately absent.
 *
 * A kitchen cannot mute the thing it exists to respond to - the chime and the push for an
 * incoming order are not preferences. What is adjustable is the marketing and summary
 * traffic around them.
 */
const CATEGORIES = [
  {
    key: categoryPreferenceKey(NOTIFICATION_CATEGORY.REVIEW),
    label: 'New reviews',
    hint: 'When a student rates an order.',
  },
  {
    key: categoryPreferenceKey(NOTIFICATION_CATEGORY.PAYMENT),
    label: 'Settlements',
    hint: 'When a payout lands.',
  },
  {
    key: categoryPreferenceKey(NOTIFICATION_CATEGORY.INVENTORY),
    label: 'Low stock',
    hint: 'When a dish is close to selling out.',
  },
  {
    key: categoryPreferenceKey(NOTIFICATION_CATEGORY.SYSTEM),
    label: 'Platform notices',
    hint: 'Campus closures, maintenance windows, policy changes.',
  },
] as const;

const CHANNELS = [
  { key: channelPreferenceKey(NOTIFICATION_CHANNEL.PUSH), label: 'Push notifications' },
  { key: channelPreferenceKey(NOTIFICATION_CHANNEL.EMAIL), label: 'Email' },
] as const;

export function KitchenAlertsCard() {
  const { data, isLoading } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  const [pushGranted, setPushGranted] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [sound, setSound] = useState(true);
  const support = typeof window === 'undefined' ? null : pushSupport();

  useEffect(() => {
    setPushGranted(permissionState() === 'granted');
    setSound(isAlertSoundEnabled());
  }, []);

  // Absent means on: a new kitchen should hear about everything until it opts out.
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
        toast.success('This device will stop receiving order alerts.');
        return;
      }

      const outcome = await enablePush();
      if (outcome.status === 'registered') {
        setPushGranted(true);
        toast.success('Order alerts on for this device.');
      } else if (outcome.status === 'denied') {
        toast.error('Your browser blocked notifications. Allow them in site settings.');
      } else {
        toast.error(outcome.reason);
      }
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Alerts"
        description="New orders always alert you. Everything else is your call."
      />
      <CardBody className="space-y-4">
        <div className="space-y-3">
          <p className="text-caption font-semibold uppercase tracking-wide text-ink-subtle">
            This device
          </p>

          <Switch
            checked={sound}
            onCheckedChange={(next) => {
              setAlertSoundEnabled(next);
              setSound(next);
            }}
            label="Chime on a new order"
            hint="Plays through this device while the board is open."
          />

          {support && support.status === 'needs-install' ? (
            <Alert tone="info" title="Install the app on this device first">
              {support.reason}. Tap Share, then &ldquo;Add to Home Screen&rdquo;, and open the
              kitchen app from there.
            </Alert>
          ) : support && 'reason' in support ? (
            <Alert tone="info">{support.reason}</Alert>
          ) : (
            <Switch
              checked={pushGranted}
              disabled={pushBusy}
              onCheckedChange={(next) => void togglePush(next)}
              label="Push alerts on this device"
              hint="New orders reach you even with the board closed. Worth turning on for at least one phone."
            />
          )}
        </div>

        {isLoading ? (
          <SkeletonText lines={4} />
        ) : (
          <>
            <div className="space-y-3 border-t border-line pt-4">
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

            <div className="space-y-3 border-t border-line pt-4">
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
      </CardBody>
    </Card>
  );
}
