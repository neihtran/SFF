import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FindMessagesQueryDto {
  /**
   * Cursor (createdAt ISO string) của tin nhắn cuối cùng đang hiển thị.
   * Nếu bỏ trống → trả từ đầu (tin mới nhất).
   */
  @ApiProperty({ required: false, example: '2026-08-17T03:55:00.000Z' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiProperty({ required: false, default: 30, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}