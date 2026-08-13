import { Module } from '@nestjs/common';

import { ServerMembersController } from './server-members.controller';
import { ServerMembersService } from './server-members.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { ServerRoleGuard } from '@/common/guards/server-role.guard';

@Module({
  imports: [PrismaModule],
  controllers: [ServerMembersController],
  providers: [ServerMembersService, ServerRoleGuard],
  exports: [ServerMembersService],
})
export class ServerMembersModule {}
