import { createApi } from '@ck/sdk';
import { PORTALS } from '@ck/types';
import { env } from './env';

/** Set when the session cannot be refreshed, so the redirect happens exactly once. */
let signOutHandler: (() => void) | undefined;

export function onSessionExpired(handler: () => void): void {
  signOutHandler = handler;
}

/**
 * The app's single API instance.
 *
 * Created at module scope so the refresh-token single-flight is shared by every caller;
 * one client per component would rotate the refresh token concurrently and the API,
 * which treats reuse as theft, would revoke the session mid-service.
 */
export const api = createApi({
  baseUrl: env.apiUrl,
  portal: PORTALS.VENDOR,
  getCampusSlug: () => env.campusSlug,
  onUnauthenticated: () => signOutHandler?.(),
});
