import type { SessionUser } from '@ck/types';
import type { ApiClient } from '../client';
import type {
  AuthSession,
  LoginPayload,
  RegisterPayload,
  SessionSummary,
} from '../contracts';

/**
 * Session lifecycle.
 *
 * Tokens are never handled here: the API sets httpOnly cookies, so signing in is a
 * side effect on the cookie jar and `me()` is the only way to read who is signed in.
 */
export function authResource(client: ApiClient) {
  return {
    async login(payload: LoginPayload): Promise<AuthSession> {
      // The portal is a property of the app, not of the form, and the API binds the
      // session to it so a delivery login cannot be replayed against the admin portal.
      const session = await client.post<AuthSession>(
        '/auth/login',
        { ...payload, portal: payload.portal ?? client.portal },
        { skipAuthRetry: true },
      );
      client.resetSession();
      return session;
    },

    register(payload: RegisterPayload): Promise<{ userId: string; emailVerificationRequired: boolean }> {
      return client.post('/auth/register', payload, { skipAuthRetry: true });
    },

    /** Rarely called directly: the client refreshes automatically on a 401. */
    refresh(): Promise<void> {
      return client.post('/auth/refresh', undefined, { skipAuthRetry: true });
    },

    logout(): Promise<void> {
      return client.post('/auth/logout', undefined, { skipAuthRetry: true });
    },

    /** Revokes every session for the account, e.g. after a password change. */
    logoutAll(): Promise<void> {
      return client.post('/auth/logout-all', undefined, { skipAuthRetry: true });
    },

    me(): Promise<SessionUser> {
      return client.get('/auth/me');
    },

    sessions(): Promise<SessionSummary[]> {
      return client.get('/auth/sessions');
    },

    revokeSession(id: string): Promise<void> {
      return client.delete(`/auth/sessions/${id}`);
    },

    verifyEmail(token: string): Promise<void> {
      return client.post('/auth/verify-email', { token }, { skipAuthRetry: true });
    },

    forgotPassword(email: string, campusSlug: string): Promise<void> {
      return client.post('/auth/forgot-password', { email, campusSlug }, { skipAuthRetry: true });
    },

    resetPassword(token: string, password: string): Promise<void> {
      return client.post('/auth/reset-password', { token, password }, { skipAuthRetry: true });
    },

    changePassword(currentPassword: string, newPassword: string): Promise<void> {
      return client.post('/auth/change-password', { currentPassword, newPassword });
    },

    sendPhoneOtp(phone: string): Promise<{ sent: boolean; retryAfter?: number }> {
      return client.post('/auth/phone/send-otp', { phone });
    },

    verifyPhoneOtp(otp: string): Promise<{ verified: boolean }> {
      return client.post('/auth/phone/verify-otp', { otp });
    },
  };
}
