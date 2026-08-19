import { Module, forwardRef } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { RagService } from './rag.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ChatGatewayModule } from '../chat-gateway/chat-gateway.module';

@Module({
  imports: [PrismaModule, forwardRef(() => ChatGatewayModule)],
  controllers: [AiController],
  providers: [AiService, RagService],
  exports: [AiService, RagService],
})
export class AiModule {}
