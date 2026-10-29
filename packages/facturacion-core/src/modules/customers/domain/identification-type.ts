/**
 * Tipo de identificación del comprador, con el código de la tabla 6 de la ficha técnica del SRI.
 * Es lo único que se guarda en `Customer.identificationType` y lo que va al XML.
 */
export const IDENTIFICATION_TYPE = {
  RUC: '04',
  CEDULA: '05',
  PASAPORTE: '06',
  CONSUMIDOR_FINAL: '07',
  IDENTIFICACION_EXTERIOR: '08',
} as const;

export type IdentificationTypeCode = (typeof IDENTIFICATION_TYPE)[keyof typeof IDENTIFICATION_TYPE];

export const IDENTIFICATION_TYPE_CODES: readonly IdentificationTypeCode[] =
  Object.values(IDENTIFICATION_TYPE);

/**
 * El código SRI de un tipo de identificación. Acepta el código o el nombre (`CEDULA`, `RUC`…)
 * que la web guardaba antes; devuelve `null` si no es ninguno de los dos.
 */
export function toIdentificationTypeCode(value: unknown): IdentificationTypeCode | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if ((IDENTIFICATION_TYPE_CODES as readonly string[]).includes(normalized)) {
    return normalized as IdentificationTypeCode;
  }
  return IDENTIFICATION_TYPE[normalized as keyof typeof IDENTIFICATION_TYPE] ?? null;
}

/**
 * `tipoIdentificacionComprador` del XML. Un valor que no se reconoce va como consumidor final,
 * como siempre hizo la factura.
 */
export function buyerIdentificationTypeForSri(value: unknown): IdentificationTypeCode {
  return toIdentificationTypeCode(value) ?? IDENTIFICATION_TYPE.CONSUMIDOR_FINAL;
}

/** Tipo de una identificación que llega sin tipo (export del SRI): por su largo. */
export function inferIdentificationType(identification: string): IdentificationTypeCode {
  if (identification.length === 13) return IDENTIFICATION_TYPE.RUC;
  if (identification.length === 10) return IDENTIFICATION_TYPE.CEDULA;
  return IDENTIFICATION_TYPE.PASAPORTE; // Pasaporte / otro
}
