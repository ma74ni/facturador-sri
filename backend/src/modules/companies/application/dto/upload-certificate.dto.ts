import { IsString, IsNotEmpty, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadCertificateDto {
  @ApiProperty({ 
    type: 'string', 
    format: 'binary',
    description: 'Archivo .p12 del certificado digital'
  })
  file: any;

  @ApiProperty({ example: 'Mi_Password_Seguro123' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ 
    example: '2025-12-31', 
    description: 'Fecha de expiración del certificado (YYYY-MM-DD)',
    required: false 
  })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;
}