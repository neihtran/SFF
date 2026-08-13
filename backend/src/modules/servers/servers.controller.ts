import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
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

import { ServersService } from './servers.service';
import { CreateServerDto } from './dto/create-server.dto';
import { JoinServerDto } from './dto/join-server.dto';
import { ServerResponseDto } from './dto/server-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ServerRoleGuard } from '../../common/guards/server-role.guard';
import { RequireServerRole } from '../../common/decorators/require-server-role.decorator';
import { CurrentUser } from '../../common/decorators';

@ApiTags('servers')
@ApiBearerAuth()
@Controller('servers')
export class ServersController {
  constructor(private readonly serversService: ServersService) {}

  // ─── Authenticated endpoints ───────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new server' })
  @ApiResponse({ status: 201, type: ServerResponseDto })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateServerDto,
  ): Promise<ServerResponseDto> {
    return this.serversService.create(userId, dto);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List all servers the current user is a member of' })
  @ApiResponse({ status: 200, type: [ServerResponseDto] })
  async findMine(
    @CurrentUser('id') userId: string,
  ): Promise<ServerResponseDto[]> {
    return this.serversService.findMine(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, ServerRoleGuard)
  @ApiOperation({ summary: 'Get a server by ID' })
  @ApiResponse({ status: 200, type: ServerResponseDto })
  @ApiResponse({ status: 403, description: 'Not a member' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id') serverId: string,
  ): Promise<ServerResponseDto> {
    return this.serversService.findOne(serverId, userId);
  }

  @Delete(':id/leave')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a server' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403, description: 'Owner cannot leave' })
  async leave(
    @CurrentUser('id') userId: string,
    @Param('id') serverId: string,
  ): Promise<void> {
    return this.serversService.leave(serverId, userId);
  }

  @Post(':id/invite-code/regenerate')
  @UseGuards(JwtAuthGuard, ServerRoleGuard)
  @RequireServerRole('OWNER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate invite code (owner only)' })
  @ApiResponse({ status: 200, description: '{ inviteCode: "NEWCODE" }' })
  async regenerateInviteCode(
    @Param('id') serverId: string,
    @CurrentUser('id') userId: string,
  ): Promise<{ inviteCode: string }> {
    return this.serversService.regenerateInviteCode(serverId, userId);
  }

  // ─── Public endpoints ───────────────────────────────────────

  @Post('join')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join a server using an invite code' })
  @ApiResponse({ status: 200, type: ServerResponseDto })
  @ApiResponse({ status: 404, description: 'Invalid invite code' })
  @ApiResponse({ status: 409, description: 'Already a member' })
  async join(
    @CurrentUser('id') userId: string,
    @Body() dto: JoinServerDto,
  ): Promise<ServerResponseDto> {
    return this.serversService.join(userId, dto.inviteCode);
  }
}
