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
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ServerRoleGuard } from '../../common/guards/server-role.guard';
import { RequireServerRole } from '../../common/decorators/require-server-role.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('channels')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Post('servers/:serverId/channels')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('OWNER', 'MODERATOR')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new channel (MODERATOR+)' })
  @ApiCreatedResponse({ description: 'Channel created' })
  create(
    @Param('serverId', new ParseUUIDPipe()) serverId: string,
    @Body() dto: CreateChannelDto,
  ) {
    return this.channels.create(serverId, dto.name, dto.type);
  }

  @Get('servers/:serverId/channels')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('OWNER', 'MODERATOR', 'MEMBER')
  @ApiOperation({ summary: 'List all channels in a server (any member)' })
  @ApiOkResponse({ description: 'Array of channels' })
  findByServer(@Param('serverId', new ParseUUIDPipe()) serverId: string) {
    return this.channels.findByServer(serverId);
  }

  @Delete('servers/:serverId/channels/:channelId')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('OWNER', 'MODERATOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a channel (MODERATOR+)' })
  @ApiOkResponse({ description: 'Channel deleted' })
  delete(
    @Param('serverId', new ParseUUIDPipe()) serverId: string,
    @Param('channelId', new ParseUUIDPipe()) channelId: string,
  ) {
    return this.channels.delete(channelId, serverId);
  }

  // ============================================================
  // DIRECT MESSAGE ENDPOINTS
  // ============================================================

  @Get('dm')
  @ApiOperation({ summary: 'List my DM channels (with last message preview)' })
  @ApiOkResponse({ description: 'Array of DM channels' })
  listMyDm(@CurrentUser() user: AuthUser) {
    return this.channels.listMyDmChannels(user.id);
  }

  @Post('dm/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get or create DM channel with the given user' })
  @ApiOkResponse({ description: 'DM channel object (with lastMessage if any)' })
  @ApiResponse({ status: 400, description: 'Cannot DM yourself' })
  @ApiResponse({ status: 404, description: 'User not found' })
  openDm(
    @CurrentUser() user: AuthUser,
    @Param('userId', new ParseUUIDPipe()) otherUserId: string,
  ) {
    return this.channels.getOrCreateDmChannel(user.id, otherUserId);
  }
}