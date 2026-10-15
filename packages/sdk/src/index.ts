import { ApiClient, type ApiClientConfig } from './client';
import { accountResource } from './resources/account';
import { adminResource } from './resources/admin';
import { authResource } from './resources/auth';
import { checkoutResource } from './resources/checkout';
import { deliveryResource } from './resources/delivery';
import { discoveryResource } from './resources/discovery';
import { vendorResource } from './resources/vendor';

export { ApiClient } from './client';
export type { ApiClientConfig, RequestOptions } from './client';
export { ApiError, isApiError, errorMessage } from './errors';
export * from './contracts';
export {
  createRealtimeClient,
  WS_EVENTS,
  type RealtimeClient,
  type RealtimeConfig,
  type RealtimeStatus,
  type WsEvent,
} from './realtime';
export {
  createPushClient,
  type FirebaseWebConfig,
  type PushClient,
  type PushClientOptions,
  type PushOutcome,
} from './push';

export type Api = ReturnType<typeof createApi>;

/**
 * Builds the API surface for one app.
 *
 * Every portal creates exactly one of these at module scope and imports it everywhere,
 * so there is a single place that knows the base URL, the portal identity, the tenant
 * headers and how a session is refreshed.
 */
export function createApi(config: ApiClientConfig) {
  const client = new ApiClient(config);

  return {
    client,
    auth: authResource(client),
    discovery: discoveryResource(client),
    checkout: checkoutResource(client),
    account: accountResource(client),
    vendor: vendorResource(client),
    delivery: deliveryResource(client),
    admin: adminResource(client),
  };
}
