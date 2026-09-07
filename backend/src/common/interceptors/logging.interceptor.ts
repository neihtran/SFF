import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const orange = '\x1b[33m';
const reset = '\x1b[0m';

/**
 * LoggingInterceptor — log mỗi request:
 *   [METHOD] /url — status 200 OK in 123ms
 *   [METHOD] /url — status 500 Internal Server Error in 45ms (error: ...)
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          this.logger.log(`${orange}[${method}]${reset} ${url} — ${res.statusCode} in ${ms}ms`);
        },
        error: (err: Error) => {
          const ms = Date.now() - start;
          this.logger.error(
            `${orange}[${method}]${reset} ${url} — ${res.statusCode ?? 500} in ${ms}ms (error: ${err.message})`,
          );
        },
      }),
    );
  }
}
