import {
  Controller,
  Get,
  Post,
  Param,
  Query,
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
import { RagService } from './rag.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ServerRoleGuard } from '../../common/guards/server-role.guard';
import { RequireServerRole } from '../../common/decorators/require-server-role.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { SemanticSearchDto, CreateAiDocumentDto, CatchUpQueryDto, TranslateQueryDto } from './dto';

@ApiTags('AI')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class AiController {
  constructor(private readonly rag: RagService) {}

  // ---------- SEMANTIC SEARCH ----------
  @Get('search/semantic')
  @ApiOperation({
    summary: 'Semantic search across messages in a server (vector similarity)',
  })
  @ApiOkResponse({ description: 'Array of matching messages sorted by similarity' })
  @ApiResponse({ status: 403, description: 'Not a member of this server' })
  semanticSearch(@Query() dto: SemanticSearchDto, @CurrentUser() user: AuthUser) {
    return this.rag.semanticSearchMessages(dto.query, dto.serverId, user.id, dto.channelId);
  }

  // ---------- AI PERSONA — list documents ----------
  @Get('servers/:serverId/ai-documents')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('OWNER', 'MODERATOR', 'MEMBER')
  @ApiOperation({ summary: 'List AI documents uploaded to this server (any member)' })
  @ApiOkResponse({ description: 'Array of AI documents' })
  listDocuments(@Param('serverId', new ParseUUIDPipe()) serverId: string) {
    return this.rag.listDocuments(serverId);
  }

  // ---------- AI PERSONA — upload document ----------
  @Post('servers/:serverId/ai-documents')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('OWNER')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload an AI knowledge document (OWNER only)' })
  @ApiCreatedResponse({ description: 'Document created and queued for indexing' })
  @ApiResponse({ status: 403, description: 'Only OWNER can upload documents' })
  createDocument(
    @Param('serverId', new ParseUUIDPipe()) serverId: string,
    @Body() dto: CreateAiDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rag.createDocument(serverId, user.id, dto.title, dto.contentRaw);
  }

  // ---------- AI PERSONA — delete document ----------
  @Post('servers/:serverId/ai-documents/:documentId/delete')
  @UseGuards(ServerRoleGuard)
  @RequireServerRole('OWNER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an AI document (OWNER only)' })
  @ApiOkResponse({ description: 'Document deleted' })
  deleteDocument(
    @Param('serverId', new ParseUUIDPipe()) serverId: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ) {
    return this.rag.deleteDocument(serverId, documentId);
  }

  // ---------- CATCH-UP SUMMARY ----------
  @Get('channels/:channelId/catch-up')
  @ApiOperation({
    summary: 'Summarize missed messages in a channel since a given timestamp',
  })
  @ApiOkResponse({ description: '{ summary, count }' })
  @ApiResponse({ status: 400, description: 'No new messages' })
  catchUp(
    @Param('channelId', new ParseUUIDPipe()) channelId: string,
    @Query() query: CatchUpQueryDto,
  ) {
    const since = query.since ? new Date(query.since) : undefined;
    return this.rag.catchUpSummary(channelId, since);
  }

  // ---------- TRANSLATE ----------
  @Post('messages/:id/translate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Translate a message to a target language (cached)',
  })
  @ApiOkResponse({ description: '{ messageId, targetLang, translatedText, cached }' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  translate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: TranslateQueryDto,
  ) {
    return this.rag.translateMessage(id, query.targetLang);
  }
}