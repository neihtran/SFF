import { ApiProperty } from '@nestjs/swagger';
import { ServerRole, MemberStatus } from '@prisma/client';

export class MemberResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  serverId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: ServerRole })
  role!: ServerRole;

  @ApiProperty({ enum: MemberStatus })
  status!: MemberStatus;

  @ApiProperty()
  joinedAt!: Date;

  user!: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}
