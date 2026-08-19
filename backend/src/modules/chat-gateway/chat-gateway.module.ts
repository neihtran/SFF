import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ChatGatewayController } from './chat-gateway.controller';
import { ChatGatewayService } from './chat-gateway.service';

@Module({
  imports: [ConfigModule, JwtModule.register({})],
  controllers: [ChatGatewayController],
  providers: [ChatGatewayService],
  exports: [ChatGatewayService],
})
export class ChatGatewayModule {}