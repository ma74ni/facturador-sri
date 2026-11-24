import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateExpenseAccountDto } from './create-expense-account.dto';

/** Lo que no llega no se toca. `isActive: false` la saca de las compras nuevas sin borrarla. */
export class UpdateExpenseAccountDto extends PartialType(CreateExpenseAccountDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
