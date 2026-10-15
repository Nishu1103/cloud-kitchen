import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../types/authenticated-request';

const REQUEST_ID_HEADER = 'x-request-id';
/** Accept an upstream id only if it looks like one; never echo arbitrary input. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: AuthenticatedRequest, response: Response, next: NextFunction): void {
    const incoming = request.headers[REQUEST_ID_HEADER];
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
    request.requestId = candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
    response.setHeader(REQUEST_ID_HEADER, request.requestId);
    next();
  }
}
