import type { ExecutionContext } from '@nestjs/common';

/**
 * `@SkipThrottle()` only skips the limiter named `default`. Named auth/checkout/
 * webhook limiters still run unless they are listed here too.
 */
export const SKIP_ALL_THROTTLERS = {
  default: true,
  auth: true,
  checkout: true,
  webhook: true,
} as const;

/**
 * NestJS Throttler applies every named limiter in `forRoot` to every route.
 *
 * Auth and checkout must stay as separate Redis keys so browsing the catalog
 * cannot exhaust the login budget, but they must not run on unrelated routes.
 * `@Throttle({ auth: { limit, ttl } })` writes `THROTTLER:LIMIT` + name onto
 * the handler; we skip the named limiter unless that decorator is present.
 */
export function skipUnlessNamedThrottle(name: string) {
  return (context: ExecutionContext): boolean => {
    const key = `THROTTLER:LIMIT${name}`;
    const handler = context.getHandler();
    const classRef = context.getClass();
    return (
      Reflect.getMetadata(key, handler) === undefined &&
      Reflect.getMetadata(key, classRef) === undefined
    );
  };
}
