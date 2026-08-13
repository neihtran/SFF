import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class JoinServerDto {
  @ApiProperty({ example: 'AbCdEfGh' })
  @IsString()
  inviteCode!: string;
}
