'use client';

import { formatMoney, ORDER_TYPE, PAYMENT_METHOD, PERMISSIONS } from '@ck/types';
import {
  Alert,
  ErrorState,
  PriceRow,
  Skeleton,
  humanizeStatus,
} from '@ck/ui';
import { Clock, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Elapsed } from '@/components/elapsed';
import { OrderStatusActions } from '@/components/order-status-actions';
import { RequireAccess } from '@/components/require-access';
import { VendorScreen } from '@/components/vendor-screen';
import { useKitchen } from '@/hooks/use-kitchen';
import { useVendorOrder } from '@/hooks/use-orders';
import { distanceKm, formatKm } from '@/lib/geo';

function OrderDetailView({ id }: { id: string }) {
  const { data: order, isLoading, isError, refetch } = useVendorOrder(id);
  const { data: kitchen } = useKitchen();

  if (isLoading) {
    return (
      <VendorScreen title="Order" backHref="/orders">
        <Skeleton className="h-80 rounded-2xl" />
      </VendorScreen>
    );
  }

  if (isError || !order) {
    return (
      <VendorScreen title="Order" backHref="/orders">
        <ErrorState message="We could not load this order." onRetry={() => void refetch()} />
      </VendorScreen>
    );
  }

  const isDelivery = order.type === ORDER_TYPE.DELIVERY;
  const collectsCash =
    order.paymentMethod === PAYMENT_METHOD.CASH_ON_DELIVERY && order.breakdown.payableNow > 0;
  const customer = order.customer?.name ?? order.customerName ?? 'Student';
  const addressLine = order.address
    ? [order.address.hostel, order.address.roomNumber, order.address.line1].filter(Boolean).join(', ')
    : null;
  const km =
    isDelivery && kitchen?.location && order.address?.location
      ? distanceKm(kitchen.location, order.address.location)
      : null;

  return (
    <VendorScreen title={order.code} backHref="/orders">
      <div className="space-y-4">
        <section className="rounded-2xl bg-brand p-4 text-brand-ink shadow-brand">
          <p className="text-caption text-white/80">{isDelivery ? 'Delivery' : 'Pickup'}</p>
          <p className="text-title font-semibold">{order.code}</p>
          <p className="mt-1 flex items-center gap-1.5 text-caption text-white/80">
            <Clock aria-hidden className="h-3.5 w-3.5" />
            Placed <Elapsed since={order.createdAt} /> ago · {humanizeStatus(order.status)}
          </p>
        </section>

        {collectsCash ? (
          <Alert tone="warning" title={`Collect ${formatMoney(order.breakdown.payableNow)} on handover`}>
            This order is cash on delivery. The rest is already paid.
          </Alert>
        ) : null}

        <section className="rounded-2xl bg-surface p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-body font-semibold text-ink">{customer}</p>
              {addressLine ? (
                <p className="mt-1 flex items-start gap-1.5 text-caption text-ink-muted">
                  <MapPin aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {addressLine}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-2">
              {order.customer?.phone ? (
                <a
                  href={`tel:${order.customer.phone}`}
                  aria-label="Call customer"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand"
                >
                  <Phone aria-hidden className="h-4 w-4" />
                </a>
              ) : null}
              {order.customer?.phone ? (
                <a
                  href={`sms:${order.customer.phone}`}
                  aria-label="Message customer"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand"
                >
                  <MessageCircle aria-hidden className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </div>

          {(km !== null || order.etaMinutes) && (
            <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
              {km !== null ? (
                <div>
                  <dt className="text-caption text-ink-muted">Distance</dt>
                  <dd className="text-body font-semibold text-ink">{formatKm(km)}</dd>
                </div>
              ) : null}
              {order.etaMinutes ? (
                <div>
                  <dt className="text-caption text-ink-muted">Est. delivery</dt>
                  <dd className="text-body font-semibold text-ink">{order.etaMinutes} mins</dd>
                </div>
              ) : null}
            </dl>
          )}

          {order.deliveryPartner ? (
            <p className="mt-3 text-caption text-ink-muted">
              Rider: {order.deliveryPartner.name}
              {order.deliveryPartner.phone ? ` · ${order.deliveryPartner.phone}` : ''}
            </p>
          ) : isDelivery ? (
            <p className="mt-3 text-caption text-ink-subtle">No rider assigned yet.</p>
          ) : null}
        </section>

        <section className="rounded-2xl bg-surface p-4 shadow-sm">
          <h2 className="mb-3 text-body font-semibold text-ink">Items</h2>
          <ul className="space-y-3">
            {order.lines.map((line) => (
              <li key={line.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-body text-ink">
                    <span className="tabular font-semibold text-brand">{line.quantity}×</span> {line.name}
                  </p>
                  {line.options.length ? (
                    <p className="text-caption text-ink-muted">
                      {line.options.map((option) => option.choiceName).join(', ')}
                    </p>
                  ) : null}
                  {line.notes ? (
                    <p className="text-caption text-warning-ink">Note: {line.notes}</p>
                  ) : null}
                </div>
                <span className="tabular shrink-0 text-caption text-ink-muted">
                  {formatMoney(line.lineTotal)}
                </span>
              </li>
            ))}
          </ul>

          {order.instructions ? (
            <p className="mt-3 rounded-xl border border-warning/30 bg-warning-soft px-2.5 py-2 text-caption text-warning-ink">
              {order.instructions}
            </p>
          ) : null}

          <div className="mt-3 space-y-1 border-t border-line pt-3">
            <PriceRow label="Items" paise={order.breakdown.itemsTotal} />
            {order.breakdown.packagingFee > 0 ? (
              <PriceRow label="Packaging" paise={order.breakdown.packagingFee} />
            ) : null}
            {order.breakdown.deliveryFee > 0 ? (
              <PriceRow label="Delivery" paise={order.breakdown.deliveryFee} />
            ) : null}
            {order.breakdown.discount > 0 ? (
              <PriceRow label="Discount" paise={order.breakdown.discount} negative />
            ) : null}
            {order.breakdown.taxTotal > 0 ? (
              <PriceRow label="Taxes" paise={order.breakdown.taxTotal} />
            ) : null}
            <PriceRow label="Total" paise={order.breakdown.grandTotal} emphasis />
          </div>
        </section>

        <OrderStatusActions order={order} layout="stack" />
      </div>
    </VendorScreen>
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <RequireAccess permission={PERMISSIONS.ORDER_READ_VENDOR}>
      <OrderDetailView id={params.id} />
    </RequireAccess>
  );
}
