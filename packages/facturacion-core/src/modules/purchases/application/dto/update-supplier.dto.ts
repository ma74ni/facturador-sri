import { PartialType } from '@nestjs/swagger';
import { CreateSupplierDto } from './create-supplier.dto';

/** Lo que no llega no se toca. Tipo e identificación se validan juntos con lo que ya estaba. */
export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}
