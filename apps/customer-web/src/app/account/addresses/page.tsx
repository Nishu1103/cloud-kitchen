'use client';

import { Button, ConfirmDialog, SkeletonText } from '@ck/ui';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AccountPanel, AccountSubhead } from '@/components/account-subhead';
import { AddressDialog } from '@/components/address-dialog';
import { RequireAuth } from '@/components/require-auth';
import { useAddresses, useDeleteAddress } from '@/hooks/use-account';

function AddressesContents() {
  const addresses = useAddresses();
  const deleteAddress = useDeleteAddress();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const saved = (addresses.data ?? []).filter(
    (address): address is typeof address & { id: string } => Boolean(address.id),
  );

  return (
    <div>
      <AccountSubhead
        title="Addresses"
        subtitle="Hostel and room for faster checkout"
        action={
          <Button
            size="sm"
            className="rounded-full"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            leadingIcon={<Plus aria-hidden className="h-4 w-4" />}
          >
            Add
          </Button>
        }
      />

      <div className="px-4">
        <AccountPanel>
          {addresses.isLoading ? (
            <div className="p-4">
              <SkeletonText lines={3} />
            </div>
          ) : saved.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <MapPin aria-hidden className="mx-auto h-8 w-8 text-brand" />
              <p className="mt-3 font-serif text-title text-ink">No addresses yet</p>
              <p className="mt-1 text-body text-ink-muted">Add your hostel and room to order faster.</p>
            </div>
          ) : (
            <ul>
              {saved.map((address) => (
                <li
                  key={address.id}
                  className="flex items-start gap-3 border-b border-white/8 p-4 last:border-b-0"
                >
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                    <MapPin aria-hidden className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-body font-semibold text-ink">
                      {address.label}
                      {address.isDefault ? (
                        <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-micro font-semibold text-white">
                          Default
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-caption text-ink-muted">
                      {[address.hostel, address.roomNumber, address.landmark].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(address.id);
                        setOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${address.label}`}
                      onClick={() => setConfirmDelete(address.id)}
                    >
                      <Trash2 aria-hidden className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AccountPanel>
      </div>

      <AddressDialog
        open={open}
        onOpenChange={setOpen}
        address={saved.find((address) => address.id === editing)}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(openDialog) => !openDialog && setConfirmDelete(null)}
        title="Delete this address?"
        description="Orders already placed keep the address they were sent to."
        confirmLabel="Delete"
        loading={deleteAddress.isPending}
        onConfirm={() => {
          if (confirmDelete) {
            deleteAddress.mutate(confirmDelete, { onSuccess: () => setConfirmDelete(null) });
          }
        }}
      />
    </div>
  );
}

export default function AddressesPage() {
  return (
    <RequireAuth>
      <AddressesContents />
    </RequireAuth>
  );
}
