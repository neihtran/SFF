import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ChatGatewayService } from './chat-gateway.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [ConfigModule, JwtModule.register({}), PrismaModule],
  providers: [ChatGatewayService],
  exports: [ChatGatewayService],
})
export class ChatGatewayModule {}
