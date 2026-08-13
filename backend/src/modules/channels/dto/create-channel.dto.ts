import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateChannelDto {
  @ApiProperty({ example: 'general' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: ['TEXT', 'VOICE'], default: 'TEXT' })
  @IsEnum(['TEXT', 'VOICE'] as const)
  @IsNotEmpty()
  type!: 'TEXT' | 'VOICE';
}
