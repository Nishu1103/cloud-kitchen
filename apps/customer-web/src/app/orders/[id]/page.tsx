'use client';

import { ORDER_STATUS, PAYMENT_STATUS, formatMoney } from '@ck/types';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  ErrorState,
  PageHeader,
  Price,
  PriceRow,
  SkeletonText,
  StatusBadge,
  humanizeStatus,
} from '@ck/ui';
import { Phone, ShieldCheck, Store } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { OrderTimeline } from '@/components/order-timeline';
import { PushPrompt } from '@/components/push-prompt';
import { RemoteImage } from '@/components/remote-image';
import { RequireAuth } from '@/components/require-auth';
import { ReviewDialog } from '@/components/review-dialog';
import { isLiveOrder, useCancelOrder, useHandoverCode, useOrder } from '@/hooks/use-orders';
import { PREPARING_KITCHEN } from '@/lib/media';

function OrderDetail({ id }: { id: string }) {
  const search = useSearchParams();
  const { data: order, isLoading, isError, refetch } = useOrder(id);
  // Enabled only while the order is live, so a closed order never asks for a code.
  const handover = useHandoverCode(id, Boolean(order && isLiveOrder(order.status)));
  const cancel = useCancelOrder(id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  if (isError) {
    return <ErrorState title="Order not found" onRetry={() => refetch()} />;
  }
  if (isLoading || !order) {
    return (
      <Card className="p-4">
        <SkeletonText lines={8} />
      </Card>
    );
  }

  const live = isLiveOrder(order.status);
  const handoverCode = handover.data?.code;
  // The kitchen has not started cooking yet, so cancelling costs nobody anything.
  const cancellable =
    order.status === ORDER_STATUS.PLACED || order.status === ORDER_STATUS.AWAITING_PAYMENT;
  const awaitingPayment =
    order.status === ORDER_STATUS.AWAITING_PAYMENT ||
    order.paymentStatus === PAYMENT_STATUS.PENDING;
  const completed =
    order.status === ORDER_STATUS.DELIVERED || order.status === ORDER_STATUS.COMPLETED;

  return (
    <div className="space-y-4">
      {search.get('placed') ? (
        <Alert tone="success" title="Order placed">
          The kitchen has it. We will keep this page updated as it moves.
        </Alert>
      ) : null}

      {awaitingPayment ? (
        <Alert tone="warning" title="Payment not completed">
          This order is on hold until payment goes through. If money left your account, it will
          settle here within a few minutes.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={
                live
                  ? order.status === ORDER_STATUS.PREPARING
                    ? 'Preparing your order'
                    : humanizeStatus(order.status)
                  : (order.vendorName ?? 'Your order')
              }
              description={
                order.status === ORDER_STATUS.PREPARING
                  ? 'Freshly cooking for you'
                  : `#${order.code} · ${order.type === 'delivery' ? 'Delivery' : 'Pickup'}${order.etaMinutes && live ? ` · ${order.etaMinutes} min` : ''}`
              }
              action={<StatusBadge status={order.status} />}
            />
            <CardBody className="space-y-4">
              {live && order.status === ORDER_STATUS.PREPARING ? (
                <div className="relative aspect-[16/9] overflow-hidden rounded-2xl">
                  <RemoteImage
                    src={PREPARING_KITCHEN}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 640px, 100vw"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <p className="tabular text-caption text-ink-subtle">
                Order ID: #{order.code}
                {` · Placed ${new Date(order.createdAt).toLocaleString('en-IN')}`}
              </p>
              <OrderTimeline order={order} variant="horizontal" />
            </CardBody>
          </Card>

          {handoverCode ? (
            <Card>
              <CardBody className="flex items-center gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <ShieldCheck aria-hidden className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-caption text-ink-muted">
                    {order.type === 'delivery' ? 'Show this to the rider' : 'Show this at the counter'}
                  </p>
                  <p className="tabular text-title-lg font-semibold tracking-widest text-ink">
                    {handoverCode}
                  </p>
                </div>
              </CardBody>
            </Card>
          ) : null}

          {order.deliveryPartner ? (
            <Card>
              <CardBody className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-caption text-ink-muted">Your rider</p>
                  <p className="text-body font-semibold text-ink">{order.deliveryPartner.name}</p>
                </div>
                {order.deliveryPartner.phone ? (
                  <Button variant="secondary" size="sm" asChild>
                    <a href={`tel:${order.deliveryPartner.phone}`}>
                      <Phone aria-hidden className="h-4 w-4" /> Call
                    </a>
                  </Button>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="What you ordered" />
            <CardBody className="divide-y divide-line p-0">
              {order.lines.map((line) => (
                <div key={line.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-body text-ink">
                      <span className="tabular font-semibold">{line.quantity}×</span> {line.name}
                    </p>
                    {line.options.length > 0 ? (
                      <p className="text-caption text-ink-muted">
                        {line.options.map((option) => option.choiceName).join(', ')}
                      </p>
                    ) : null}
                    {line.notes ? (
                      <p className="text-caption italic text-ink-subtle">“{line.notes}”</p>
                    ) : null}
                  </div>
                  <Price paise={line.lineTotal} />
                </div>
              ))}
            </CardBody>
          </Card>

          {order.address ? (
            <Card>
              <CardHeader title="Delivering to" />
              <CardBody className="text-body text-ink">
                <p className="font-medium">{order.address.label}</p>
                <p className="text-caption text-ink-muted">
                  {[order.address.hostel, order.address.roomNumber, order.address.landmark]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </CardBody>
            </Card>
          ) : null}

          {live ? <PushPrompt compact /> : null}
        </div>

        <div className="space-y-4">
          <Card className="lg:sticky lg:top-20">
            <CardHeader title="Bill" />
            <CardBody>
              <PriceRow label="Items" paise={order.breakdown.itemsTotal} />
              {order.breakdown.packagingFee > 0 ? (
                <PriceRow label="Packaging" paise={order.breakdown.packagingFee} />
              ) : null}
              {order.breakdown.deliveryFee > 0 ? (
                <PriceRow label="Delivery" paise={order.breakdown.deliveryFee} />
              ) : null}
              {order.breakdown.taxTotal > 0 ? (
                <PriceRow label="Taxes" paise={order.breakdown.taxTotal} />
              ) : null}
              {order.breakdown.discount > 0 ? (
                <PriceRow label="Discount" paise={order.breakdown.discount} negative />
              ) : null}
              {order.breakdown.walletApplied > 0 ? (
                <PriceRow label="Wallet" paise={order.breakdown.walletApplied} negative />
              ) : null}
              <div className="mt-2 border-t border-line pt-2">
                <PriceRow label="Total" paise={order.breakdown.grandTotal} emphasis />
              </div>
              <p className="mt-2 text-caption text-ink-subtle">
                Paid by {order.paymentMethod === 'cod' ? 'cash' : order.paymentMethod.toUpperCase()} ·{' '}
                {order.paymentStatus.replace(/_/g, ' ')}
              </p>
            </CardBody>
          </Card>

          <div className="space-y-2">
            {cancellable ? (
              <Button variant="danger-soft" block onClick={() => setConfirmOpen(true)}>
                Cancel order
              </Button>
            ) : null}

            {completed && !order.ratedAt ? (
              <Button variant="secondary" block onClick={() => setReviewOpen(true)}>
                Rate this order
              </Button>
            ) : null}

            <Button variant="ghost" block asChild>
              <Link href={`/support?orderId=${order.id}`}>Something wrong? Get help</Link>
            </Button>

            <Button variant="ghost" block asChild>
              <Link href="/kitchens">
                <Store aria-hidden className="h-4 w-4" /> Order again
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Cancel this order?"
        description={`Anything already paid (${formatMoney(order.breakdown.grandTotal)}) goes back to your campus wallet.`}
        confirmLabel="Cancel order"
        cancelLabel="Keep it"
        loading={cancel.isPending}
        onConfirm={() =>
          cancel.mutate('Cancelled by customer', { onSuccess: () => setConfirmOpen(false) })
        }
      />

      <ReviewDialog open={reviewOpen} onOpenChange={setReviewOpen} orderId={order.id} />
    </div>
  );
}

export default function OrderPage() {
  const params = useParams<{ id: string }>();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Order"
        breadcrumb={
          <Link href="/orders" className="text-caption text-ink-muted hover:text-ink">
            ← All orders
          </Link>
        }
      />
      <RequireAuth>
        <OrderDetail id={params.id} />
      </RequireAuth>
    </div>
  );
}
