import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength, IsIn } from 'class-validator';

/**
 * DTO cho PUT /users/me
 * Theo Phần D spec — cho phép user cập nhật tên hiển thị + ngôn ngữ ưa thích.
 */
export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'Nguyen Van A', minLength: 2, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: 'vi',
    description: 'Mã ngôn ngữ ISO 639-1 (2 ký tự). Mặc định: vi',
    enum: ['vi', 'en', 'ja', 'ko', 'zh', 'fr', 'de', 'es'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['vi', 'en', 'ja', 'ko', 'zh', 'fr', 'de', 'es'])
  preferredLang?: string;
}
