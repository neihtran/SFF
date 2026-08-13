import { Module } from '@nestjs/common';

import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
