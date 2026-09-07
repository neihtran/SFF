import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface TransformResponse<T> {
  data: T;
}

/**
 * TransformResponseInterceptor — unwrap NestJS response wrapper.
 * NestJS mặc định bọc kết quả trong { data: ... } khi trả về object.
 * Interceptor này giữ nguyên nếu đã là response thuần (không wrap 2 lần).
 */
@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, T | TransformResponse<T>>
{
  intercept(context: ExecutionContext, next: CallHandler): Observable<T | TransformResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // Nếu response đã có dạng { data: ... } thì giữ nguyên (tránh double-wrap)
        if (data && typeof data === 'object' && 'data' in data) {
          return data;
        }
        return data;
      }),
    );
  }
}
