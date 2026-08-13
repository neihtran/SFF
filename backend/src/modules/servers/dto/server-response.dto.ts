import { ApiProperty } from '@nestjs/swagger';
import { Server } from '@prisma/client';

export class ServerResponseDto implements Pick<Server, 'id' | 'name' | 'iconUrl' | 'inviteCode' | 'createdAt'> {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  iconUrl!: string | null;

  @ApiProperty()
  inviteCode!: string;

  @ApiProperty()
  createdAt!: Date;
}
