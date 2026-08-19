import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsArray, IsUrl } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ example: 'Xin chào mọi người!' })
  @IsString()
  @MaxLength(4000)
  content!: string;

  @ApiProperty({
    type: [String],
    required: false,
    description: 'Public URLs returned from /storage/message-attachments',
    example: ['https://xxx.supabase.co/storage/v1/object/public/message-attachments/user1/abc.png'],
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  attachmentUrls?: string[];
}