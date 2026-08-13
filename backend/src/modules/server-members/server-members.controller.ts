import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { ServerMembersService } from './server-members.service';
import { UpdateRoleDto } from './dto/update-role.dto';
import { MemberResponseDto } from './dto/member-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ServerRoleGuard } from '../../common/guards/server-role.guard';
import { RequireServerRole } from '../../common/decorators/require-server-role.decorator';
import { CurrentUser } from '../../common/decorators';
import { ServerRequest } from '../../common/types/server-request.type';
import { ServerRole } from '@prisma/client';

@ApiTags('server-members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ServerRoleGuard)
@Controller('servers/:serverId/members')
export class ServerMembersController {
  constructor(private readonly membersService: ServerMembersService) {}

  @Get()
  @ApiOperation({ summary: 'List all members of a server' })
  @ApiResponse({ status: 200, type: [MemberResponseDto] })
  async findAll(
    @Param('serverId') serverId: string,
  ): Promise<MemberResponseDto[]> {
    return this.membersService.findAll(serverId);
  }

  @Put(':userId/role')
  @RequireServerRole('OWNER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change a member role (owner only)' })
  @ApiResponse({ status: 200, type: MemberResponseDto })
  async updateRole(
    @Param('serverId') serverId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: ServerRequest,
  ): Promise<MemberResponseDto> {
    const actorRole = req.serverMembership!.role;
    return this.membersService.updateRole(serverId, targetUserId, dto.role, actorRole);
  }

  @Post(':userId/kick')
  @RequireServerRole('MODERATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Kick a member from the server (moderator+)' })
  @ApiResponse({ status: 204 })
  async kick(
    @Param('serverId') serverId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser('id') actorId: string,
    @Req() req: ServerRequest,
  ): Promise<void> {
    const actorRole = req.serverMembership!.role;
    await this.membersService.kick(serverId, targetUserId, actorRole, actorId);
  }

  @Post(':userId/ban')
  @RequireServerRole('MODERATOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ban a member (moderator+)' })
  @ApiResponse({ status: 200, type: MemberResponseDto })
  async ban(
    @Param('serverId') serverId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser('id') actorId: string,
    @Req() req: ServerRequest,
  ): Promise<MemberResponseDto> {
    const actorRole = req.serverMembership!.role;
    return this.membersService.ban(serverId, targetUserId, actorRole, actorId);
  }

  @Post(':userId/unban')
  @RequireServerRole('MODERATOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unban a member (moderator+)' })
  @ApiResponse({ status: 200, type: MemberResponseDto })
  async unban(
    @Param('serverId') serverId: string,
    @Param('userId') targetUserId: string,
    @Req() req: ServerRequest,
  ): Promise<MemberResponseDto> {
    const actorRole = req.serverMembership!.role;
    return this.membersService.unban(serverId, targetUserId, actorRole);
  }
}
