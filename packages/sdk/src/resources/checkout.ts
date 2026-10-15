import type { Order, PaginatedResult } from '@ck/types';
import type { ApiClient } from '../client';
import type {
  AddCartLinePayload,
  CartView,
  ConfirmPaymentPayload,
  OrderDetail,
  OrderListQuery,
  PaymentView,
  PlaceOrderPayload,
  PlaceOrderResult,
  UpdateCartLinePayload,
} from '../contracts';

/**
 * Cart, order placement and payment confirmation.
 *
 * Totals are never computed on the client: every mutation returns the server's
 * breakdown, produced by the same code path that charges the customer.
 */
export function checkoutResource(client: ApiClient) {
  return {
    cart(): Promise<CartView> {
      return client.get('/cart');
    },

    addLine(payload: AddCartLinePayload): Promise<CartView> {
      return client.post('/cart/lines', payload);
    },

    updateLine(lineId: string, payload: UpdateCartLinePayload): Promise<CartView> {
      return client.patch(`/cart/lines/${lineId}`, payload);
    },

    /** Omitting the code clears the applied coupon. */
    applyCoupon(code?: string): Promise<CartView> {
      return client.patch('/cart/coupon', { code });
    },

    setWalletPreference(applyWallet: boolean): Promise<CartView> {
      return client.patch('/cart/wallet', { applyWallet });
    },

    clearCart(): Promise<void> {
      return client.delete('/cart');
    },

    /**
     * Places the order.
     *
     * `idempotent: true` is what makes retrying after a timeout safe: the API returns
     * the original order for a repeated key rather than charging twice.
     */
    placeOrder(payload: PlaceOrderPayload): Promise<PlaceOrderResult> {
      return client.post('/orders', payload, { idempotent: true, timeoutMs: 30_000 });
    },

    orders(query?: OrderListQuery): Promise<PaginatedResult<Order>> {
      return client.get('/orders', { query });
    },

    order(id: string): Promise<OrderDetail> {
      return client.get(`/orders/${id}`);
    },

    cancelOrder(id: string, reason: string): Promise<OrderDetail> {
      return client.post(`/orders/${id}/cancel`, { reason });
    },

    /**
     * The handover code, fetched separately from the order itself.
     *
     * `code` is `null` once the order has closed, which is why this is not a field on
     * `OrderDetail`: it is only meaningful while a handover is still pending.
     */
    handoverCode(orderId: string): Promise<{ code: string | null; reason?: 'closed' }> {
      return client.get(`/orders/${orderId}/handover-code`);
    },

    /** Called after the gateway's checkout returns, before showing a success screen. */
    confirmPayment(payload: ConfirmPaymentPayload): Promise<PaymentView> {
      return client.post('/payments/confirm', payload, { timeoutMs: 30_000 });
    },

    paymentForOrder(orderId: string): Promise<PaymentView> {
      return client.get(`/payments/orders/${orderId}`);
    },
  };
}
