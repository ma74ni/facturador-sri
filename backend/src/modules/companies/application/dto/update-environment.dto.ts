import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEnvironmentDto {
  @ApiProperty({ 
    enum: ['TEST', 'PRODUCTION'],
    example: 'TEST',
    description: 'Ambiente del SRI: TEST para pruebas, PRODUCTION para producción'
  })
  @IsEnum(['TEST', 'PRODUCTION'])
  @IsNotEmpty()
  environment: 'TEST' | 'PRODUCTION';
}