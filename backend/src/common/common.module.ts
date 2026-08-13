import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ServerRoleGuard } from './guards/server-role.guard';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [ServerRoleGuard],
  exports: [ServerRoleGuard],
})
export class CommonModule {}
