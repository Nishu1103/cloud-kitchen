'use client';

import { PERMISSIONS, VENDOR_STATUS, type Vendor, type VendorStatus } from '@ck/types';
import { Button, ConfirmDialog, Field, Textarea } from '@ck/ui';
import { useState } from 'react';
import { useDecideVendor } from '@/hooks/use-admin';
import { useSession } from '@/lib/session';

/**
 * Approve, reject, suspend, or reinstate — the API's decision endpoint.
 *
 * Open/closed is the kitchen's own shutter. Admin pause is `suspended`, which also
 * forces the shutter closed until someone with `vendor:approve` reinstates them.
 */
export function KitchenActions({
  kitchen,
  size = 'xs',
}: {
  kitchen: Pick<Vendor, 'id' | 'name' | 'status'>;
  size?: 'xs' | 'sm';
}) {
  const { can } = useSession();
  const decide = useDecideVendor();
  const [prompt, setPrompt] = useState<{ status: VendorStatus; title: string } | null>(null);
  const [reason, setReason] = useState('');

  if (!can(PERMISSIONS.VENDOR_APPROVE)) return null;

  const pending = kitchen.status === VENDOR_STATUS.PENDING_APPROVAL;
  const approved = kitchen.status === VENDOR_STATUS.APPROVED;
  const suspended = kitchen.status === VENDOR_STATUS.SUSPENDED;

  if (!pending && !approved && !suspended) return null;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {pending ? (
        <>
          <Button
            size={size}
            variant="success"
            loading={decide.isPending}
            onClick={() => decide.mutate({ id: kitchen.id, status: VENDOR_STATUS.APPROVED })}
          >
            Approve
          </Button>
          <Button
            size={size}
            variant="danger-soft"
            onClick={() =>
              setPrompt({ status: VENDOR_STATUS.REJECTED, title: `Reject ${kitchen.name}?` })
            }
          >
            Reject
          </Button>
        </>
      ) : null}

      {approved ? (
        <Button
          size={size}
          variant="danger-soft"
          onClick={() =>
            setPrompt({ status: VENDOR_STATUS.SUSPENDED, title: `Suspend ${kitchen.name}?` })
          }
        >
          Suspend
        </Button>
      ) : null}

      {suspended ? (
        <Button
          size={size}
          variant="success"
          loading={decide.isPending}
          onClick={() => decide.mutate({ id: kitchen.id, status: VENDOR_STATUS.APPROVED })}
        >
          Reinstate
        </Button>
      ) : null}

      <ConfirmDialog
        open={Boolean(prompt)}
        onOpenChange={(open) => {
          if (!open) {
            setPrompt(null);
            setReason('');
          }
        }}
        title={prompt?.title ?? 'Confirm'}
        description={
          prompt?.status === VENDOR_STATUS.SUSPENDED
            ? 'Students stop seeing this kitchen and cannot order. The owner is emailed the reason. Reinstate later from this same screen.'
            : 'The applicant is emailed the reason. They would need to apply again.'
        }
        confirmLabel={prompt?.status === VENDOR_STATUS.SUSPENDED ? 'Suspend kitchen' : 'Reject application'}
        tone="danger"
        loading={decide.isPending}
        onConfirm={() => {
          const text = reason.trim();
          if (!prompt || text.length < 8) return;
          decide.mutate(
            { id: kitchen.id, status: prompt.status, reason: text },
            {
              onSettled: () => {
                setPrompt(null);
                setReason('');
              },
            },
          );
        }}
      >
        <Field
          label="Reason"
          required
          hint="At least 8 characters. The kitchen owner sees this."
        >
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={8}
            maxLength={300}
            placeholder={
              prompt?.status === VENDOR_STATUS.SUSPENDED
                ? 'Hygiene complaint, repeated late orders…'
                : 'Tell them what to fix.'
            }
          />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
