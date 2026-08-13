import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;

  @ApiProperty()
  preferredLang!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;

  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;
}
