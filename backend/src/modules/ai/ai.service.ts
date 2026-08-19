import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { GoogleGenAI, createUserContent, createPartFromText } from '@google/genai';
import { ConfigService } from '@nestjs/config';
import {
  GEMINI_EMBEDDING_MODEL,
  GEMINI_CHAT_MODEL,
  EMBEDDING_DIMENSION,
} from '../../config/constants';

/**
 * AiService — CHỈ gọi Gemini API.
 * Không chứa logic nghiệp vụ RAG, chunking, hay search.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly ai: GoogleGenAI;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.getOrThrow<string>('GEMINI_API_KEY');
    this.ai = new GoogleGenAI({ apiKey });
  }

  // ============================================================
  // generateEmbedding — gemini-embedding-001, 768 dim, L2-normalized
  // ============================================================
  /**
   * Sinh vector embedding cho 1 đoạn text.
   * - Model: gemini-embedding-001
   * - outputDimensionality: 768 (L2-normalize về độ dài 1 trước khi trả về)
   *
   * @returns number[] đã L2-normalize, độ dài EMBEDDING_DIMENSION
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.ai.models.embedContent({
        model: GEMINI_EMBEDDING_MODEL,
        contents: [text],
        config: {
          outputDimensionality: EMBEDDING_DIMENSION,
        },
      });

      const raw = response.embeddings?.[0]?.values;
      if (!raw || raw.length === 0) {
        throw new Error('Empty embedding returned');
      }

      // L2-normalize: chia mỗi phần tử cho norm = sqrt(sum(xi²))
      const norm = Math.sqrt(raw.reduce((sum, v) => sum + v * v, 0));
      if (norm === 0) return raw;

      return raw.map((v) => v / norm);
    } catch (err) {
      this.logger.error(`generateEmbedding failed: ${(err as Error).message}`);
      throw new InternalServerErrorException('Embedding generation failed');
    }
  }

  // ============================================================
  // generateChatCompletion
  // ============================================================
  /**
   * Gọi Gemini chat completion.
   * Dùng cho cả RAG answer, tóm tắt, dịch thuật.
   *
   * @param systemPrompt Hướng dẫn vai trò / ngữ cảnh cho AI
   * @param userPrompt   Câu hỏi / yêu cầu của user
   * @returns            Nội dung trả lời dạng text
   */
  async generateChatCompletion(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: GEMINI_CHAT_MODEL,
        contents: [
          createUserContent([
            createPartFromText(systemPrompt),
            createPartFromText(userPrompt),
          ]),
        ],
        config: {
          systemInstruction: createPartFromText(systemPrompt),
        },
      });

      const text = response.candidates?.[0]?.content?.parts
        ?.map((p) => ('text' in p ? p.text : ''))
        .join('')
        .trim();

      if (!text) {
        throw new Error('Empty response from Gemini');
      }
      return text;
    } catch (err) {
      this.logger.error(`generateChatCompletion failed: ${(err as Error).message}`);
      throw new InternalServerErrorException('AI response generation failed');
    }
  }

  // ============================================================
  // translateText
  // ============================================================
  /**
   * Dịch text sang ngôn ngữ đích, giữ nguyên ngữ điệu/ý nghĩa.
   * Dùng cùng model chat completion.
   */
  async translateText(text: string, targetLang: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: GEMINI_CHAT_MODEL,
        contents: [
          createUserContent([
            createPartFromText(
              `You are a professional translator. Translate the following text into ${targetLang}. Preserve the tone, style, and meaning exactly. Only output the translation, nothing else.`,
            ),
            createPartFromText(text),
          ]),
        ],
      });

      const translated = response.candidates?.[0]?.content?.parts
        ?.map((p) => ('text' in p ? p.text : ''))
        .join('')
        .trim();

      if (!translated) {
        throw new Error('Empty translation response');
      }
      return translated;
    } catch (err) {
      this.logger.error(`translateText failed: ${(err as Error).message}`);
      throw new InternalServerErrorException('Translation failed');
    }
  }
}
