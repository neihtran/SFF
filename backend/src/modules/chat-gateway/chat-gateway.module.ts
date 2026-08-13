import { Module } from '@nestjs/common';
import { ChatGatewayController } from './chat-gateway.controller';
import { ChatGatewayService } from './chat-gateway.service';

@Module({
  controllers: [ChatGatewayController],
  providers: [ChatGatewayService],
})
export class ChatGatewayModule {}
