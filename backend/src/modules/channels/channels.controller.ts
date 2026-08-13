import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { ChannelResponseDto } from './dto/channel-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ServerRoleGuard } from '../../common/guards/server-role.guard';
import { RequireServerRole } from '../../common/decorators/require-server-role.decorator';

@ApiTags('channels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ServerRoleGuard)
@Controller('servers/:serverId/channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Post()
  @RequireServerRole('MODERATOR')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a channel (moderator+)' })
  @ApiResponse({ status: 201, type: ChannelResponseDto })
  async create(
    @Param('serverId') serverId: string,
    @Body() dto: CreateChannelDto,
  ): Promise<ChannelResponseDto> {
    return this.channelsService.create(serverId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all channels in a server' })
  @ApiResponse({ status: 200, type: [ChannelResponseDto] })
  async findByServer(
    @Param('serverId') serverId: string,
  ): Promise<ChannelResponseDto[]> {
    return this.channelsService.findByServer(serverId);
  }

  @Get(':channelId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a channel by ID' })
  @ApiResponse({ status: 200, type: ChannelResponseDto })
  async findOne(
    @Param('serverId') serverId: string,
    @Param('channelId') channelId: string,
  ): Promise<ChannelResponseDto> {
    return this.channelsService.findOne(channelId, serverId);
  }

  @Delete(':channelId')
  @RequireServerRole('MODERATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a channel (moderator+)' })
  @ApiResponse({ status: 204 })
  async delete(
    @Param('serverId') serverId: string,
    @Param('channelId') channelId: string,
  ): Promise<void> {
    await this.channelsService.delete(channelId, serverId);
  }
}
