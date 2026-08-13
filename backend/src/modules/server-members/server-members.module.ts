import { Module } from '@nestjs/common';

import { ServerMembersController } from './server-members.controller';
import { ServerMembersService } from './server-members.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [ServerMembersController],
  providers: [ServerMembersService],
  exports: [ServerMembersService],
})
export class ServerMembersModule {}
