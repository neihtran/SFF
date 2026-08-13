import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ServerRole } from '@prisma/client';

export class UpdateRoleDto {
  @ApiProperty({ enum: ['MODERATOR', 'MEMBER'], description: 'Cannot set to OWNER' })
  @IsEnum(['MODERATOR', 'MEMBER'] as const)
  role!: 'MODERATOR' | 'MEMBER';
}
