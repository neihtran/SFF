import { ApiProperty } from '@nestjs/swagger';
import { ChannelType } from '@prisma/client';

export class ChannelResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  serverId!: string | null;

  @ApiProperty({ nullable: true })
  name!: string | null;

  @ApiProperty({ enum: ChannelType })
  type!: ChannelType;

  @ApiProperty()
  createdAt!: Date;
}
