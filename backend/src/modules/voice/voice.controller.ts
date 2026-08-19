import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiResponse,
} from '@nestjs/swagger';
import { VoiceService } from './voice.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('voice')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('channels')
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  @Post(':id/voice-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get a LiveKit access token to join a voice channel',
    description:
      'Verifies user is an active member of the server containing this voice channel. ' +
      'Returns JWT token + LiveKit URL. Identity = userId, room = channelId.',
  })
  @ApiOkResponse({ description: '{ token: string, livekitUrl: string }' })
  @ApiResponse({ status: 403, description: 'Not a member / not a voice channel' })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  getVoiceToken(
    @Param('id', new ParseUUIDPipe()) channelId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.voice.generateVoiceToken(channelId, user.id);
  }

  @Get(':id/voice-participants')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List current participants in a voice channel (via LiveKit Server SDK)',
  })
  @ApiOkResponse({ description: '{ participants: string[] }' })
  @ApiResponse({ status: 403, description: 'Not a voice channel' })
  getParticipants(@Param('id', new ParseUUIDPipe()) channelId: string) {
    return this.voice.getRoomParticipants(channelId);
  }
}
