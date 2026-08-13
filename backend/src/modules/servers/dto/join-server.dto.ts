import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class JoinServerDto {
  @ApiProperty({ example: 'a1b2c3d4' })
  @IsString()
  inviteCode!: string;
}
