import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class JoinServerDto {
  @ApiProperty({ example: 'abc12345' })
  @IsString()
  @IsNotEmpty()
  inviteCode!: string;
}
