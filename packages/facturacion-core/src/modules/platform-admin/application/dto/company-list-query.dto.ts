import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const COMPANY_LIST_FILTERS = ['PENDING', 'APPROVED', 'REJECTED', 'PRODUCTION'] as const;
export type CompanyListFilter = (typeof COMPANY_LIST_FILTERS)[number];

export class CompanyListQueryDto {
  @ApiPropertyOptional({
    enum: COMPANY_LIST_FILTERS,
    description: 'PENDING/APPROVED/REJECTED: aún en pruebas, por estado. PRODUCTION: ya emite comprobantes reales.',
  })
  @IsOptional()
  @IsIn(COMPANY_LIST_FILTERS)
  status?: CompanyListFilter;
}
