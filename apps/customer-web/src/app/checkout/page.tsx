'use client';

import { errorMessage } from '@ck/sdk';
import { ORDER_TYPE, PAYMENT_METHOD, formatMoney, type OrderType, type PaymentMethod } from '@ck/types';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  PriceRow,
  RadioGroup,
  Section,
  SkeletonText,
  Tab,
  TabList,
  Tabs,
  toast,
} from '@ck/ui';
import { MapPin, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AddressDialog } from '@/components/address-dialog';
import { RequireAuth } from '@/components/require-auth';
import { useAddresses } from '@/hooks/use-account';
import { useCart } from '@/hooks/use-cart';
import { useConfirmPayment, usePlaceOrder } from '@/hooks/use-orders';
import { openCheckout } from '@/lib/razorpay';
import { useSession } from '@/lib/session';

const PAYMENT_LABELS: { value: PaymentMethod; label: string; hint: string }[] = [
  { value: PAYMENT_METHOD.UPI, label: 'UPI', hint: 'GPay, PhonePe, Paytm and any UPI app' },
  { value: PAYMENT_METHOD.CARD, label: 'Card', hint: 'Debit or credit' },
  { value: PAYMENT_METHOD.WALLET, label: 'Campus wallet', hint: 'Pay from your balance' },
  { value: PAYMENT_METHOD.CASH_ON_DELIVERY, label: 'Cash', hint: 'Pay the rider on handover' },
];

