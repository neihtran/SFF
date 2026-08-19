import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsDateString } from 'class-validator';

export class CatchUpQueryDto {
  @ApiProperty({ example: '2026-08-16T00:00:00.000Z', description: 'ISO timestamp', required: false })
  @IsDateString()
  @IsOptional()
  since?: string;
}

export class TranslateQueryDto {
  @ApiProperty({ example: 'en' })
  @IsString()
  targetLang!: string;
}