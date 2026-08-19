import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpdateMessageDto {
  @ApiProperty({ example: 'Đã sửa nội dung' })
  @IsString()
  @MaxLength(4000)
  content!: string;
}