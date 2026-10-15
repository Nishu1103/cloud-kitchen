import { env } from './env';

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: 'INR';
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string }) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (payload: unknown) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/**
 * Loads the gateway's checkout script on demand.
 *
 * Not in the document head: it is a third-party script that most sessions never need
 * (wallet and cash orders skip it entirely), and it is the single largest thing the
 * checkout could pull in.
 */
function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Checkout is only available in the browser.'));
      return;
    }
    if (window.Razorpay) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Checkout failed to load.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Checkout failed to load. Check your connection.'));
    document.head.appendChild(script);
  });
}

export type CheckoutResult =
  | { status: 'paid'; providerPaymentId: string }
  | { status: 'dismissed' }
  | { status: 'failed'; reason: string };

/**
 * Opens the hosted checkout and resolves once the customer finishes or dismisses it.
 *
 * The returned payment id is only a claim by the browser. It is handed to the API,
 * which verifies the charge with the provider before releasing the order — the client
 * is never trusted to declare a payment successful.
 */
export async function openCheckout(input: {
  publicKey: string;
  providerOrderId: string;
  amountPaise: number;
  orderCode: string;
  customer: { name: string; email: string; phone?: string };
}): Promise<CheckoutResult> {
  await loadScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) return { status: 'failed', reason: 'Checkout is unavailable right now.' };

  return new Promise<CheckoutResult>((resolve) => {
    let settled = false;
    const finish = (result: CheckoutResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const instance = new Razorpay({
      key: input.publicKey,
      order_id: input.providerOrderId,
      amount: input.amountPaise,
      currency: 'INR',
      name: env.appName,
      description: `Order ${input.orderCode}`,
      prefill: {
        name: input.customer.name,
        email: input.customer.email,
        contact: input.customer.phone,
      },
      handler: (response) => finish({ status: 'paid', providerPaymentId: response.razorpay_payment_id }),
      // Dismissal is a normal outcome, not an error: the order stays awaiting payment
      // and the customer can retry from the order screen.
      modal: { ondismiss: () => finish({ status: 'dismissed' }) },
    });

    instance.on('payment.failed', (payload) => {
      const description =
        (payload as { error?: { description?: string } })?.error?.description ??
        'The payment did not go through.';
      finish({ status: 'failed', reason: description });
    });

    instance.open();
  });
}
