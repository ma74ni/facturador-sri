import {
  IDENTIFICATION_TYPE,
  IdentificationTypeCode,
} from '../../customers/domain/identification-type';
import { identificationError } from '../../customers/domain/ecuador-identification';

/**
 * Tipos de identificación de un proveedor (tabla 6 del SRI). Sin consumidor final (07): una compra
 * se declara a nombre de alguien identificado.
 */
export const SUPPLIER_IDENTIFICATION_TYPES: readonly IdentificationTypeCode[] = [
  IDENTIFICATION_TYPE.RUC,
  IDENTIFICATION_TYPE.CEDULA,
  IDENTIFICATION_TYPE.PASAPORTE,
  IDENTIFICATION_TYPE.IDENTIFICACION_EXTERIOR,
];

/** Por qué no sirve la identificación de un proveedor, o `null` si sirve. */
export function supplierIdentificationError(type: string, identification: string): string | null {
  if (!(SUPPLIER_IDENTIFICATION_TYPES as readonly string[]).includes(type)) {
    return 'Tipo de identificación no válido';
  }
  return identificationError(type as IdentificationTypeCode, identification);
}
