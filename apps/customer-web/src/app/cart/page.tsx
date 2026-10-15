'use client';

import { formatMoney } from '@ck/types';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Price,
  PriceRow,
  QuantityStepper,
  SkeletonText,
  Switch,
} from '@ck/ui';
import { ShoppingBag, Ticket, Trash2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { RequireAuth } from '@/components/require-auth';
import {
  useApplyCoupon,
  useCart,
  useClearCart,
  useUpdateCartLine,
  useWalletPreference,
} from '@/hooks/use-cart';
import { useWallet } from '@/hooks/use-account';

function CartContents() {
  const { data, isLoading } = useCart();
  const updateLine = useUpdateCartLine();
  const clearCart = useClearCart();
  const coupon = useApplyCoupon();
  const walletPreference = useWalletPreference();
  const wallet = useWallet();
  const [code, setCode] = useState('');

  if (isLoading) {
    return (
      <Card className="p-4">
        <SkeletonText lines={6} />
      </Card>
    );
  }

  const cart = data;
  const breakdown = data?.breakdown;

  if (!cart || cart.lines.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag aria-hidden className="h-6 w-6" />}
        title="Your cart is empty"
        description="Pick a kitchen and start adding dishes."
        action={
          <Button asChild>
            <Link href="/kitchens">Browse kitchens</Link>
          </Button>
        }
      />
    );
  }

  const walletBalance = wallet.data?.balance ?? 0;
  const walletApplied = (breakdown?.walletApplied ?? 0) > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem] lg:items-start">
      <div className="space-y-4">
        <Card>
          <CardHeader
            title={cart.vendorName ?? 'Your cart'}
            description={`${cart.lines.length} ${cart.lines.length === 1 ? 'item' : 'items'}`}
            action={
              <Button
                variant="ghost"
                size="sm"
                loading={clearCart.isPending}
                onClick={() => clearCart.mutate()}
                leadingIcon={<Trash2 aria-hidden className="h-4 w-4" />}
              >
                Empty
              </Button>
            }
          />
          <CardBody className="divide-y divide-line p-0">
            {cart.lines.map((line) => (
              <div key={line.id} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-body font-semibold text-ink">{line.name}</p>
                  {line.options.length > 0 ? (
                    <p className="text-caption text-ink-muted">
                      {line.options.map((option) => option.choiceName).join(', ')}
                    </p>
                  ) : null}
                  {line.notes ? (
                    <p className="text-caption italic text-ink-subtle">“{line.notes}”</p>
                  ) : null}
                  <p className="tabular mt-1 text-caption text-ink-muted">
                    {formatMoney(line.unitPrice)} each
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Price paise={line.lineTotal} className="font-semibold" />
                  <QuantityStepper
                    size="sm"
                    value={line.quantity}
                    disabled={updateLine.isPending}
                    onChange={(quantity) => updateLine.mutate({ lineId: line.id, quantity })}
                  />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Offers" description="One coupon per order." />
          <CardBody className="space-y-3">
            {cart.couponCode ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-success/30 bg-success-soft p-3">
                <p className="text-body font-semibold text-success-ink">
                  <Ticket aria-hidden className="mr-1.5 inline h-4 w-4" />
                  {cart.couponCode} applied
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={coupon.isPending}
                  onClick={() => coupon.mutate(undefined)}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <form
                className="flex items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (code.trim()) coupon.mutate(code.trim().toUpperCase());
                }}
              >
                <Input
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="Enter code"
                  aria-label="Coupon code"
                  aria-invalid={coupon.invalidCode || undefined}
                  className="uppercase"
                />
                <Button type="submit" variant="secondary" loading={coupon.isPending}>
                  Apply
                </Button>
              </form>
            )}

            {coupon.invalidCode ? (
              <Alert tone="danger">
                That code is not valid for this order. Check the terms, or try another.
              </Alert>
            ) : null}
          </CardBody>
        </Card>

        {walletBalance > 0 ? (
          <Card>
            <CardBody>
              <Switch
                checked={walletApplied}
                disabled={walletPreference.isPending}
                onCheckedChange={(checked) => walletPreference.mutate(checked)}
                label={
                  <span className="inline-flex items-center gap-2">
                    <Wallet aria-hidden className="h-4 w-4 text-ink-muted" /> Use wallet balance
                  </span>
                }
                hint={`${formatMoney(walletBalance)} available`}
              />
            </CardBody>
          </Card>
        ) : null}
      </div>

      <Card className="lg:sticky lg:top-20">
        <CardHeader title="Bill" />
        <CardBody className="space-y-0">
          {breakdown ? (
            <>
              <PriceRow label="Items" paise={breakdown.itemsTotal} />
              {breakdown.packagingFee > 0 ? (
                <PriceRow label="Packaging" paise={breakdown.packagingFee} />
              ) : null}
              {breakdown.deliveryFee > 0 ? (
                <PriceRow label="Delivery" paise={breakdown.deliveryFee} />
              ) : null}
              {breakdown.taxTotal > 0 ? <PriceRow label="Taxes" paise={breakdown.taxTotal} /> : null}
              {breakdown.discount > 0 ? (
                <PriceRow label="Coupon discount" paise={breakdown.discount} negative />
              ) : null}
              {breakdown.walletApplied > 0 ? (
                <PriceRow label="Wallet" paise={breakdown.walletApplied} negative />
              ) : null}
              <div className="mt-2 border-t border-line pt-2">
                <PriceRow label="To pay" paise={breakdown.payableNow} emphasis />
              </div>
            </>
          ) : null}
        </CardBody>
        <CardFooter>
          <Button block asChild>
            <Link href="/checkout">Choose delivery and pay</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function CartPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Your cart" />
      <RequireAuth message="Sign in to keep your cart across devices.">
        <CartContents />
      </RequireAuth>
    </div>
  );
}
