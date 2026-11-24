import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ImportExpenseAccountsDto {
  @ApiProperty({
    example: '5.1.01\tMateria prima\n5.2.03\tArriendo',
    description:
      'Una cuenta por línea: "código<TAB>nombre" (copiado de Excel), "código;nombre", "código nombre" o solo el nombre',
  })
  @IsString()
  @IsNotEmpty({ message: 'Pega al menos una cuenta' })
  @MaxLength(60000, { message: 'La lista es demasiado larga' })
  text: string;
}
