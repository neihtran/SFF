import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import { ChannelType } from '@prisma/client';

export class CreateChannelDto {
  @ApiProperty({ example: 'general-chat' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: ['TEXT', 'VOICE'], default: 'TEXT' })
  @IsEnum(['TEXT', 'VOICE'] as const)
  type!: 'TEXT' | 'VOICE';
}
