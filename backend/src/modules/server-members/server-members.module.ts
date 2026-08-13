import { Module } from '@nestjs/common';
import { ServerMembersController } from './server-members.controller';
import { ServerMembersService } from './server-members.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ServerMembersController],
  providers: [ServerMembersService],
  exports: [ServerMembersService],
})
export class ServerMembersModule {}
