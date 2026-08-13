import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ServerRole } from '@prisma/client';

export class UpdateRoleDto {
  @ApiProperty({ enum: ['MODERATOR', 'MEMBER'], description: 'Cannot set to OWNER via this endpoint' })
  @IsEnum(['MODERATOR', 'MEMBER'] as const)
  role!: 'MODERATOR' | 'MEMBER';
}
