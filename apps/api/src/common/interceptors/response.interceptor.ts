import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import type { ApiSuccess } from '@ck/types';
import { toApiShape } from '@/common/utils/serialize.util';

/**
 * Gives every successful response the same envelope as every error response, so
 * clients have one parsing path. Handlers return plain data and stay unaware of it.
 *
 * Document normalisation happens here too (`_id` to `id`, ObjectId and Date to string),
 * because most reads use `.lean()` and therefore never run the schema's own transform.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccess<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T>> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'success' in (data as object)) {
          return toApiShape(data) as unknown as ApiSuccess<T>;
        }
        return { success: true, data: toApiShape(data) } satisfies ApiSuccess<T>;
      }),
    );
  }
}
