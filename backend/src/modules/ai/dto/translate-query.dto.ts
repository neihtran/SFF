import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TranslateQueryDto {
  @ApiProperty({
    example: 'en',
    description: 'Target language code (vi, en, ja, ko, zh, fr, de, es)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(10)
  targetLang!: string;
}
