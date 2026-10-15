'use client';

import { Alert, Button, toast } from '@ck/ui';
import { BellRing, Share } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  enablePush,
  permissionState,
  pushSupport,
  refreshPushRegistration,
  type PushOutcome,
} from '@/lib/push';
import { useSession } from '@/lib/session';

const DISMISSED_KEY = 'ck.pushPromptDismissed';

/**
 * Asks for notification permission, but only in context.
 *
 * Never on first paint: a prompt fired before the student has ordered anything gets
 * denied, and a denial is close to permanent. The caller mounts this after a first
 * order, on the tracking screen, and in account settings.
 *
 * On iPhone and iPad, web push exists only for a site installed to the Home Screen, so
 * that case renders instructions instead of a switch that cannot work.
 */
export function PushPrompt({ compact = false }: { compact?: boolean }) {
  const { user } = useSession();
  const [state, setState] = useState<'unknown' | 'available' | 'granted' | 'blocked' | 'dismissed'>(
    'unknown',
  );
  const [install, setInstall] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;

    const permission = permissionState();
    if (permission === 'granted') {
      setState('granted');
      // Tokens rotate silently; re-registering keeps a "subscribed" device actually
      // subscribed instead of quietly receiving nothing.
      void refreshPushRegistration();
      return;
    }
    if (permission === 'denied') {
      setState('blocked');
      return;
    }

    const blocked = pushSupport();
    if (blocked?.status === 'needs-install') {
      setInstall(blocked.reason);
      setState('available');
      return;
    }
    if (blocked) {
      setState('blocked');
      return;
    }
    setState(localStorage.getItem(DISMISSED_KEY) ? 'dismissed' : 'available');
  }, [user]);

  if (!user || state !== 'available') return null;

  if (install) {
    return (
      <Alert tone="info" title="Turn on order alerts on iPhone">
        <p>{install}</p>
        <p className="mt-1 inline-flex items-center gap-1 text-caption">
          <Share aria-hidden className="h-3.5 w-3.5" /> Share → Add to Home Screen, then open the
          app from there.
        </p>
      </Alert>
    );
  }

  const request = async () => {
    setBusy(true);
    const outcome: PushOutcome = await enablePush();
    setBusy(false);

    if (outcome.status === 'registered') {
      setState('granted');
      toast.success('Order alerts are on for this device.');
      return;
    }
    if (outcome.status === 'denied') {
      setState('blocked');
      toast.message('No problem — you will still see everything in your notifications tab.');
      return;
    }
    setState('blocked');
    toast.error(
      'reason' in outcome ? outcome.reason : 'Could not turn on alerts on this device.',
    );
  };

  return (
    <div
      className={
        compact
          ? 'flex items-center gap-3 rounded-md border border-line bg-surface p-3'
          : 'flex flex-col gap-3 rounded-md border border-brand/30 bg-brand-soft/40 p-4 sm:flex-row sm:items-center'
      }
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink">
        <BellRing aria-hidden className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold text-ink">Get order alerts</p>
        <p className="text-caption text-ink-muted">
          We will ping you when the kitchen accepts, when it is cooking and when it is at your
          door. Nothing else.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            localStorage.setItem(DISMISSED_KEY, '1');
            setState('dismissed');
          }}
        >
          Not now
        </Button>
        <Button size="sm" loading={busy} onClick={() => void request()}>
          Turn on
        </Button>
      </div>
    </div>
  );
}
