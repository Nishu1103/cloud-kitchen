import type { ApiResponse, Portal } from '@ck/types';
import { ApiError } from './errors';

const CSRF_COOKIE = 'ck_csrf';
const CSRF_HEADER = 'x-csrf-token';
const CAMPUS_SLUG_HEADER = 'x-campus-slug';
const CAMPUS_ID_HEADER = 'x-campus-id';

const SAFE_METHODS = new Set(['GET', 'HEAD']);

export type QueryValue = string | number | boolean | undefined | null | (string | number)[];

/**
 * Typed as `object` rather than `Record<string, QueryValue>` because TypeScript only
 * gives implicit index signatures to type aliases, so interface-typed query objects
 * (which is how every resource declares its filters) would otherwise need a cast at
 * every call site.
 */
export type Query = object;

export interface RequestOptions {
  query?: Query;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /**
   * Sends an `Idempotency-Key`, reused across internal retries so a request that is
   * replayed after a refresh or a network blip cannot create two orders.
   */
  idempotent?: boolean;
  /** Skips the automatic refresh-and-retry (used by the auth calls themselves). */
  skipAuthRetry?: boolean;
  /** Number of network-failure retries. Defaults to 2 for GET, 0 otherwise. */
  retries?: number;
  /** Overrides the campus for this call (public pages rendering another campus). */
  campusSlug?: string;
}

export interface ApiClientConfig {
  /** Versioned API root, e.g. `https://api.campuskitchen.in/api/v1`. */
  baseUrl: string;
  /** Which portal this app is; sent with login and used for session binding. */
  portal: Portal;
  /** Resolves the active campus slug for anonymous, tenant-scoped requests. */
  getCampusSlug?: () => string | undefined;
  /** Super-admin impersonation of a campus; ignored unless the token allows it. */
  getCampusId?: () => string | undefined;
  /**
   * Called once when the session is unrecoverable (refresh itself failed), so the app
   * can clear its stores and route to sign-in exactly once instead of per request.
   */
  onUnauthenticated?: () => void;
  /** Injected for tests and for server components that pass a cookie-forwarding fetch. */
  fetch?: typeof fetch;
  defaultTimeoutMs?: number;
}

function buildQuery(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query as Record<string, QueryValue>)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      // Repeated keys rather than a comma-joined string: matches how the API's
      // ParseArrayPipe reads multi-value filters.
      for (const item of value) params.append(key, String(item));
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : undefined;
}

