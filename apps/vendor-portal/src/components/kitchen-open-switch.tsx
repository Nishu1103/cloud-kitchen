'use client';

import { PERMISSIONS, VENDOR_STATUS } from '@ck/types';
import { Badge, Switch, Tooltip } from '@ck/ui';
import { useKitchen, useSetOpenState } from '@/hooks/use-kitchen';
import { useSession } from '@/lib/session';

/**
 * Mid-service open/closed control.
 *
 * Lives in the header rather than only on settings because a kitchen that has run out
 * of gas needs to stop taking orders in one tap from wherever it happens to be.
 */
export function KitchenOpenSwitch({ inverted = false }: { inverted?: boolean }) {
  const { can } = useSession();
  const { data: kitchen } = useKitchen();
  const setOpen = useSetOpenState();

  if (!kitchen) return null;

  const approved = kitchen.status === VENDOR_STATUS.APPROVED;
  const canToggle = can(PERMISSIONS.VENDOR_UPDATE_OWN) && approved;

  return (
    <Tooltip
      content={
        canToggle
          ? 'Students can only order while this is on'
          : approved
            ? 'You do not have permission to change this'
            : 'A kitchen can open once the campus approves it'
      }
    >
      <span className="flex items-center gap-2">
        <Switch
          checked={kitchen.isOpen}
          disabled={!canToggle || setOpen.isPending}
          onCheckedChange={(next) => setOpen.mutate(next)}
          aria-label="Accepting orders"
        />
        <Badge
          tone={kitchen.isOpen ? 'success' : 'neutral'}
          size="sm"
          className={inverted && !kitchen.isOpen ? 'bg-white/15 text-white' : undefined}
        >
          {kitchen.isOpen ? 'Open' : 'Closed'}
        </Badge>
      </span>
    </Tooltip>
  );
}
