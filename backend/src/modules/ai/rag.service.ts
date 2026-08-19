import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from './ai.service';
import { ChatGatewayService } from '../chat-gateway/chat-gateway.service';
import {
  RAG_CHUNK_SIZE,
  RAG_CHUNK_OVERLAP,
  RAG_TOP_K,
  SEMANTIC_SEARCH_TOP_K,
  CATCHUP_MAX_MESSAGES,
  EMBEDDING_DIMENSION,
} from '../../config/constants';

interface Chunk {
  text: string;
  startIndex: number;
  chunkIndex: number;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly gateway: ChatGatewayService,
  ) {}

  // ============================================================
  // TEXT CHUNKING
  // ============================================================
  /**
   * Chia văn bản thành các chunk ~RAG_CHUNK_SIZE ký tự.
   * - Ưu tiên cắt theo ranh giới đoạn văn (double newline hoặc paragraph)
   * - Có overlap nhẹ (RAG_CHUNK_OVERLAP) giữa các chunk liên tiếp
   * - Mỗi chunk có metadata: text, startIndex, chunkIndex
   */
  chunkText(text: string): Chunk[] {
    if (!text || text.trim().length === 0) return [];

    const chunks: Chunk[] = [];
    const TARGET = RAG_CHUNK_SIZE;
    const OVERLAP = RAG_CHUNK_OVERLAP;

    // Tách văn bản theo ranh giới đoạn văn
    // Double newline, hoặc dấu chấm câu lớn (?, !, .) + space
    const paragraphs = text.split(/(?<=\n\n|[.!?]\s)/).filter((p) => p.trim().length > 0);

    let currentChunk = '';
    let startIndex = 0;
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      // Nếu 1 đoạn văn quá lớn → cắt nhỏ theo câu
      if (paragraph.length > TARGET) {
        if (currentChunk.trim()) {
          chunks.push({ text: currentChunk.trim(), startIndex, chunkIndex });
          startIndex += currentChunk.length;
          chunkIndex++;
          // Overlap
          currentChunk = currentChunk.slice(-OVERLAP);
        }
        // Cắt đoạn lớn theo câu
        const sentences = paragraph.match(/[^.!?]+[.!?]\s*/g) ?? [paragraph];
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length <= TARGET) {
            currentChunk += sentence;
          } else {
            if (currentChunk.trim()) {
              chunks.push({ text: currentChunk.trim(), startIndex, chunkIndex });
              startIndex += currentChunk.length;
              chunkIndex++;
              currentChunk = currentChunk.slice(-OVERLAP);
            }
            currentChunk = sentence;
          }
        }
        continue;
      }

      if (currentChunk.length + paragraph.length <= TARGET) {
        currentChunk += paragraph;
      } else {
        if (currentChunk.trim()) {
          chunks.push({ text: currentChunk.trim(), startIndex, chunkIndex });
          startIndex += currentChunk.length;
          chunkIndex++;
          // Overlap: lấy cuối chunk trước làm đầu chunk mới
          currentChunk = currentChunk.slice(-OVERLAP) + paragraph;
        } else {
          currentChunk = paragraph;
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push({ text: currentChunk.trim(), startIndex, chunkIndex });
    }

    return chunks;
  }

  // ============================================================
  // SEMANTIC SEARCH
  // ============================================================
  /**
   * Tìm kiếm ngữ nghĩa trong messages của server.
   * - Sinh embedding cho query
   * - pgvector cosine distance (<=>) tìm top-k messages gần nhất
   * - Lọc: user phải có quyền xem channel (server member)
   * - channelId optional để thu hẹp phạm vi
   */
  async semanticSearchMessages(
    query: string,
    serverId: string,
    userId: string,
    channelId?: string,
  ) {
    // 1. Kiểm tra user có quyền trong server
    const member = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId } },
    });
    if (!member || member.status !== 'ACTIVE') {
      throw new ForbiddenException('You are not an active member of this server');
    }

    // 2. Sinh embedding query
    let queryVector: number[];
    try {
      queryVector = await this.ai.generateEmbedding(query);
    } catch (err) {
      this.logger.warn(`Embedding query failed: ${(err as Error).message}`);
      return [];
    }

    // 3. pgvector cosine distance: embedding <=> '[vec]'::vector(dim) — giá trị càng nhỏ = càng giống
    //    Lọc: chỉ messages thuộc server
    const serverVec = `[${queryVector.join(',')}]`;

    const results = await this.prisma.$queryRaw<
      Array<{
        id: string;
        content: string;
        created_at: Date;
        channel_id: string;
        channel_name: string | null;
        sender_id: string | null;
        sender_name: string | null;
        avatar_url: string | null;
        distance: number;
      }>
    >`SELECT
        m.id,
        m.content,
        m.created_at,
        c.id AS channel_id,
        c.name AS channel_name,
        u.id AS sender_id,
        u.name AS sender_name,
        u.avatar_url,
        m.embedding <=> ${serverVec}::vector(768) AS distance
      FROM messages m
      JOIN message_embeddings me ON m.id = me.message_id
      JOIN channels c ON m.channel_id = c.id
      JOIN servers s ON c.server_id = s.id
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE s.id = ${serverId}
        AND c.server_id = ${serverId}
        AND m.is_ai_reply = false
        ${channelId ? this.prisma.$queryRaw`AND c.id = ${channelId}` : this.prisma.$queryRaw``}
      ORDER BY m.embedding <=> ${serverVec}::vector(768)
      LIMIT ${SEMANTIC_SEARCH_TOP_K}`;

    return results.map((r) => ({
      id: r.id,
      content: r.content,
      createdAt: r.created_at,
      channelId: r.channel_id,
      channelName: r.channel_name,
      senderId: r.sender_id,
      senderName: r.sender_name,
      avatarUrl: r.avatar_url,
      similarity: 1 - r.distance, // cosine distance → similarity
    }));
  }

  // ============================================================
  // AI PERSONA — ingest document
  // ============================================================
  // AI PERSONA — CRUD documents
  // ============================================================
  async listDocuments(serverId: string) {
    return this.prisma.aiDocument.findMany({
      where: { serverId },
      select: {
        id: true,
        title: true,
        createdAt: true,
        uploadedById: true,
        _count: { select: { chunks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDocument(serverId: string, uploadedById: string, title: string, contentRaw: string) {
    const doc = await this.prisma.aiDocument.create({
      data: { serverId, uploadedById, title, contentRaw },
    });

    // Fire-and-forget: index document in background
    void this.indexDocument(doc.id);

    return doc;
  }

  async deleteDocument(serverId: string, documentId: string) {
    const doc = await this.prisma.aiDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.serverId !== serverId) throw new ForbiddenException('Document does not belong to this server');

    await this.prisma.aiDocument.delete({ where: { id: documentId } });
    return { id: documentId };
  }

  // ============================================================
  /**
   * Index 1 AiDocument: chunk text → sinh embedding cho từng chunk → lưu vào DB.
   * Chạy fire-and-forget, không block.
   */
  async indexDocument(documentId: string): Promise<void> {
    try {
      const doc = await this.prisma.aiDocument.findUnique({ where: { id: documentId } });
      if (!doc) {
        this.logger.warn(`Document ${documentId} not found for indexing`);
        return;
      }

      const chunks = this.chunkText(doc.contentRaw);
      if (chunks.length === 0) return;

      // Sinh embedding cho từng chunk (chunk có thể nhiều → gọi API nhiều lần)
      for (const chunk of chunks) {
        try {
          const vector = await this.ai.generateEmbedding(chunk.text);
          // DocumentEmbedding có embedding = Unsupported("vector(768)) nên phải dùng $executeRaw
          await this.prisma.$executeRaw`
            INSERT INTO document_embeddings (id, document_id, chunk_text, embedding, created_at)
            VALUES (gen_random_uuid(), ${documentId}, ${chunk.text}, ${`[${vector.join(',')}]`}::vector(768), NOW())`;
        } catch (chunkErr) {
          this.logger.warn(
            `Chunk embedding failed for doc ${documentId}: ${(chunkErr as Error).message}`,
          );
        }
      }
      this.logger.log(`Document ${documentId} indexed (${chunks.length} chunks)`);
    } catch (err) {
      this.logger.error(`IndexDocument failed: ${(err as Error).message}`);
    }
  }

  // ============================================================
  // AI PERSONA — ask
  // ============================================================
  /**
   * Trả lời câu hỏi bằng AI Persona của server.
   * - Tìm top-5 chunk liên quan qua pgvector
   * - Ghép ngữ cảnh → gọi Gemini với system prompt persona
   * - Lưu câu trả lời thành Message (senderId=null, isAiReply=true)
   * - Emit realtime
   */
  async askAiPersona(
    serverId: string,
    question: string,
    channelId: string,
    askedByUserId: string,
  ): Promise<void> {
    try {
      // 1. Kiểm tra server tồn tại
      const server = await this.prisma.server.findUnique({ where: { id: serverId } });
      if (!server) return;

      // 2. Sinh embedding câu hỏi
      let queryVector: number[];
      try {
        queryVector = await this.ai.generateEmbedding(question);
      } catch {
        return;
      }
      const vecStr = `[${queryVector.join(',')}]`;

      // 3. Tìm top-5 chunk liên quan trong server
      const chunks = await this.prisma.$queryRaw<
        Array<{ chunk_text: string; distance: number }>
      >`
        SELECT
          de.chunk_text,
          de.embedding <=> ${vecStr}::vector(768) AS distance
        FROM document_embeddings de
        JOIN ai_documents ad ON de.document_id = ad.id
        WHERE ad.server_id = ${serverId}
        ORDER BY de.embedding <=> ${vecStr}::vector(768)
        LIMIT ${RAG_TOP_K};
      `;

      if (chunks.length === 0) {
        // Không có tài liệu → phản hồi mặc định
        const noDocAnswer = 'Xin lỗi, hiện tại không có tài liệu nào được nạp cho server này. Vui lòng yêu cầu quản trị viên nạp tài liệu trước.';
        await this._saveAndEmitAiReply(channelId, server.name, noDocAnswer, askedByUserId);
        return;
      }

      // 4. Ghép ngữ cảnh
      const context = chunks
        .map((c, i) => `[Tài liệu ${i + 1}]\n${c.chunk_text}`)
        .join('\n\n');

      // 5. System prompt persona
      const systemPrompt = `Bạn là trợ lý AI của server "${server.name}". Bạn CHỈ được trả lời dựa trên ngữ cảnh (tài liệu) được cung cấp bên dưới. Nếu câu hỏi không liên quan đến ngữ cảnh, hãy nói rõ "Tôi không tìm thấy thông tin liên quan trong tài liệu của server này" thay vì bịa đặt. Ngữ cảnh:`;

      // 6. Gọi Gemini
      let answer: string;
      try {
        answer = await this.ai.generateChatCompletion(
          systemPrompt,
          `Ngữ cảnh:\n${context}\n\nCâu hỏi: ${question}`,
        );
      } catch (genErr) {
        this.logger.error(`AI persona generate failed: ${(genErr as Error).message}`);
        return;
      }

      // 7. Lưu + emit
      await this._saveAndEmitAiReply(channelId, server.name, answer, askedByUserId);
    } catch (err) {
      this.logger.error(`askAiPersona failed: ${(err as Error).message}`);
    }
  }

  // ============================================================
  // CATCH-UP SUMMARY
  // ============================================================
  /**
   * Tóm tắt các tin nhắn mới trong channel kể từ thời điểm `since`.
   */
  async   catchUpSummary(channelId: string, since: Date | undefined, targetLang = 'vi') {
    // Default: last 24 hours if no since provided
    const sinceDate = since != null && !isNaN(since.getTime()) ? since : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const messages = await this.prisma.message.findMany({
      where: {
        channelId,
        createdAt: { gt: sinceDate },
        isAiReply: false,
      },
      include: {
        sender: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: CATCHUP_MAX_MESSAGES,
    });

    if (messages.length === 0) {
      return {
        summary: 'Không có tin nhắn mới kể từ thời điểm này.',
        count: 0,
      };
    }

    const formatted = messages
      .map((m) => `${m.sender?.name ?? 'Unknown'}: ${m.content}`)
      .join('\n');

    const prompt = `Hãy tóm tắt các tin nhắn sau thành 3-5 dòng, nêu rõ chủ đề chính và các điểm quan trọng:\n\n${formatted}`;

    let summary: string;
    try {
      summary = await this.ai.generateChatCompletion(
        'Bạn là trợ lý tóm tắt tin nhắn. Tóm tắt ngắn gọn, rõ ràng, bằng tiếng Việt.',
        prompt,
      );
    } catch (err) {
      this.logger.error(`CatchUp summary failed: ${(err as Error).message}`);
      summary = 'Không thể tạo tóm tắt lúc này.';
    }

    return { summary, count: messages.length };
  }

  // ============================================================
  // TRANSLATION (cache)
  // ============================================================
  /**
   * Dịch tin nhắn sang ngôn ngữ đích.
   * - Kiểm tra cache trước
   * - Nếu chưa có → gọi Gemini → lưu cache → trả về
   */
  async translateMessage(
    messageId: string,
    targetLang: string,
  ): Promise<{ messageId: string; targetLang: string; translatedText: string; cached: boolean }> {
    if (!targetLang || typeof targetLang !== 'string' || !targetLang.trim()) {
      throw new BadRequestException('targetLang query param is required (e.g. ?targetLang=en)');
    }
    const normalized = targetLang.trim().toLowerCase();

    const existing = await this.prisma.messageTranslation.findUnique({
      where: { messageId_targetLang: { messageId, targetLang: normalized } },
    });

    if (existing) {
      return {
        messageId,
        targetLang: normalized,
        translatedText: existing.translatedText,
        cached: true,
      };
    }

    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');

    const translated = await this.ai.translateText(message.content, normalized);

    await this.prisma.messageTranslation.create({
      data: { messageId, targetLang: normalized, translatedText: translated },
    });

    return { messageId, targetLang: normalized, translatedText: translated, cached: false };
  }

  // ============================================================
  // helpers
  // ============================================================
  private async _saveAndEmitAiReply(
    channelId: string,
    serverName: string,
    answer: string,
    askedByUserId: string,
  ): Promise<void> {
    const msg = await this.prisma.message.create({
      data: {
        channelId,
        senderId: null,
        content: answer,
        isAiReply: true,
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        attachments: true,
        reactions: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    // Emit realtime cho mọi client trong channel
    this.gateway.emitMessageNew(channelId, {
      ...msg,
      sender: null,
      _aiServerName: serverName,
    });
  }
}
