import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsIn } from 'class-validator';
import { PRODUCT_MODULE_KEYS, ProductModuleKey } from '../../../companies/domain/product-modules.catalog';

export class UpdateCompanyModulesDto {
  @ApiProperty({ enum: PRODUCT_MODULE_KEYS, isArray: true, description: 'Módulos habilitados (reemplaza la lista actual).' })
  @IsArray()
  @ArrayUnique()
  @IsIn(PRODUCT_MODULE_KEYS, { each: true, message: 'Módulo desconocido' })
  modules: ProductModuleKey[];
}
