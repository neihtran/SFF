import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { MAX_ATTACHMENT_SIZE_BYTES } from '../../config/constants';

export interface UploadResult {
  url: string;
  fileName: string;
  fileType: 'image' | 'file';
  size: number;
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);
const MESSAGE_BUCKET = 'message-attachments';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly supabase: SupabaseClient;
  private bucketEnsured = false;

  constructor(private readonly config: ConfigService) {
    const url = this.config.getOrThrow<string>('SUPABASE_URL');
    const key = this.config.getOrThrow<string>('SUPABASE_SERVICE_KEY');

    this.supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /**
   * Khi module khởi tạo, đảm bảo bucket `message-attachments` tồn tại
   * và đã được set public để các URL trả về truy cập trực tiếp được.
   * - Tạo nếu chưa có (public=true, file size limit 10 MB).
   * - Nếu đã có mà chưa public thì update.
   * - Lỗi không chặn boot — log warning để admin biết.
   */
  async onModuleInit(): Promise<void> {
    await this.ensurePublicBucket();
  }

  private async ensurePublicBucket(): Promise<void> {
    if (this.bucketEnsured) return;
    try {
      // 1) Check existing
      const { data: list, error: listErr } = await this.supabase.storage.listBuckets();
      if (listErr) {
        this.logger.warn(`Cannot list buckets: ${listErr.message}`);
        // Continue anyway — many Supabase deployments fail listBuckets due to
        // network/firewall but getObject/upload still work. Mark not-yet-ensured.
        return;
      }
      const existing = list?.find((b) => b.name === MESSAGE_BUCKET);
      if (existing) {
        if (!existing.public) {
          const { error: updErr } = await this.supabase.storage.updateBucket(MESSAGE_BUCKET, {
            public: true,
            fileSizeLimit: 10 * 1024 * 1024,
          });
          if (updErr) {
            this.logger.warn(`Cannot make bucket public: ${updErr.message}`);
          } else {
            this.logger.log(`Bucket ${MESSAGE_BUCKET} set to public`);
          }
        }
        this.bucketEnsured = true;
        return;
      }

      // 2) Create new bucket — public so getPublicUrl returns reachable URL
      const { error: createErr } = await this.supabase.storage.createBucket(MESSAGE_BUCKET, {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
      });
      if (createErr) {
        this.logger.warn(`Cannot create bucket ${MESSAGE_BUCKET}: ${createErr.message}`);
        return;
      }
      this.logger.log(`Bucket ${MESSAGE_BUCKET} created (public)`);
      this.bucketEnsured = true;
    } catch (err) {
      this.logger.warn(`ensurePublicBucket failed: ${(err as Error).message}`);
    }
  }

  /**
   * Upload 1 file (image hoặc file) lên Supabase Storage.
   * Trả về URL public + thông tin file để client hiển thị.
   * - Bucket phải được public; tự động đảm bảo ở onModuleInit.
   */
  async uploadMessageAttachment(
    file: Express.Multer.File,
    userId: string,
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new BadRequestException(
        `File too large (max ${MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024} MB)`,
      );
    }

    // Best-effort: chắc chắn bucket sẵn sàng (trường hợp module init bị lỗi)
    await this.ensurePublicBucket();

    const ext = (extname(file.originalname) || '').toLowerCase();
    const fileType: 'image' | 'file' = IMAGE_EXTS.has(ext) ? 'image' : 'file';

    // Đặt tên file: {userId}/{timestamp}-{random}.{ext}
    const safeName = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
    const path = `${userId}/${safeName}`;

    const { error } = await this.supabase.storage
      .from(MESSAGE_BUCKET)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Supabase upload failed: ${error.message}`);
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }

    const { data: pub } = this.supabase.storage
      .from(MESSAGE_BUCKET)
      .getPublicUrl(path);

    return {
      url: pub.publicUrl,
      fileName: file.originalname,
      fileType,
      size: file.size,
    };
  }
}