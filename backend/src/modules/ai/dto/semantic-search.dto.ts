import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, MaxLength } from 'class-validator';

export class SemanticSearchDto {
  @ApiProperty({ example: 'kinh nghiệm học React' })
  @IsString()
  @MaxLength(500)
  query!: string;

  @ApiProperty({ example: 'uuid-of-server' })
  @IsUUID()
  serverId!: string;

  @ApiProperty({ required: false, example: 'uuid-of-channel (optional)' })
  @IsOptional()
  @IsUUID()
  channelId?: string;
}