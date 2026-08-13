import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Tên hiển thị' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'a@example.com',
    description: 'Email duy nhất trong hệ thống',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: 'StrongPass123!',
    description: 'Mật khẩu (≥8 ký tự)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({
    example: 'vi',
    required: false,
    description: 'Ngôn ngữ ưu tiên (ISO 639-1)',
  })
  @IsString()
  @IsOptional()
  preferredLang?: string;
}
