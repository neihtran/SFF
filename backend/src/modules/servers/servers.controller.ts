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

import { ServersService } from './servers.service';
import { CreateServerDto, JoinServerDto } from './dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ServerRoleGuard } from '@/common/guards/server-role.guard';
import { RequireServerRole } from '@/common/decorators/require-server-role.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('servers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('servers')
export class ServersController {
  constructor(private readonly serversService: ServersService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo server mới (tự động làm Owner)' })
  @ApiResponse({
    status: 201,
    description: 'Server được tạo cùng ServerMember role=OWNER',
  })
  create(@Body() dto: CreateServerDto, @CurrentUser('id') userId: string) {
    return this.serversService.create(dto, userId);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Danh sách server user đang tham gia' })
  @ApiResponse({
    status: 200,
    description: 'Mảng server với thông tin thành viên',
  })
  findMine(@CurrentUser('id') userId: string) {
    return this.serversService.findMine(userId);
  }

  @Get(':id')
  @UseGuards(ServerRoleGuard)
  @ApiOperation({ summary: 'Chi tiết 1 server (cần là thành viên)' })
  @ApiParam({ name: 'id', description: 'Server ID' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin server + danh sách thành viên',
  })
  @ApiResponse({ status: 404, description: 'Server không tồn tại' })
  @ApiResponse({ status: 403, description: 'Không phải thành viên' })
  findOne(@Param('id') serverId: string) {
    return this.serversService.findOne(serverId);
  }

  @Post('join')
  @ApiOperation({ summary: 'Tham gia server bằng mã invite' })
  @ApiResponse({ status: 201, description: 'Tham gia thành công' })
  @ApiResponse({ status: 404, description: 'Mã invite không hợp lệ' })
  @ApiResponse({ status: 409, description: 'Đã là thành viên / bị cấm' })
  join(@Body() dto: JoinServerDto, @CurrentUser('id') userId: string) {
    return this.serversService.join(dto, userId);
  }

  @Delete(':id/leave')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('MEMBER')
  @ApiOperation({ summary: 'Rời server (Owner không thể rời)' })
  @ApiResponse({ status: 204, description: 'Rời thành công' })
  @ApiResponse({ status: 403, description: 'Owner không thể rời' })
  async leave(
    @Param('id') serverId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.serversService.leave(serverId, userId);
  }

  @Post(':id/invite-code/regenerate')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('OWNER')
  @ApiOperation({ summary: 'Đổi mã invite mới (chỉ Owner)' })
  @ApiResponse({ status: 200, description: 'Trả về mã invite mới' })
  regenerateInviteCode(
    @Param('id') serverId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.serversService.regenerateInviteCode(serverId, userId);
  }
}
