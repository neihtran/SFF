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
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { ServerMembersService } from './server-members.service';
import { UpdateRoleDto } from './dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ServerRoleGuard } from '@/common/guards/server-role.guard';
import { RequireServerRole } from '@/common/decorators/require-server-role.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('server-members')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('servers/:serverId/members')
export class ServerMembersController {
  constructor(private readonly membersService: ServerMembersService) {}

  @Get()
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('MEMBER', false)
  @ApiOperation({ summary: 'Lấy danh sách thành viên server' })
  @ApiResponse({ status: 200, description: 'Mảng thành viên' })
  findAll(@Param('serverId') serverId: string) {
    return this.membersService.getMembers(serverId);
  }

  @Put(':userId/role')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('OWNER')
  @ApiOperation({ summary: 'Đổi role thành viên (chỉ Owner)' })
  @ApiParam({ name: 'userId', description: 'ID người bị đổi role' })
  @ApiResponse({ status: 200, description: 'Role đã được cập nhật' })
  @ApiResponse({ status: 400, description: 'Không thể đổi role của Owner' })
  updateRole(
    @Param('serverId') serverId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.membersService.updateRole(serverId, userId, dto);
  }

  @Post(':userId/kick')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('MODERATOR')
  @ApiOperation({ summary: 'Kick thành viên (MODERATOR trở lên)' })
  @ApiResponse({ status: 204, description: 'Đã kick thành công' })
  @ApiResponse({
    status: 403,
    description: 'Không thể kick người có role cao hơn',
  })
  async kick(
    @Param('serverId') serverId: string,
    @Param('userId') userId: string,
    @CurrentUser('id') requesterId: string,
  ) {
    await this.membersService.kick(serverId, userId, requesterId);
  }

  @Post(':userId/ban')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('MODERATOR')
  @ApiOperation({ summary: 'Cấm thành viên (MODERATOR trở lên)' })
  @ApiResponse({ status: 200, description: 'Đã cấm thành viên' })
  ban(
    @Param('serverId') serverId: string,
    @Param('userId') userId: string,
    @CurrentUser('id') requesterId: string,
  ) {
    return this.membersService.ban(serverId, userId, requesterId);
  }

  @Post(':userId/unban')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('MODERATOR')
  @ApiOperation({ summary: 'Bỏ cấm thành viên (MODERATOR trở lên)' })
  @ApiResponse({ status: 200, description: 'Đã bỏ cấm' })
  unban(@Param('serverId') serverId: string, @Param('userId') userId: string) {
    return this.membersService.unban(serverId, userId);
  }
}
