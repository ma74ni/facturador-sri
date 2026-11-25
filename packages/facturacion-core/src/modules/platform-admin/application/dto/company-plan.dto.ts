import { ApiProperty } from '@nestjs/swagger';
import { CompanyPlan } from '@prisma/client';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { PLAN_KEYS } from '../../../plans/domain/plan.catalog';

/** Plan de una empresa y, si hace falta, límites propios (A medida o un acuerdo puntual). */
export class SetCompanyPlanDto {
  @ApiProperty({
    enum: PLAN_KEYS,
    nullable: true,
    description: 'null quita el plan (sin límites).',
  })
  @ValidateIf((_, value) => value !== null)
  @IsIn(PLAN_KEYS, { message: 'Plan desconocido' })
  plan: CompanyPlan | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Comprobantes por mes; null usa el del plan.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  documentLimitOverride?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  userLimitOverride?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  emissionPointLimitOverride?: number | null;
}

/** Comprobantes extra de este mes, para cobrarlos después. */
export class GrantExtraDocumentsDto {
  @ApiProperty({ example: 50 })
  @IsInt()
  @Min(1)
  @Max(100_000)
  documents: number;

  @ApiProperty({ required: false, example: 'Pagará en la factura de diciembre' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
