import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateOrderItemDto } from './create-order.dto';

export class AddItemDto extends CreateOrderItemDto {
  @ApiProperty({
    description: 'Si es un item incremental (añadido después del pago)',
    default: false,
    required: false,
  })
  esIncremental?: boolean;
}
