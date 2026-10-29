import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const REQUIRED = 'Se requieren mailjetApiKey y mailjetSecretKey';
// La web manda "" cuando el campo opcional queda vacío.
const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class UpdateMailjetConfigDto {
  @ApiProperty()
  @IsString({ message: REQUIRED })
  @IsNotEmpty({ message: REQUIRED })
  @MaxLength(200)
  mailjetApiKey: string;

  @ApiProperty()
  @IsString({ message: REQUIRED })
  @IsNotEmpty({ message: REQUIRED })
  @MaxLength(200)
  mailjetSecretKey: string;

  @ApiProperty({ required: false, example: 'ventas@miempresa.com' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEmail({}, { message: 'El email remitente no es válido' })
  mailjetFromEmail?: string;

  @ApiProperty({ required: false, example: 'Mi Empresa S.A.' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  mailjetFromName?: string;
}
