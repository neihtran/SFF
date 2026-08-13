import { Module } from '@nestjs/common';
import { ServerMembersController } from './server-members.controller';
import { ServerMembersService } from './server-members.service';

@Module({
  controllers: [ServerMembersController],
  providers: [ServerMembersService]
})
export class ServerMembersModule {}
