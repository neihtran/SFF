import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ChannelType } from '@prisma/client';

export class CreateChannelDto {
  @ApiProperty({ example: 'general' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: ['TEXT', 'VOICE'], default: 'TEXT' })
  @IsEnum(['TEXT', 'VOICE'] as const)
  type!: 'TEXT' | 'VOICE';
}
