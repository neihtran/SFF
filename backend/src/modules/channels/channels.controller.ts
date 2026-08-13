import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ServerRoleGuard } from '@/common/guards/server-role.guard';
import { RequireServerRole } from '@/common/decorators/require-server-role.decorator';

@ApiTags('channels')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  // ── Create channel inside a server ──────────────────────────

  @Post('servers/:id/channels')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('MODERATOR')
  @ApiOperation({ summary: 'Tạo channel trong server (MODERATOR trở lên)' })
  @ApiParam({ name: 'id', description: 'Server ID' })
  @ApiResponse({ status: 201, description: 'Channel được tạo' })
  create(@Param('id') serverId: string, @Body() dto: CreateChannelDto) {
    return this.channelsService.create(serverId, dto);
  }

  // ── List channels in a server ───────────────────────────────

  @Get('servers/:id/channels')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('MEMBER', false)
  @ApiOperation({ summary: 'Danh sách channel trong server (mọi thành viên)' })
  @ApiParam({ name: 'id', description: 'Server ID' })
  @ApiResponse({ status: 200, description: 'Mảng channel' })
  findByServer(@Param('id') serverId: string) {
    return this.channelsService.findByServer(serverId);
  }

  // ── Delete a channel ──────────────────────────────────────

  @Delete('servers/:id/channels/:channelId')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('MODERATOR')
  @ApiOperation({ summary: 'Xoá channel (MODERATOR trở lên trong server)' })
  @ApiParam({ name: 'id', description: 'Server ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({ status: 204, description: 'Channel đã xoá' })
  @ApiResponse({ status: 403, description: 'Không đủ quyền' })
  @ApiResponse({ status: 404, description: 'Channel không tồn tại' })
  async delete(
    @Param('id') serverId: string,
    @Param('channelId') channelId: string,
  ) {
    await this.channelsService.delete(serverId, channelId);
  }
}
