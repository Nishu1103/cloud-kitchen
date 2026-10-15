export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    /** Field-level validation messages, keyed by dotted field path. */
    details?: Record<string, string[]>;
    requestId?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
}

/** Stable machine-readable error codes. Clients switch on these, never on messages. */
export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  CSRF_FAILED: 'CSRF_FAILED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  WRONG_PORTAL: 'WRONG_PORTAL',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  VENDOR_CLOSED: 'VENDOR_CLOSED',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  COUPON_INVALID: 'COUPON_INVALID',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
