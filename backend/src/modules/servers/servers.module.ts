import { Module } from '@nestjs/common';

import { ServersController } from './servers.controller';
import { ServersService } from './servers.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { ServerRoleGuard } from '@/common/guards/server-role.guard';

@Module({
  imports: [PrismaModule],
  controllers: [ServersController],
  providers: [ServersService, ServerRoleGuard],
  exports: [ServersService],
})
export class ServersModule {}
