'use client';

import type { Address } from '@ck/types';
import { Button, Checkbox, Field, Input, Modal } from '@ck/ui';
import { useState } from 'react';
import { useSaveAddress } from '@/hooks/use-account';

/**
 * Add or edit a delivery address.
 *
 * Campus-shaped rather than street-shaped: a hostel and a room number find a student
 * far more reliably than a postal address on a campus where every building shares one.
 */
export function AddressDialog({
  open,
  onOpenChange,
  address,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address?: Address;
}) {
  const save = useSaveAddress();
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const label = String(form.get('label') ?? '').trim();
    if (!label) {
      setError('Give this address a name, like "Hostel" or "Lab".');
      return;
    }

    save.mutate(
      {
        id: address?.id,
        payload: {
          label,
          hostel: String(form.get('hostel') ?? '').trim() || undefined,
          roomNumber: String(form.get('roomNumber') ?? '').trim() || undefined,
          landmark: String(form.get('landmark') ?? '').trim() || undefined,
          contactName: String(form.get('contactName') ?? '').trim() || undefined,
          contactPhone: String(form.get('contactPhone') ?? '').trim() || undefined,
          isDefault: form.get('isDefault') === 'on',
        },
      },
      {
        onSuccess: () => {
          setError(null);
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={address ? 'Edit address' : 'Add an address'}
      description="The rider sees exactly what you write here."
    >
      <form id="address-form" className="space-y-4" onSubmit={submit}>
        <Field label="Name this address" error={error ?? undefined} required>
          <Input name="label" defaultValue={address?.label} placeholder="Hostel" maxLength={40} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hostel or building">
            <Input name="hostel" defaultValue={address?.hostel} placeholder="RK Hall" />
          </Field>
          <Field label="Room">
            <Input name="roomNumber" defaultValue={address?.roomNumber} placeholder="C-214" />
          </Field>
        </div>

        <Field label="Landmark" hint="Anything that helps at night.">
          <Input name="landmark" defaultValue={address?.landmark} placeholder="Near the back gate" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact name" hint="If someone else will collect it.">
            <Input name="contactName" defaultValue={address?.contactName} />
          </Field>
          <Field label="Contact phone">
            <Input
              name="contactPhone"
              type="tel"
              inputMode="numeric"
              defaultValue={address?.contactPhone}
              placeholder="9876543210"
            />
          </Field>
        </div>

        <Checkbox name="isDefault" defaultChecked={address?.isDefault} label="Use this by default" />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            {address ? 'Save changes' : 'Save address'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
