import { ApiProperty, IntersectionType, PickType } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { CreateReceivedDocumentDto } from './create-received-document.dto';

export class AccessKeyLookupDto {
  @ApiProperty({
    example: '2510202601179214673900120010020000456781234567812',
    description: 'Clave de acceso de 49 dígitos; se aceptan espacios y guiones al pegarla',
  })
  @IsString({ message: 'Pega la clave de acceso' })
  @MaxLength(80, { message: 'La clave de acceso tiene 49 dígitos' })
  accessKey: string;
}

/** Registrar desde el SRI: los montos y el número salen del XML; esto es lo que pone quien compra. */
export class RegisterFromAccessKeyDto extends IntersectionType(
  AccessKeyLookupDto,
  PickType(CreateReceivedDocumentDto, [
    'paymentMethodCode',
    'taxSupportCode',
    'expenseAccountId',
    'description',
  ] as const),
) {}
