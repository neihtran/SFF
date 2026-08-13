import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SemanticSearchQueryDto {
  @ApiProperty({ example: 'what is the server rule about spam?', description: 'Natural language search query' })
  @IsString()
  @IsNotEmpty()
  query!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Server UUID' })
  @IsUUID()
  serverId!: string;

  @ApiProperty({ required: false, example: '550e8400-e29b-41d4-a716-446655440001', description: 'Optional: limit to channel' })
  @IsUUID()
  @IsOptional()
  channelId?: string;
}