function newIdempotencyKey(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Older Safari (relevant for installed iOS PWAs) lacks randomUUID.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The single HTTP entry point for every portal.
 *
 * Responsibilities that must not be reimplemented per app: cookie credentials, the
 * double-submit CSRF header, tenant headers, the envelope unwrap, refresh-token
 * rotation with single-flight, idempotency for money-moving writes, timeouts, and
 * bounded retries for reads.
 */
export class ApiClient {
  private readonly config: ApiClientConfig;
  private readonly fetchImpl: typeof fetch;
  /** In-flight refresh shared by every 401'd request, so one rotation happens. */
  private refreshing: Promise<boolean> | null = null;
  private sessionDead = false;

  constructor(config: ApiClientConfig) {
    this.config = config;
    this.fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);
    if (!this.fetchImpl) {
      throw new Error('No fetch implementation available for ApiClient.');
    }
  }

  get baseUrl(): string {
    return this.config.baseUrl;
  }

  get portal(): Portal {
    return this.config.portal;
  }

  get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  post<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, { ...options, body });
  }

  patch<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  put<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PUT', path, { ...options, body });
  }

  delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  /** Marks the session live again after a successful sign-in. */
  resetSession(): void {
    this.sessionDead = false;
  }

  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const idempotencyKey = options.idempotent ? newIdempotencyKey() : undefined;
    const maxRetries = options.retries ?? (SAFE_METHODS.has(method) ? 2 : 0);

    let attempt = 0;
    let refreshed = false;

    for (;;) {
      try {
        return await this.send<T>(method, path, options, idempotencyKey);
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;

        // Expired access token: rotate once, then replay the original request.
        if (error.isAuthError && !options.skipAuthRetry && !refreshed && !this.sessionDead) {
          refreshed = true;
          const ok = await this.refreshSession();
          if (ok) continue;
          throw error;
        }

        // Retry only what is safe to repeat: transport failures and the server's own
        // "try again" statuses. A 4xx is a decision, not a hiccup.
        const retriable = error.isOffline || error.status === 502 || error.status === 503;
        if (retriable && attempt < maxRetries) {
          // Exponential backoff with jitter so a campus-wide reconnect does not
          // stampede the API in lockstep.
          const backoff = 250 * 2 ** attempt + Math.random() * 200;
          attempt += 1;
          await sleep(backoff);
          continue;
        }

        throw error;
      }
    }
  }

  private async send<T>(
    method: string,
    path: string,
    options: RequestOptions,
    idempotencyKey?: string,
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path.startsWith('/') ? path : `/${path}`}${buildQuery(options.query)}`;

    const headers: Record<string, string> = {
      accept: 'application/json',
      ...options.headers,
    };

    const hasBody = options.body !== undefined && options.body !== null;
    if (hasBody) headers['content-type'] = 'application/json';

    if (!SAFE_METHODS.has(method)) {
      const csrf = readCookie(CSRF_COOKIE);
      if (csrf) headers[CSRF_HEADER] = csrf;
    }
    if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;

    const campusSlug = options.campusSlug ?? this.config.getCampusSlug?.();
    if (campusSlug) headers[CAMPUS_SLUG_HEADER] = campusSlug;
    const campusId = this.config.getCampusId?.();
    if (campusId) headers[CAMPUS_ID_HEADER] = campusId;

    const timeoutMs = options.timeoutMs ?? this.config.defaultTimeoutMs ?? 15_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    // A caller-supplied signal (React Query cancellation, unmount) must still win.
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort, { once: true });

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        body: hasBody ? JSON.stringify(options.body) : undefined,
        // Cookie auth: tokens are httpOnly, so nothing reads or stores them in JS.
        credentials: 'include',
        signal: controller.signal,
        // Auth-bearing responses must never be reused from an HTTP cache.
        cache: 'no-store',
      });
    } catch (error) {
      const aborted = (error as Error)?.name === 'AbortError';
      throw aborted && !options.signal?.aborted
        ? ApiError.timeout()
        : ApiError.network((error as Error)?.message ?? 'Network request failed');
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }

    return this.parse<T>(response);
  }

  private async parse<T>(response: Response): Promise<T> {
    const requestId = response.headers.get('x-request-id') ?? undefined;

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : undefined;
    } catch {
      // A non-JSON body means a proxy or edge error page, not our API.
      throw new ApiError({
        code: 'BAD_RESPONSE',
        message: 'The server returned an unexpected response.',
        status: response.status,
        requestId,
      });
    }

    const body = payload as ApiResponse<T> | undefined;

    if (!response.ok || !body || body.success === false) {
      if (body && body.success === false) {
        throw ApiError.fromBody(body, response.status, requestId);
      }
      throw new ApiError({
        code: 'BAD_RESPONSE',
        message: `Request failed with status ${response.status}.`,
        status: response.status,
        requestId,
      });
    }

    return body.data;
  }

  /**
   * Rotates the refresh token. Concurrent callers share one attempt: the API detects
   * refresh-token reuse and revokes the whole session, so firing several rotations at
   * once would log the user out.
   */
  private refreshSession(): Promise<boolean> {
    if (this.refreshing) return this.refreshing;

    this.refreshing = (async () => {
      try {
        await this.send('POST', '/auth/refresh', { skipAuthRetry: true, retries: 0 });
        return true;
      } catch {
        this.sessionDead = true;
        this.config.onUnauthenticated?.();
        return false;
      } finally {
        this.refreshing = null;
      }
    })();

    return this.refreshing;
  }
}
