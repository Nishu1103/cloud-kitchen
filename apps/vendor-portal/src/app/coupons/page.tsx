'use client';

import type { CouponPayload } from '@ck/sdk';
import {
  COUPON_TYPE,
  formatMoney,
  PERMISSIONS,
  rupeesToPaise,
  type Coupon,
  type CouponType,
} from '@ck/types';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Pagination,
  Select,
  Switch,
  Skeleton,
} from '@ck/ui';
import { Megaphone, Plus, Tags } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { RequireAccess } from '@/components/require-access';
import { VendorScreen } from '@/components/vendor-screen';
import { useCoupons, useCreateCoupon, useUpdateCoupon } from '@/hooks/use-kitchen';

const TYPE_OPTIONS = [
  { value: COUPON_TYPE.PERCENTAGE, label: 'Percentage off' },
  { value: COUPON_TYPE.FLAT, label: 'Flat amount off' },
  { value: COUPON_TYPE.FREE_DELIVERY, label: 'Free delivery' },
];

/** What the student actually gets, in one phrase. */
function describeDiscount(coupon: Coupon): string {
  if (coupon.type === COUPON_TYPE.FREE_DELIVERY) return 'Free delivery';
  if (coupon.type === COUPON_TYPE.PERCENTAGE) {
    const cap = coupon.maxDiscount ? ` up to ${formatMoney(coupon.maxDiscount)}` : '';
    return `${coupon.value}% off${cap}`;
  }
  if (coupon.type === COUPON_TYPE.FLAT) return `${formatMoney(coupon.value)} off`;
  return 'Offer';
}

function couponState(coupon: Coupon): { tone: 'success' | 'warning' | 'danger'; text: string } {
  const now = Date.now();
  if (!coupon.isActive) return { tone: 'danger', text: 'Paused' };
  if (new Date(coupon.validFrom).getTime() > now) return { tone: 'warning', text: 'Scheduled' };
  if (new Date(coupon.validTo).getTime() < now) return { tone: 'danger', text: 'Expired' };
  if (coupon.usageLimitTotal && coupon.usedCount >= coupon.usageLimitTotal) {
    return { tone: 'danger', text: 'Used up' };
  }
  return { tone: 'success', text: 'Live' };
}

