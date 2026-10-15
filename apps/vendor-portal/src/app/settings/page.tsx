'use client';

import type { OperatingHourPayload, VendorProfilePayload } from '@ck/sdk';
import { formatMoney, paiseToRupees, PERMISSIONS, rupeesToPaise, type Vendor } from '@ck/types';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Field,
  Input,
  PageHeader,
  SkeletonText,
  Switch,
  Textarea,
} from '@ck/ui';
import { useState, type FormEvent } from 'react';
import { ImagePicker } from '@/components/image-picker';
import { KitchenAlertsCard } from '@/components/kitchen-alerts-card';
import { RequireAccess } from '@/components/require-access';
import { useChangePassword } from '@/hooks/use-account';
import { useKitchen, useUpdateKitchen } from '@/hooks/use-kitchen';
import { useSession } from '@/lib/session';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ProfileCard({ vendor, readOnly }: { vendor: Vendor; readOnly: boolean }) {
  const updateKitchen = useUpdateKitchen();

  const [name, setName] = useState(vendor.name);
  const [tagline, setTagline] = useState(vendor.tagline ?? '');
  const [description, setDescription] = useState(vendor.description ?? '');
  const [cuisines, setCuisines] = useState((vendor.cuisines ?? []).join(', '));
  const [logoUrl, setLogoUrl] = useState(vendor.logoUrl);
  const [coverUrl, setCoverUrl] = useState(vendor.coverUrl);
  const [prepMinutes, setPrepMinutes] = useState(String(vendor.avgPrepMinutes));
  const [minOrder, setMinOrder] = useState(String(paiseToRupees(vendor.minOrderAmount)));
  const [packaging, setPackaging] = useState(String(paiseToRupees(vendor.packagingFee)));
  const [acceptsDelivery, setAcceptsDelivery] = useState(vendor.acceptsDelivery);
  const [acceptsPickup, setAcceptsPickup] = useState(vendor.acceptsPickup);
  const [error, setError] = useState<string>();

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (!acceptsDelivery && !acceptsPickup) {
      setError('Choose at least delivery or pickup, otherwise nobody can order.');
      return;
    }
    setError(undefined);

    const payload: VendorProfilePayload = {
      name: name.trim(),
      tagline: tagline.trim() || undefined,
      description: description.trim() || undefined,
      cuisines: cuisines
        .split(',')
        .map((cuisine) => cuisine.trim())
        .filter(Boolean),
      logoUrl,
      coverUrl,
      avgPrepMinutes: Number(prepMinutes),
      minOrderAmount: rupeesToPaise(Number(minOrder || 0)),
      packagingFee: rupeesToPaise(Number(packaging || 0)),
      acceptsDelivery,
      acceptsPickup,
    };

    updateKitchen.mutate(payload);
  };

  return (
    <Card>
      <CardHeader
        title="Kitchen profile"
        description="What students see on your storefront."
      />
      <CardBody>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Logo">
              <ImagePicker value={logoUrl} onChange={setLogoUrl} disabled={readOnly} purpose="kitchen" />
            </Field>
            <Field label="Cover photo" hint="Wide image at the top of your storefront.">
              <ImagePicker value={coverUrl} onChange={setCoverUrl} disabled={readOnly} purpose="kitchen" />
            </Field>
          </div>

          <Field label="Kitchen name" required>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={readOnly}
              maxLength={80}
            />
          </Field>

          <Field label="Tagline" hint="One line under your name.">
            <Input
              value={tagline}
              onChange={(event) => setTagline(event.target.value)}
              disabled={readOnly}
              placeholder="Home-style North Indian, cooked to order"
              maxLength={120}
            />
          </Field>

          <Field label="About">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={readOnly}
              rows={3}
              maxLength={600}
            />
          </Field>

          <Field label="Cuisines" hint="Comma separated. Used by search and filters.">
            <Input
              value={cuisines}
              onChange={(event) => setCuisines(event.target.value)}
              disabled={readOnly}
              placeholder="North Indian, Chinese"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Typical prep time" hint="Minutes.">
              <Input
                value={prepMinutes}
                onChange={(event) => setPrepMinutes(event.target.value)}
                disabled={readOnly}
                inputMode="numeric"
              />
            </Field>
            <Field label="Minimum order" hint="Rupees. 0 for none.">
              <Input
                value={minOrder}
                onChange={(event) => setMinOrder(event.target.value)}
                disabled={readOnly}
                inputMode="decimal"
              />
            </Field>
            <Field label="Packaging fee" hint="Rupees per order.">
              <Input
                value={packaging}
                onChange={(event) => setPackaging(event.target.value)}
                disabled={readOnly}
                inputMode="decimal"
              />
            </Field>
          </div>

          <div className="space-y-1 border-t border-line pt-4">
            <Switch
              checked={acceptsDelivery}
              onCheckedChange={setAcceptsDelivery}
              disabled={readOnly}
              label="Accept delivery orders"
              hint="A delivery partner collects and drops off."
            />
            <Switch
              checked={acceptsPickup}
              onCheckedChange={setAcceptsPickup}
              disabled={readOnly}
              label="Accept pickup orders"
              hint="Students collect from your counter."
            />
          </div>

          {error ? (
            <Alert tone="danger" title="Check this before saving">
              {error}
            </Alert>
          ) : null}

          {/*
            Commission and the delivery fee are deliberately read-only: they are contract
            terms the platform sets, and the API rejects a vendor trying to change them.
          */}
          <div className="rounded border border-line bg-surface-muted px-3 py-2 text-caption text-ink-muted">
            Platform commission {vendor.commissionPercent}% · delivery fee{' '}
            {formatMoney(vendor.deliveryFee)}. Contact campus admin to change these.
          </div>

          {!readOnly ? (
            <div className="flex justify-end">
              <Button type="submit" loading={updateKitchen.isPending}>
                Save profile
              </Button>
            </div>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}

function HoursCard({ vendor, readOnly }: { vendor: Vendor; readOnly: boolean }) {
  const updateKitchen = useUpdateKitchen();

  const [hours, setHours] = useState<OperatingHourPayload[]>(() =>
    DAYS.map((_, day) => {
      const existing = vendor.operatingHours.find((entry) => entry.day === day);
      return {
        day,
        open: existing?.open ?? '09:00',
        close: existing?.close ?? '22:00',
        isClosed: existing?.isClosed ?? !existing,
      };
    }),
  );

  const setDay = (day: number, patch: Partial<OperatingHourPayload>) =>
    setHours((current) =>
      current.map((entry) => (entry.day === day ? { ...entry, ...patch } : entry)),
    );

  return (
    <Card>
      <CardHeader
        title="Opening hours"
        description="Your storefront closes automatically outside these hours. The open/closed switch in the header overrides them for today."
      />
      <CardBody className="space-y-3">
        {hours.map((entry) => (
          <div key={entry.day} className="flex flex-wrap items-center gap-3">
            <span className="w-24 shrink-0 text-body text-ink">{DAYS[entry.day]}</span>

            {entry.isClosed ? (
              <span className="flex-1 text-caption text-ink-subtle">Closed all day</span>
            ) : (
              <div className="flex flex-1 items-center gap-2">
                <Input
                  type="time"
                  value={entry.open}
                  disabled={readOnly}
                  aria-label={`${DAYS[entry.day]} opening time`}
                  onChange={(event) => setDay(entry.day, { open: event.target.value })}
                  className="w-32"
                />
                <span className="text-caption text-ink-subtle">to</span>
                <Input
                  type="time"
                  value={entry.close}
                  disabled={readOnly}
                  aria-label={`${DAYS[entry.day]} closing time`}
                  onChange={(event) => setDay(entry.day, { close: event.target.value })}
                  className="w-32"
                />
              </div>
            )}

            <Switch
              checked={!entry.isClosed}
              disabled={readOnly}
              aria-label={`Open on ${DAYS[entry.day]}`}
              onCheckedChange={(open) => setDay(entry.day, { isClosed: !open })}
            />
          </div>
        ))}

        {!readOnly ? (
          <div className="flex justify-end border-t border-line pt-4">
            <Button
              loading={updateKitchen.isPending}
              onClick={() => updateKitchen.mutate({ operatingHours: hours })}
            >
              Save hours
            </Button>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function PasswordCard() {
  const changePassword = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (next.length < 10) {
      setError('Use at least 10 characters.');
      return;
    }
    if (next !== confirm) {
      setError('The two new passwords do not match.');
      return;
    }

    setError(undefined);
    await changePassword.mutateAsync({ current, next });
    setCurrent('');
    setNext('');
    setConfirm('');
  };

  return (
    <Card>
      <CardHeader
        title="Password"
        description="Shared kitchen accounts are a bad idea — ask campus admin for a staff login instead."
      />
      <CardBody>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Current password" required>
            <Input
              type="password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password" required error={error} hint="At least 10 characters.">
            <Input
              type="password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password" required>
            <Input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={changePassword.isPending}>
              Change password
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function SettingsScreen() {
  const { can } = useSession();
  const readOnly = !can(PERMISSIONS.VENDOR_UPDATE_OWN);
  const { data: vendor, isLoading, isError, refetch } = useKitchen();

  return (
    <>
      <PageHeader
        title="Kitchen settings"
        description="Your storefront, your hours, and how you get alerted."
      />

      {isError ? (
        <ErrorState message="Could not load your kitchen." onRetry={() => void refetch()} />
      ) : isLoading || !vendor ? (
        <Card>
          <CardBody>
            <SkeletonText lines={8} />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {readOnly ? (
            <Alert tone="info">
              You can see these settings but not change them. Ask the kitchen owner for edit
              access.
            </Alert>
          ) : null}

          <ProfileCard vendor={vendor} readOnly={readOnly} />
          <HoursCard vendor={vendor} readOnly={readOnly} />
          <KitchenAlertsCard />
          <PasswordCard />
        </div>
      )}
    </>
  );
}

export default function SettingsPage() {
  return (
    <RequireAccess>
      <SettingsScreen />
    </RequireAccess>
  );
}
