import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../types/authenticated-request';

const MAX_DEPTH = 12;

/**
 * Strips MongoDB operator syntax from anything user-supplied.
 *
 * Even with typed DTOs and a strict schema, a query string like
 * `?email[$ne]=x` arrives as a nested object and could reach a filter as an
 * operator. Removing `$`-prefixed and dotted keys at the edge means no query
 * builder anywhere downstream has to remember this.
 */
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, depth + 1));
  }

  const source = value as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor') {
      delete source[key];
      continue;
    }
    source[key] = sanitize(source[key], depth + 1);
  }
  return source;
}

@Injectable()
export class SanitizeMiddleware implements NestMiddleware {
  use(request: AuthenticatedRequest, _response: Response, next: NextFunction): void {
    if (request.body) sanitize(request.body);
    if (request.params) sanitize(request.params);
    // req.query is a getter on Express 5; mutate in place rather than reassigning.
    if (request.query) sanitize(request.query);
    next();
  }
}
