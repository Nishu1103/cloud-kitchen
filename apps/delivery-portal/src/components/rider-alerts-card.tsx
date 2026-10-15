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
import { isAlertSoundEnabled, setAlertSoundEnabled } from '@/lib/alert';
import { disablePush, enablePush, permissionState, pushSupport } from '@/lib/push';

/**
 * Job offers are deliberately absent.
 *
 * A rider who mutes job offers has muted the entire point of the app, and would then
 * quietly stop getting work without understanding why. What is adjustable is the
 * traffic around the job itself, plus a device-level chime for somebody who needs
 * silence rather than ignorance.
 */
const CATEGORIES = [
  {
    key: categoryPreferenceKey(NOTIFICATION_CATEGORY.PAYMENT),
    label: 'Payouts',
    hint: 'When the campus settles what you have earned.',
  },
  {
    key: categoryPreferenceKey(NOTIFICATION_CATEGORY.SYSTEM),
    label: 'Campus notices',
    hint: 'Shift changes, closures, policy updates.',
  },
] as const;

const CHANNELS = [
  { key: channelPreferenceKey(NOTIFICATION_CHANNEL.PUSH), label: 'Push notifications' },
  { key: channelPreferenceKey(NOTIFICATION_CHANNEL.EMAIL), label: 'Email' },
] as const;

export function RiderAlertsCard() {
  const { data, isLoading } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  const [pushGranted, setPushGranted] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [sound, setSound] = useState(true);
  // Read on the client only: `Notification` and display-mode do not exist during SSR.
  const support = typeof window === 'undefined' ? null : pushSupport();

  useEffect(() => {
    setPushGranted(permissionState() === 'granted');
    setSound(isAlertSoundEnabled());
  }, []);

  // Absent means on: a new rider should hear about everything until they opt out.
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
        toast.success('This device will stop receiving job alerts.');
        return;
      }

      const outcome = await enablePush();
      if (outcome.status === 'registered') {
        setPushGranted(true);
        toast.success('Job alerts on for this device.');
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
        description="Job offers always reach you. Everything else is your call."
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
            label="Chime and vibrate on a new job"
            hint="Plays on this device while the app is open."
          />

          {support && support.status === 'needs-install' ? (
            <Alert tone="info" title="Install the app on this device first">
              {support.reason}. Tap Share, then &ldquo;Add to Home Screen&rdquo;, and open the
              rider app from there.
            </Alert>
          ) : support && 'reason' in support ? (
            <Alert tone="info">{support.reason}</Alert>
          ) : (
            <Switch
              checked={pushGranted}
              disabled={pushBusy}
              onCheckedChange={(next) => void togglePush(next)}
              label="Job alerts on this device"
              hint="Wakes your phone when a job opens, even with the app closed. Without this you only see jobs while the app is open."
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
