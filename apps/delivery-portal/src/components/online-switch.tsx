'use client';

import { PERMISSIONS } from '@ck/types';
import { Badge, Switch, Tooltip } from '@ck/ui';
import { useEarnings, useSetOnline } from '@/hooks/use-jobs';
import { useSession } from '@/lib/session';

/** Mid-shift availability. Offers stop the moment this is off. */
export function OnlineSwitch() {
  const { can } = useSession();
  const { data: summary } = useEarnings();
  const setOnline = useSetOnline();

  const canToggle = can(PERMISSIONS.DELIVERY_UPDATE_STATUS);
  const isOnline = summary?.isOnline ?? false;

  return (
    <Tooltip
      content={
        canToggle
          ? 'You only get job alerts while this is on'
          : 'Your account cannot change shift status'
      }
    >
      <span className="flex items-center gap-2">
        <Switch
          checked={isOnline}
          disabled={!canToggle || setOnline.isPending || !summary}
          onCheckedChange={(next) => setOnline.mutate(next)}
          aria-label="Available for deliveries"
        />
        <Badge tone={isOnline ? 'success' : 'neutral'} size="sm">
          {isOnline ? 'Online' : 'Offline'}
        </Badge>
      </span>
    </Tooltip>
  );
}
