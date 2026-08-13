import {
  Controller,
  Post,
  Get,
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
import { ServersService } from './servers.service';
import { CreateServerDto, JoinServerDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ServerRoleGuard } from '../../common/guards/server-role.guard';
import { RequireServerRole } from '../../common/decorators/require-server-role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ServerRole } from '@prisma/client';

@ApiTags('servers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('servers')
export class ServersController {
  constructor(private readonly servers: ServersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new server (auto-joins as OWNER)' })
  @ApiCreatedResponse({ description: 'Server created' })
  create(@Body() dto: CreateServerDto, @CurrentUser('id') userId: string) {
    return this.servers.create(userId, dto.name, dto.iconUrl);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Get all servers the current user is a member of' })
  @ApiOkResponse({ description: 'List of servers' })
  findMine(@CurrentUser('id') userId: string) {
    return this.servers.findMine(userId);
  }

  @Get(':id')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('OWNER', 'MODERATOR', 'MEMBER')
  @ApiOperation({ summary: 'Get server details (any member)' })
  @ApiOkResponse({ description: 'Server object' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.servers.findOne(id);
  }

  @Post('join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join a server using invite code' })
  @ApiOkResponse({ description: 'Membership created' })
  @ApiResponse({ status: 404, description: 'Invalid invite code' })
  @ApiResponse({ status: 409, description: 'Already a member' })
  join(@Body() dto: JoinServerDto, @CurrentUser('id') userId: string) {
    return this.servers.join(userId, dto.inviteCode);
  }

  @Delete(':id/leave')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('OWNER', 'MODERATOR', 'MEMBER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave a server (owner cannot leave)' })
  @ApiResponse({ status: 400, description: 'Owner cannot leave' })
  leave(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.servers.leave(userId, id);
  }

  @Post(':id/invite-code/regenerate')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('OWNER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate invite code (owner only)' })
  @ApiOkResponse({ description: 'New invite code' })
  regenerateInviteCode(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.servers.regenerateInviteCode(userId, id);
  }
}
