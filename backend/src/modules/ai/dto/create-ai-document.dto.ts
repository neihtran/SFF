import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAiDocumentDto {
  @ApiProperty({ example: 'Hướng dẫn sử dụng project X' })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 'Nội dung tài liệu dài... (sẽ được chunk tự động)' })
  @IsString()
  contentRaw!: string;
}