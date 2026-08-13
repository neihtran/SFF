import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ServerRoleGuard } from './guards/server-role.guard';

@Module({
  imports: [PrismaModule],
  providers: [JwtAuthGuard, ServerRoleGuard],
  exports: [JwtAuthGuard, ServerRoleGuard, PrismaModule],
})
export class CommonModule {}
