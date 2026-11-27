import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Los roles que se ofrecen: Administrador, Usuario y Contador (solo lectura). */
export const ASSIGNABLE_ROLES = ['ADMIN', 'USER', 'VIEWER'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class InviteUserDto {
  @ApiProperty({ example: 'Lucía' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Falta el nombre' })
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Falta el apellido' })
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: 'contadora@example.com' })
  // Igual que el registro y el login: se guarda como se escribió (sin espacios).
  @Transform(trim)
  @IsEmail({}, { message: 'Email inválido' })
  @MaxLength(254)
  email: string;

  @ApiProperty({ enum: ASSIGNABLE_ROLES })
  @IsIn(ASSIGNABLE_ROLES, { message: 'Rol no válido' })
  role: AssignableRole;
}

export class UpdateCompanyUserDto {
  @ApiPropertyOptional({ enum: ASSIGNABLE_ROLES })
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES, { message: 'Rol no válido' })
  role?: AssignableRole;

  @ApiPropertyOptional({ description: 'false desactiva el usuario (no se borra su historial)' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