function todayISO(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

interface Draft {
  code: string;
  title: string;
  type: CouponType;
  value: string;
  maxDiscount: string;
  minOrderAmount: string;
  validFrom: string;
  validTo: string;
  usageLimitTotal: string;
  usageLimitPerUser: string;
  firstOrderOnly: boolean;
}

const EMPTY_DRAFT: Draft = {
  code: '',
  title: '',
  type: COUPON_TYPE.PERCENTAGE,
  value: '',
  maxDiscount: '',
  minOrderAmount: '',
  validFrom: todayISO(),
  validTo: todayISO(30),
  usageLimitTotal: '',
  usageLimitPerUser: '1',
  firstOrderOnly: false,
};

type Errors = Partial<Record<'code' | 'title' | 'value' | 'validTo', string>>;

function NewCouponDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Errors>({});
  const createCoupon = useCreateCoupon();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const isPercentage = draft.type === COUPON_TYPE.PERCENTAGE;
  const needsValue = draft.type !== COUPON_TYPE.FREE_DELIVERY;

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const found: Errors = {};
    const value = Number(draft.value);

    if (!/^[A-Z0-9]{4,20}$/.test(draft.code)) {
      found.code = '4–20 characters, letters and numbers only.';
    }
    if (draft.title.trim().length < 3) found.title = 'Give the offer a short name.';
    if (needsValue) {
      if (Number.isNaN(value) || value <= 0) found.value = 'Enter an amount above zero.';
      else if (isPercentage && value > 90) found.value = 'Keep percentage discounts at 90% or less.';
    }
    if (new Date(draft.validTo) < new Date(draft.validFrom)) {
      found.validTo = 'The end date must be after the start date.';
    }

    setErrors(found);
    if (Object.keys(found).length) return;

    const payload: CouponPayload = {
      code: draft.code,
      title: draft.title.trim(),
      type: draft.type,
      // A percentage is a plain number; a flat discount is money, so it goes as paise.
      value: needsValue ? (isPercentage ? value : rupeesToPaise(value)) : 0,
      validFrom: draft.validFrom,
      validTo: draft.validTo,
      maxDiscount:
        isPercentage && draft.maxDiscount ? rupeesToPaise(Number(draft.maxDiscount)) : undefined,
      minOrderAmount: draft.minOrderAmount
        ? rupeesToPaise(Number(draft.minOrderAmount))
        : undefined,
      usageLimitTotal: draft.usageLimitTotal ? Number(draft.usageLimitTotal) : undefined,
      usageLimitPerUser: draft.usageLimitPerUser ? Number(draft.usageLimitPerUser) : undefined,
      firstOrderOnly: draft.firstOrderOnly,
    };

    await createCoupon.mutateAsync(payload);
    setDraft(EMPTY_DRAFT);
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New coupon"
      description="The discount comes out of your revenue, not the platform's."
      size="lg"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={createCoupon.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form="coupon-form" loading={createCoupon.isPending}>
            Create coupon
          </Button>
        </>
      }
    >
      <form id="coupon-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" required error={errors.code} hint="Students type this at checkout.">
            <Input
              value={draft.code}
              // Upper-cased as typed: codes are compared case-insensitively server-side,
              // but showing them consistently avoids "why didn't mine work" support.
              onChange={(event) => set('code', event.target.value.toUpperCase().trim())}
              placeholder="LUNCH20"
              autoComplete="off"
              maxLength={20}
            />
          </Field>

          <Field label="Offer name" required error={errors.title}>
            <Input
              value={draft.title}
              onChange={(event) => set('title', event.target.value)}
              placeholder="20% off lunch"
              maxLength={80}
            />
          </Field>

          <Field label="Discount type" required>
            <Select
              value={draft.type}
              onValueChange={(value) => set('type', value as CouponType)}
              options={TYPE_OPTIONS}
            />
          </Field>

          {needsValue ? (
            <Field
              label={isPercentage ? 'Percentage off' : 'Amount off'}
              required
              error={errors.value}
              hint={isPercentage ? 'For example 20 for 20%.' : 'In rupees.'}
            >
              <Input
                value={draft.value}
                onChange={(event) => set('value', event.target.value)}
                inputMode="decimal"
                placeholder={isPercentage ? '20' : '50'}
              />
            </Field>
          ) : null}

          {isPercentage ? (
            <Field
              label="Cap the discount"
              hint="Optional, but strongly recommended on a percentage."
            >
              <Input
                value={draft.maxDiscount}
                onChange={(event) => set('maxDiscount', event.target.value)}
                inputMode="decimal"
                placeholder="60"
              />
            </Field>
          ) : null}

          <Field label="Minimum order" hint="Optional. In rupees.">
            <Input
              value={draft.minOrderAmount}
              onChange={(event) => set('minOrderAmount', event.target.value)}
              inputMode="decimal"
              placeholder="150"
            />
          </Field>

          <Field label="Starts" required>
            <Input
              type="date"
              value={draft.validFrom}
              min={todayISO()}
              onChange={(event) => set('validFrom', event.target.value)}
            />
          </Field>

          <Field label="Ends" required error={errors.validTo}>
            <Input
              type="date"
              value={draft.validTo}
              min={draft.validFrom}
              onChange={(event) => set('validTo', event.target.value)}
            />
          </Field>

          <Field label="Total uses" hint="Optional. Blank means unlimited.">
            <Input
              value={draft.usageLimitTotal}
              onChange={(event) => set('usageLimitTotal', event.target.value)}
              inputMode="numeric"
              placeholder="Unlimited"
            />
          </Field>

          <Field label="Uses per student" hint="Keeps one person from draining the budget.">
            <Input
              value={draft.usageLimitPerUser}
              onChange={(event) => set('usageLimitPerUser', event.target.value)}
              inputMode="numeric"
            />
          </Field>
        </div>

        <Switch
          checked={draft.firstOrderOnly}
          onCheckedChange={(checked) => set('firstOrderOnly', checked)}
          label="First order only"
          hint="Only students who have never ordered from you can use it."
        />
      </form>
    </Modal>
  );
}

function BoostBanner({ onCreate }: { onCreate: () => void }) {
  return (
    <button
      type="button"
      onClick={onCreate}
      className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-brand to-brand-hover p-4 text-left text-brand-ink shadow-brand"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
        <Megaphone aria-hidden className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-semibold">Boost your sales!</span>
        <span className="block text-caption text-white/80">A timed offer fills a quiet evening.</span>
      </span>
    </button>
  );
}

