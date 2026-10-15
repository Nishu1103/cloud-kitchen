import { ERROR_CODES, type ApiErrorBody, type ErrorCode } from '@ck/types';

/**
 * Every non-2xx response becomes one of these.
 *
 * Callers switch on `code` (a stable contract) and never on `message` (copy that
 * product can reword) or on the HTTP status alone, which cannot distinguish
 * "coupon expired" from "vendor closed".
 */
export class ApiError extends Error {
  readonly code: ErrorCode | string;
  readonly status: number;
  readonly details?: Record<string, string[]>;
  readonly requestId?: string;

  constructor(init: {
    code: ErrorCode | string;
    message: string;
    status: number;
    details?: Record<string, string[]>;
    requestId?: string;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.code = init.code;
    this.status = init.status;
    this.details = init.details;
    this.requestId = init.requestId;
  }

  static fromBody(body: ApiErrorBody, status: number, requestId?: string): ApiError {
    return new ApiError({
      code: body.error.code,
      message: body.error.message,
      status,
      details: body.error.details,
      requestId: body.error.requestId ?? requestId,
    });
  }

  /** The request never reached the API (offline, DNS, TLS, timeout, CORS). */
  static network(message: string): ApiError {
    return new ApiError({ code: 'NETWORK_ERROR', message, status: 0 });
  }

  static timeout(): ApiError {
    return new ApiError({
      code: 'TIMEOUT',
      message: 'The request took too long. Check your connection and try again.',
      status: 0,
    });
  }

  get isAuthError(): boolean {
    return this.code === ERROR_CODES.UNAUTHENTICATED || this.status === 401;
  }

  get isOffline(): boolean {
    return this.status === 0;
  }

  /** First validation message for a field, for inline form errors. */
  fieldError(field: string): string | undefined {
    return this.details?.[field]?.[0];
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Copy shown to users when a request fails.
 *
 * Server messages are already human-readable, so they win; this map only covers the
 * codes where the client has more context than the server did (offline, expired
 * session) or where a generic message is safer than leaking internals.
 */
const FRIENDLY: Partial<Record<string, string>> = {
  NETWORK_ERROR: 'You appear to be offline. Check your connection and try again.',
  TIMEOUT: 'That took too long. Please try again.',
  [ERROR_CODES.UNAUTHENTICATED]: 'Please sign in again to continue.',
  [ERROR_CODES.FORBIDDEN]: 'You do not have access to this.',
  [ERROR_CODES.RATE_LIMITED]: 'Too many attempts. Please wait a moment and try again.',
  [ERROR_CODES.CSRF_FAILED]: 'Your session expired. Refresh the page and try again.',
  [ERROR_CODES.INTERNAL]: 'Something went wrong on our side. Please try again.',
};

export function errorMessage(error: unknown): string {
  if (isApiError(error)) {
    return FRIENDLY[error.code] ?? error.message ?? 'Something went wrong.';
  }
  return 'Something went wrong.';
}
