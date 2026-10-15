import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import { ERROR_CODES, type ApiErrorBody, type ErrorCode } from '@ck/types';
import type { Response } from 'express';
import { Error as MongooseError, mongo } from 'mongoose';
import { CONFIG, type AppConfig } from '@/config';
import { AppException } from '../exceptions/app.exception';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Single exit point for every failure. Clients get a stable code and a message
 * safe to display; stack traces, driver errors and internal identifiers are
 * logged server-side and never serialised into the response.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<AuthenticatedRequest>();

    const { status, code, message, details } = this.translate(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        {
          requestId: request.requestId,
          method: request.method,
          path: request.originalUrl,
          userId: request.user?.id,
          err: exception,
        },
        `Unhandled failure: ${message}`,
      );
    } else if (status === HttpStatus.FORBIDDEN || status === HttpStatus.UNAUTHORIZED) {
      // Authorization failures are security signal - keep them queryable.
      this.logger.warn(
        {
          requestId: request.requestId,
          method: request.method,
          path: request.originalUrl,
          userId: request.user?.id,
          ip: request.ip,
          code,
        },
        'Access denied',
      );
    }

    const body: ApiErrorBody = {
      success: false,
      error: {
        code,
        message:
          status >= HttpStatus.INTERNAL_SERVER_ERROR && this.config.isProduction
            ? 'Something went wrong. Please try again.'
            : message,
        ...(details ? { details } : {}),
        requestId: request.requestId,
      },
    };

    response.status(status).json(body);
  }

  private translate(exception: unknown): {
    status: number;
    code: ErrorCode;
    message: string;
    details?: Record<string, string[]>;
  } {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ?? exception.message);
      return {
        status,
        code: this.statusToCode(status),
        message: Array.isArray(message) ? message.join(' ') : message,
      };
    }

    // Duplicate key: report the conflict without echoing the indexed value back.
    if (exception instanceof mongo.MongoServerError && exception.code === 11000) {
      const field = Object.keys((exception.keyPattern ?? {}) as Record<string, unknown>)[0];
      return {
        status: HttpStatus.CONFLICT,
        code: ERROR_CODES.CONFLICT,
        message: field
          ? `A record with this ${field} already exists.`
          : 'This record already exists.',
      };
    }

    if (exception instanceof MongooseError.ValidationError) {
      const details: Record<string, string[]> = {};
      for (const [path, error] of Object.entries(exception.errors)) {
        details[path] = [error.message];
      }
      return {
        status: HttpStatus.BAD_REQUEST,
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Some fields are invalid.',
        details,
      };
    }

    if (exception instanceof MongooseError.CastError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: ERROR_CODES.VALIDATION_FAILED,
        message: `Invalid value for ${exception.path}.`,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ERROR_CODES.INTERNAL,
      message: exception instanceof Error ? exception.message : 'Unexpected error',
    };
  }

  private statusToCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ERROR_CODES.VALIDATION_FAILED;
      case HttpStatus.UNAUTHORIZED:
        return ERROR_CODES.UNAUTHENTICATED;
      case HttpStatus.FORBIDDEN:
        return ERROR_CODES.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ERROR_CODES.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ERROR_CODES.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ERROR_CODES.RATE_LIMITED;
      default:
        return ERROR_CODES.INTERNAL;
    }
  }
}
