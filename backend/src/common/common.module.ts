import { Module, Global } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { ServerRoleGuard } from './guards/server-role.guard';
import { AllExceptionsFilter } from './filters';
import {
  TransformResponseInterceptor,
  LoggingInterceptor,
} from './interceptors';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    ServerRoleGuard,
    // Bắt tất cả HTTP exceptions → format lỗi nhất quán
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Transform response (unwrap data wrapper nếu cần)
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
    // Log mỗi request: method, url, status, latency
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
  exports: [ServerRoleGuard],
})
export class CommonModule {}
