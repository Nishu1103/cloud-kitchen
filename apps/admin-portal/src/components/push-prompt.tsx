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

/**
 * Opt-in for admin push. Never on first paint — a premature prompt is denied forever.
 * iOS only works after Add to Home Screen.
 */
export function PushPrompt() {
  const { user } = useSession();
  const [state, setState] = useState<'hidden' | 'available' | 'install'>('hidden');
  const [installReason, setInstallReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;

    const permission = permissionState();
    if (permission === 'granted') {
      void refreshPushRegistration();
      return;
    }
    if (permission === 'denied') return;

    const blocked = pushSupport();
    if (blocked?.status === 'needs-install') {
      setInstallReason(blocked.reason);
      setState('install');
      return;
    }
    if (blocked) return;
    setState('available');
  }, [user]);

  if (!user || state === 'hidden') return null;

  if (state === 'install' && installReason) {
    return (
      <Alert tone="info" title="Install this portal on iPhone first">
        <p>{installReason}</p>
        <p className="mt-1 inline-flex items-center gap-1 text-caption">
          <Share aria-hidden className="h-3.5 w-3.5" /> Share → Add to Home Screen, then open Admin
          from there.
        </p>
      </Alert>
    );
  }

  const request = async () => {
    setBusy(true);
    const outcome: PushOutcome = await enablePush();
    setBusy(false);

    if (outcome.status === 'registered') {
      setState('hidden');
      toast.success('Alerts are on for this device.');
      return;
    }
    if (outcome.status === 'denied') {
      setState('hidden');
      toast.message('You will still see everything in this list.');
      return;
    }
    toast.error('reason' in outcome ? outcome.reason : 'Could not turn on alerts.');
  };

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-md border border-brand/30 bg-brand-soft/40 p-4 sm:flex-row sm:items-center">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink">
        <BellRing aria-hidden className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold text-ink">Get operator alerts</p>
        <p className="text-caption text-ink-muted">
          New kitchen applications, complaints and campus broadcasts. Order chatter stays in the
          kitchen and rider apps.
        </p>
      </div>
      <Button size="sm" loading={busy} onClick={() => void request()}>
        Turn on
      </Button>
    </div>
  );
}
