import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

import { ServerRole } from '@prisma/client';

export class UpdateRoleDto {
  @ApiProperty({
    enum: ['MODERATOR', 'MEMBER'],
    description: 'Role mới (không thể set OWNER qua API này)',
  })
  @IsEnum(['MODERATOR', 'MEMBER'] as const)
  @IsNotEmpty()
  role!: 'MODERATOR' | 'MEMBER';
}
