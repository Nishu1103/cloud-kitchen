'use client';

import { errorMessage, isApiError } from '@ck/sdk';
import { DELIVERY_STATUS, formatMoney, type DeliveryAssignment } from '@ck/types';
import { Alert, Button, Field, Input, Modal } from '@ck/ui';
import { useState } from 'react';
import { useUpdateJobStatus } from '@/hooks/use-jobs';
import { env } from '@/lib/env';
import type { Coordinates } from '@/lib/geo';

/** Matches the API's rule, so an obviously wrong code never costs an attempt. */
const CODE_LENGTH = 6;

/** The API refuses the delivery after this many wrong codes. */
const MAX_ATTEMPTS = 5;

/**
 * The handover.
 *
 * This is the one screen where the rider cannot simply assert what happened: completing
 * a delivery needs the code the student reads out, checked server-side. That is what
 * stops a partner marking food delivered and keeping it, so the code is never shown
 * here, never prefilled, and never guessed at - the field starts empty every time.
 *
 * Attempts are capped by the API. The remaining count is surfaced because a rider
 * standing at a door deserves to know they are one typo from having to call support,
 * rather than discovering it after the job locks.
 */
export function HandoverDialog({
  job,
  open,
  onOpenChange,
  location,
}: {
  job: DeliveryAssignment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Attached to the completion so the drop point is recorded where it happened. */
  location?: Coordinates;
}) {
  const [code, setCode] = useState('');
  const update = useUpdateJobStatus(job.id);

  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - job.otpAttempts);
  const locked = attemptsLeft === 0;
  const valid = new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid) return;

    update.mutate(
      { status: DELIVERY_STATUS.DELIVERED, otp: code, location },
      {
        onSuccess: () => {
          setCode('');
          onOpenChange(false);
        },
        // The field is cleared on a wrong code as well: retyping six digits is faster
        // than editing them, and it makes an accidental resubmit impossible.
        onError: () => setCode(''),
      },
    );
  };

  // A wrong code is a 400 from the API; a 403 means the attempt cap has been hit and the
  // job now needs support, which `locked` covers on the next render.
  const wrongCode = isApiError(update.error) && update.error.status === 400;
  const capReached = isApiError(update.error) && update.error.status === 403;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        // Never keep a typed code around between openings.
        if (!next) setCode('');
        onOpenChange(next);
      }}
      title="Confirm handover"
      description={`Ask ${job.drop.name} for their ${CODE_LENGTH}-digit code.`}
      size="sm"
    >
      <form className="space-y-4" onSubmit={submit}>
        {job.collectCash > 0 ? (
          <Alert tone="warning" title={`Collect ${formatMoney(job.collectCash)} in cash`}>
            This order is unpaid. Take the money before confirming — once you confirm, the
            order is closed.
          </Alert>
        ) : null}

        {locked || capReached ? (
          <Alert tone="danger" title="Too many wrong codes">
            This delivery is locked. Call support to complete it.
            {env.supportPhone ? ` Support: ${env.supportPhone}.` : ''}
          </Alert>
        ) : null}

        {update.isError && !locked && !capReached ? (
          <Alert tone="danger" title={wrongCode ? 'That code is not right' : 'Could not confirm'}>
            {wrongCode
              ? `Check the digits with the customer. ${attemptsLeft} ${
                  attemptsLeft === 1 ? 'attempt' : 'attempts'
                } left.`
              : errorMessage(update.error)}
          </Alert>
        ) : null}

        <Field label="Handover code" required>
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
            // A numeric keypad and no autofill: this is a code somebody is reading out,
            // not something the browser has ever seen before.
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            disabled={locked || capReached}
            placeholder="000000"
            className="text-center text-title-lg tracking-[0.4em]"
            aria-describedby="handover-hint"
          />
        </Field>
        <p id="handover-hint" className="text-caption text-ink-muted">
          The customer sees this code on their order screen.
        </p>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            block
            onClick={() => onOpenChange(false)}
            disabled={update.isPending}
          >
            Not yet
          </Button>
          <Button
            type="submit"
            block
            size="lg"
            loading={update.isPending}
            disabled={!valid || locked || capReached}
          >
            Delivered
          </Button>
        </div>
      </form>
    </Modal>
  );
}
