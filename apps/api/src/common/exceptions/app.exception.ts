import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES, type ErrorCode } from '@ck/types';

/**
 * Every deliberate failure in the codebase throws this, so clients always get a
 * stable `error.code` to branch on instead of parsing prose.
 */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    readonly details?: Record<string, string[]>,
  ) {
    super({ code, message, details }, status);
  }

  static badRequest(code: ErrorCode, message: string, details?: Record<string, string[]>) {
    return new AppException(code, message, HttpStatus.BAD_REQUEST, details);
  }

  static unauthenticated(message = 'Authentication required.') {
    return new AppException(ERROR_CODES.UNAUTHENTICATED, message, HttpStatus.UNAUTHORIZED);
  }

  static forbidden(message = 'You do not have permission to perform this action.') {
    return new AppException(ERROR_CODES.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }

  static notFound(resource = 'Resource') {
    return new AppException(ERROR_CODES.NOT_FOUND, `${resource} not found.`, HttpStatus.NOT_FOUND);
  }

  static conflict(message: string, code: ErrorCode = ERROR_CODES.CONFLICT) {
    return new AppException(code, message, HttpStatus.CONFLICT);
  }

  static unprocessable(code: ErrorCode, message: string) {
    return new AppException(code, message, HttpStatus.UNPROCESSABLE_ENTITY);
  }

  static internal(message = 'Something went wrong.') {
    return new AppException(ERROR_CODES.INTERNAL, message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
