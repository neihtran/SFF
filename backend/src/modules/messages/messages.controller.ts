import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
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
import { MessagesService } from './messages.service';
import { ChatGatewayService } from '../chat-gateway/chat-gateway.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateMessageDto,
  UpdateMessageDto,
  CreateReactionDto,
  FindMessagesQueryDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('messages')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class MessagesController {
  constructor(
    private readonly messages: MessagesService,
    private readonly gateway: ChatGatewayService,
    private readonly prisma: PrismaService,
  ) {}

  // ---------- POST /channels/:channelId/messages ----------
  @Post('channels/:channelId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send a message to a channel (TEXT or DM). Requires being a server member or DM member.',
  })
  @ApiCreatedResponse({ description: 'Message created and broadcasted' })
  @ApiResponse({ status: 403, description: 'Not a member' })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  create(
    @Param('channelId', new ParseUUIDPipe()) channelId: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.messages.create(channelId, user.id, dto);
  }

  // ---------- GET /channels/:channelId/messages?cursor=&limit= ----------
  @Get('channels/:channelId/messages')
  @ApiOperation({
    summary: 'List messages in a channel (cursor pagination, oldest→newest)',
  })
  @ApiOkResponse({ description: '{ items: Message[], nextCursor: string|null }' })
  findByChannel(
    @Param('channelId', new ParseUUIDPipe()) channelId: string,
    @Query() query: FindMessagesQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    // Verify user có quyền xem (server member HOẶC DM member)
    return this._verifyCanRead(channelId, user.id).then(() =>
      this.messages.findByChannel(channelId, query.cursor, query.limit),
    );
  }

  // ---------- PUT /messages/:id ----------
  @Put('messages/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit your own message' })
  @ApiOkResponse({ description: 'Updated message' })
  @ApiResponse({ status: 403, description: 'Not your message' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMessageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.messages.update(id, user.id, dto.content);
  }

  // ---------- DELETE /messages/:id ----------
  @Delete('messages/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a message (your own, or MODERATOR+ of the channel\'s server)',
  })
  @ApiOkResponse({ description: '{ id }' })
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.messages.remove(id, user.id);
  }

  // ---------- POST /messages/:id/reactions ----------
  @Post('messages/:id/reactions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add (or no-op if already exists) a reaction' })
  @ApiCreatedResponse({ description: 'All reactions on this message' })
  addReaction(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateReactionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.messages.addReaction(id, user.id, dto.emoji);
  }

  // ---------- DELETE /messages/:id/reactions/:emoji ----------
  @Delete('messages/:id/reactions/:emoji')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a reaction' })
  @ApiOkResponse({ description: 'All reactions on this message' })
  removeReaction(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('emoji') emoji: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.messages.removeReaction(id, user.id, emoji);
  }

  // ============================================================
  // helper
  // ============================================================
  private async _verifyCanRead(channelId: string, userId: string): Promise<void> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { type: true, serverId: true },
    });
    if (!channel) {
      const { NotFoundException } = await import('@nestjs/common');
      throw new NotFoundException('Channel not found');
    }

    if (channel.type === 'DM' || !channel.serverId) {
      const m = await this.prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
      });
      if (!m) {
        const { ForbiddenException } = await import('@nestjs/common');
        throw new ForbiddenException('Not a member of this DM');
      }
      return;
    }

    const m = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId: channel.serverId, userId } },
    });
    if (!m || m.status !== 'ACTIVE') {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException('Not an active member of this server');
    }
  }
}