function CheckoutForm() {
  const router = useRouter();
  const { user } = useSession();
  const { data, isLoading } = useCart();
  const addresses = useAddresses();
  const placeOrder = usePlaceOrder();
  const confirmPayment = useConfirmPayment();

  const [type, setType] = useState<OrderType>(ORDER_TYPE.DELIVERY);
  const [addressId, setAddressId] = useState<string>('');
  const [method, setMethod] = useState<PaymentMethod>(PAYMENT_METHOD.UPI);
  const [instructions, setInstructions] = useState('');
  const [addressOpen, setAddressOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const cart = data;
  const breakdown = data?.breakdown;

  const defaultAddressId = useMemo(() => {
    const list = addresses.data ?? [];
    return list.find((address) => address.isDefault)?.id ?? list[0]?.id ?? '';
  }, [addresses.data]);

  const chosenAddress = addressId || defaultAddressId;
  const needsAddress = type === ORDER_TYPE.DELIVERY;

  if (isLoading) {
    return (
      <Card className="p-4">
        <SkeletonText lines={6} />
      </Card>
    );
  }

  if (!cart || cart.lines.length === 0 || !breakdown) {
    return (
      <EmptyState
        icon={<ShoppingBag aria-hidden className="h-6 w-6" />}
        title="Nothing to check out"
        description="Add something to your cart first."
        action={
          <Button asChild>
            <Link href="/kitchens">Browse kitchens</Link>
          </Button>
        }
      />
    );
  }

  const submit = async () => {
    if (needsAddress && !chosenAddress) {
      toast.error('Choose where this should be delivered.');
      return;
    }

    setPending(true);
    try {
      const result = await placeOrder.mutateAsync({
        vendorId: cart.vendorId!,
        lines: cart.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          choiceIds: line.options.map((option) => option.choiceId),
          notes: line.notes,
        })),
        type,
        paymentMethod: method,
        addressId: needsAddress ? chosenAddress : undefined,
        couponCode: cart.couponCode,
        applyWallet: (breakdown.walletApplied ?? 0) > 0 || method === PAYMENT_METHOD.WALLET,
        instructions: instructions.trim() || undefined,
      });

      // Wallet and cash orders come back settled and need no gateway round trip.
      if (result.payment.settled) {
        router.replace(`/orders/${result.orderId}?placed=1`);
        return;
      }

      if (!result.payment.publicKey || !result.payment.providerOrderId) {
        // The order exists and is awaiting payment; the order screen offers a retry.
        router.replace(`/orders/${result.orderId}?awaiting=1`);
        return;
      }

      const checkout = await openCheckout({
        publicKey: result.payment.publicKey,
        providerOrderId: result.payment.providerOrderId,
        amountPaise: result.payment.amount,
        orderCode: result.code,
        customer: { name: user!.name, email: user!.email, phone: user!.phone },
      });

      if (checkout.status === 'paid') {
        await confirmPayment.mutateAsync({
          paymentId: result.payment.paymentId,
          providerPaymentId: checkout.providerPaymentId,
        });
        router.replace(`/orders/${result.orderId}?placed=1`);
        return;
      }

      // Dismissed or failed: the order is already placed and awaiting payment, so send
      // them to it rather than silently dropping the order they just created.
      toast.message(
        checkout.status === 'failed'
          ? checkout.reason
          : 'Payment was not completed. You can pay from your order.',
      );
      router.replace(`/orders/${result.orderId}?awaiting=1`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem] lg:items-start">
      <div className="space-y-4">
        <Card>
          <CardHeader title="How do you want it?" />
          <CardBody>
            <Tabs value={type} onValueChange={(value) => setType(value as OrderType)}>
              <TabList scrollable={false}>
                <Tab value={ORDER_TYPE.DELIVERY}>Deliver to me</Tab>
                <Tab value={ORDER_TYPE.PICKUP}>I will pick up</Tab>
              </TabList>
            </Tabs>
          </CardBody>
        </Card>

        {needsAddress ? (
          <Card>
            <CardHeader
              title="Delivery address"
              action={
                <Button variant="secondary" size="sm" onClick={() => setAddressOpen(true)}>
                  Add new
                </Button>
              }
            />
            <CardBody>
              {addresses.isLoading ? (
                <SkeletonText lines={3} />
              ) : (addresses.data?.length ?? 0) === 0 ? (
                <Alert tone="info" title="No saved address">
                  Add your hostel and room so the rider can find you.
                </Alert>
              ) : (
                <RadioGroup
                  value={chosenAddress}
                  onValueChange={setAddressId}
                  options={(addresses.data ?? []).map((address) => ({
                    value: address.id ?? '',
                    label: address.label,
                    hint: [address.hostel, address.roomNumber, address.landmark]
                      .filter(Boolean)
                      .join(' · '),
                  }))}
                />
              )}
            </CardBody>
          </Card>
        ) : (
          <Alert tone="info" title="Pickup from the kitchen">
            You will get a code to show at the counter when your order is ready.
          </Alert>
        )}

        <Card>
          <CardHeader title="Payment" />
          <CardBody>
            <RadioGroup
              value={method}
              onValueChange={(value) => setMethod(value as PaymentMethod)}
              options={PAYMENT_LABELS.filter(
                // Cash is a delivery-only option; a pickup order is paid up front.
                (option) =>
                  option.value !== PAYMENT_METHOD.CASH_ON_DELIVERY || type === ORDER_TYPE.DELIVERY,
              ).map((option) => ({
                value: option.value,
                label: option.label,
                hint: option.hint,
              }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Anything else?" description="Optional note for the kitchen or rider." />
          <CardBody>
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              rows={2}
              maxLength={200}
              placeholder="Call when you reach the gate…"
              className="w-full rounded border border-line-strong bg-surface p-2 text-body placeholder:text-ink-subtle"
            />
          </CardBody>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-20">
        <CardHeader title={cart.vendorName ?? 'Your order'} description={`${cart.lines.length} items`} />
        <CardBody>
          <PriceRow label="Items" paise={breakdown.itemsTotal} />
          {breakdown.packagingFee > 0 ? (
            <PriceRow label="Packaging" paise={breakdown.packagingFee} />
          ) : null}
          {breakdown.deliveryFee > 0 ? (
            <PriceRow label="Delivery" paise={breakdown.deliveryFee} />
          ) : null}
          {breakdown.taxTotal > 0 ? <PriceRow label="Taxes" paise={breakdown.taxTotal} /> : null}
          {breakdown.discount > 0 ? (
            <PriceRow label="Discount" paise={breakdown.discount} negative />
          ) : null}
          {breakdown.walletApplied > 0 ? (
            <PriceRow label="Wallet" paise={breakdown.walletApplied} negative />
          ) : null}
          <div className="mt-2 border-t border-line pt-2">
            <PriceRow
              label={method === PAYMENT_METHOD.CASH_ON_DELIVERY ? 'Pay on delivery' : 'Pay now'}
              paise={breakdown.payableNow}
              emphasis
            />
          </div>

          <Button block className="mt-4" loading={pending} onClick={() => void submit()}>
            {method === PAYMENT_METHOD.CASH_ON_DELIVERY
              ? 'Place order'
              : `Pay ${formatMoney(breakdown.payableNow)}`}
          </Button>

          <p className="mt-2 text-center text-caption text-ink-subtle">
            <MapPin aria-hidden className="mr-1 inline h-3 w-3" />
            Prices are final. You can cancel until the kitchen accepts.
          </p>
        </CardBody>
      </Card>

      <AddressDialog open={addressOpen} onOpenChange={setAddressOpen} />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Checkout" />
      <RequireAuth message="Sign in to place your order.">
        <Section>
          <CheckoutForm />
        </Section>
      </RequireAuth>
    </div>
  );
}
