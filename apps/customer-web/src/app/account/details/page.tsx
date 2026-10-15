'use client';

import { Avatar, Button, Field, Input } from '@ck/ui';
import { ShieldCheck } from 'lucide-react';
import { AccountPanel, AccountSubhead } from '@/components/account-subhead';
import { RequireAuth } from '@/components/require-auth';
import { useUpdateProfile } from '@/hooks/use-account';
import { useSession } from '@/lib/session';

function DetailsForm() {
  const { user } = useSession();
  const updateProfile = useUpdateProfile();

  if (!user) return null;

  return (
    <div>
      <AccountSubhead title="Your details" subtitle="Name and phone the kitchen will see" />
      <div className="px-4">
        <AccountPanel className="px-4 pb-5 pt-8 text-center">
          <Avatar name={user.name} src={user.avatarUrl} size="xl" className="mx-auto h-24 w-24 ring-4 ring-canvas" />
          <p className="mt-3 font-serif text-title text-ink">{user.name}</p>
          <p className="text-caption text-ink-muted">{user.email}</p>
        </AccountPanel>

        <form
          className="mt-4 space-y-4 rounded-[1.35rem] bg-surface p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            updateProfile.mutate({
              name: String(form.get('name') ?? '').trim() || undefined,
              phone: String(form.get('phone') ?? '').trim() || undefined,
            });
          }}
        >
          <Field label="Name">
            <Input
              name="name"
              defaultValue={user.name}
              maxLength={80}
              autoComplete="name"
              className="h-12 rounded-xl"
            />
          </Field>
          <Field label="Email">
            <Input value={user.email} readOnly disabled className="h-12 rounded-xl" />
          </Field>
          <Field
            label="Phone"
            hint={user.phoneVerified ? undefined : 'Riders use this to reach you.'}
          >
            <Input
              name="phone"
              type="tel"
              inputMode="numeric"
              defaultValue={user.phone}
              placeholder="9876543210"
              autoComplete="tel"
              maxLength={15}
              className="h-12 rounded-xl"
              trailing={
                user.phoneVerified ? (
                  <span className="inline-flex items-center gap-1 text-caption font-medium text-gold">
                    <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
                    Verified
                  </span>
                ) : null
              }
            />
          </Field>
          <Button type="submit" loading={updateProfile.isPending} className="h-12 w-full rounded-full">
            Save changes
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function AccountDetailsPage() {
  return (
    <RequireAuth>
      <DetailsForm />
    </RequireAuth>
  );
}