function CouponsScreen() {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [pausing, setPausing] = useState<Coupon>();
  const [tab, setTab] = useState<'running' | 'upcoming'>('running');

  const { data, isLoading, isError, refetch } = useCoupons(page);
  const updateCoupon = useUpdateCoupon();

  const now = Date.now();
  const buckets = useMemo(() => {
    const items = data?.items ?? [];
    const upcoming = items.filter((coupon) => new Date(coupon.validFrom).getTime() > now);
    const running = items.filter((coupon) => {
      const starts = new Date(coupon.validFrom).getTime();
      const ends = new Date(coupon.validTo).getTime();
      return coupon.isActive && starts <= now && ends >= now;
    });
    return { running, upcoming };
  }, [data?.items, now]);
  const filtered = tab === 'upcoming' ? buckets.upcoming : buckets.running;

  return (
    <>
      <VendorScreen
        title="Promotions"
        backHref="/more"
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden className="h-4 w-4" />
            New
          </Button>
        }
      >
        <BoostBanner onCreate={() => setCreating(true)} />

        <div role="tablist" className="mb-4 mt-4 flex gap-1.5">
          {(
            [
              { id: 'running', label: `Running (${buckets.running.length})` },
              { id: 'upcoming', label: `Upcoming (${buckets.upcoming.length})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`rounded-full px-4 py-2 text-caption font-medium ${
                tab === item.id ? 'bg-brand text-brand-ink' : 'bg-surface text-ink-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isError ? (
          <ErrorState message="Could not load your coupons." onRetry={() => void refetch()} />
        ) : isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
          </div>
        ) : !filtered.length ? (
          <EmptyState
            icon={<Tags aria-hidden className="h-6 w-6" />}
            title={tab === 'upcoming' ? 'Nothing scheduled' : 'No live offers'}
            description="A small, capped offer on a slow evening is the cheapest way to fill the kitchen."
            action={<Button onClick={() => setCreating(true)}>Create your first coupon</Button>}
          />
        ) : (
          <>
            <ul className="space-y-3">
              {filtered.map((coupon) => {
                const state = couponState(coupon);
                const used = coupon.usedCount;
                const cap = coupon.usageLimitTotal;
                const progress = cap ? Math.min(100, Math.round((used / cap) * 100)) : null;
                return (
                  <li key={coupon.id} className="rounded-2xl bg-surface p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-title font-semibold text-ink">
                          {describeDiscount(coupon)}
                        </p>
                        <p className="font-mono text-caption text-ink-muted">{coupon.code}</p>
                      </div>
                      <Badge tone={state.tone} size="sm">
                        {state.text}
                      </Badge>
                    </div>
                    <p className="mt-1 text-caption text-ink-muted">{coupon.title}</p>
                    <p className="mt-2 text-caption text-ink-subtle">
                      {new Date(coupon.validFrom).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                      {' – '}
                      {new Date(coupon.validTo).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                    {progress !== null ? (
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-caption text-ink-muted">
                          <span>
                            Used {used} / {cap}
                          </span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-brand-soft">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-caption text-ink-subtle">Used {used} times</p>
                    )}
                    <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                      <span className="text-caption text-ink-muted">Live for students</span>
                      <Switch
                        checked={coupon.isActive}
                        disabled={updateCoupon.isPending}
                        aria-label={`${coupon.isActive ? 'Pause' : 'Resume'} ${coupon.code}`}
                        onCheckedChange={(checked) => {
                          if (!checked) setPausing(coupon);
                          else
                            updateCoupon.mutate({
                              id: coupon.id,
                              payload: { isActive: true },
                            });
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            {data ? (
              <Pagination
                page={data.page}
                limit={data.limit}
                total={data.total}
                onPageChange={setPage}
                className="mt-4"
              />
            ) : null}
          </>
        )}
      </VendorScreen>

      <NewCouponDialog open={creating} onOpenChange={setCreating} />

      <ConfirmDialog
        open={Boolean(pausing)}
        onOpenChange={(open) => !open && setPausing(undefined)}
        title={`Pause ${pausing?.code ?? 'this coupon'}?`}
        description="Students will stop being able to apply it immediately. You can resume it any time."
        confirmLabel="Pause it"
        cancelLabel="Leave it live"
        loading={updateCoupon.isPending}
        onConfirm={async () => {
          if (pausing) {
            await updateCoupon.mutateAsync({ id: pausing.id, payload: { isActive: false } });
          }
          setPausing(undefined);
        }}
      />
    </>
  );
}

export default function CouponsPage() {
  return (
    <RequireAccess permission={PERMISSIONS.COUPON_MANAGE}>
      <CouponsScreen />
    </RequireAccess>
  );
}
