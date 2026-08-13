import { Module } from '@nestjs/common';

import { ServersController } from './servers.controller';
import { ServersService } from './servers.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [ServersController],
  providers: [ServersService],
  exports: [ServersService],
})
export class ServersModule {}
