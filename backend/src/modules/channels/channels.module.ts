import { Module } from '@nestjs/common';

import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { ServerRoleGuard } from '@/common/guards/server-role.guard';

@Module({
  imports: [PrismaModule],
  controllers: [ChannelsController],
  providers: [ChannelsService, ServerRoleGuard],
  exports: [ChannelsService],
})
export class ChannelsModule {}
