import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadLogoDto {
  @ApiProperty({ 
    type: 'string', 
    format: 'binary',
    description: 'Archivo de imagen (PNG, JPG, JPEG) máximo 2MB'
  })
  file: any;
}