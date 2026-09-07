import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search users by name (for @mention autocomplete)' })
  @ApiOkResponse({ description: 'Array of users' })
  search(@Query('q') q = '') {
    return this.users.searchByName(q);
  }

  // ---------- PUT /users/me ----------
  @Put('me')
  @ApiOperation({ summary: 'Update current user profile (name + preferredLang)' })
  @ApiOkResponse({ description: 'Updated user profile' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user profile by id' })
  @ApiOkResponse({ description: 'User profile' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.findOne(id);
  }
}
