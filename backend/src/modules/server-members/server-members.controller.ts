import {
  Controller,
  Get,
  Put,
  Post,
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
} from '@nestjs/swagger';
import { ServerMembersService } from './server-members.service';
import { UpdateRoleDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ServerRoleGuard } from '../../common/guards/server-role.guard';
import { RequireServerRole } from '../../common/decorators/require-server-role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('server-members')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('servers/:serverId/members')
export class ServerMembersController {
  constructor(private readonly members: ServerMembersService) {}

  @Get()
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('OWNER', 'MODERATOR', 'MEMBER')
  @ApiOperation({ summary: 'List all active members of a server' })
  @ApiOkResponse({ description: 'Array of members' })
  getMembers(@Param('serverId', new ParseUUIDPipe()) serverId: string) {
    return this.members.getMembers(serverId);
  }

  @Put(':userId/role')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('OWNER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change a member role (owner only)' })
  @ApiResponse({ status: 403, description: 'Cannot change owner role / role level too high' })
  updateRole(
    @Param('serverId', new ParseUUIDPipe()) serverId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser('id') requesterId: string,
  ) {
    return this.members.updateRole(requesterId, serverId, userId, dto.role);
  }

  @Post(':userId/kick')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('OWNER', 'MODERATOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kick a member from the server (MODERATOR+ can kick MEMBERs)' })
  @ApiResponse({ status: 403, description: 'Cannot kick owner / cannot kick member with higher or equal role' })
  kick(
    @Param('serverId', new ParseUUIDPipe()) serverId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser('id') requesterId: string,
  ) {
    return this.members.kick(requesterId, serverId, userId);
  }

  @Post(':userId/ban')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('OWNER', 'MODERATOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ban a member (MODERATOR+)' })
  @ApiResponse({ status: 403, description: 'Cannot ban owner or member with higher role' })
  ban(
    @Param('serverId', new ParseUUIDPipe()) serverId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser('id') requesterId: string,
  ) {
    return this.members.ban(requesterId, serverId, userId);
  }

  @Post(':userId/unban')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('OWNER', 'MODERATOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unban a user (re-join as MEMBER) — MODERATOR+' })
  unban(
    @Param('serverId', new ParseUUIDPipe()) serverId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser('id') requesterId: string,
  ) {
    return this.members.unban(requesterId, serverId, userId);
  }
}
