/**
 * Tipos de identificación del comprador con su código SRI, que es lo que guarda la API.
 * Clientes antiguos pueden traer el nombre (CEDULA, RUC…): `toIdentificationTypeCode` lo traduce.
 */
export const IDENTIFICATION_TYPES = [
  { code: '05', label: 'Cédula' },
  { code: '04', label: 'RUC' },
  { code: '06', label: 'Pasaporte' },
  { code: '07', label: 'Consumidor final' },
  { code: '08', label: 'Identificación del exterior' },
] as const;

export type IdentificationTypeCode = (typeof IDENTIFICATION_TYPES)[number]['code'];

export const ID_TYPE = {
  RUC: '04',
  CEDULA: '05',
  PASAPORTE: '06',
  CONSUMIDOR_FINAL: '07',
  IDENTIFICACION_EXTERIOR: '08',
} as const satisfies Record<string, IdentificationTypeCode>;

export function toIdentificationTypeCode(value: string | null | undefined): IdentificationTypeCode | undefined {
  const normalized = (value ?? '').trim().toUpperCase();
  const byCode = IDENTIFICATION_TYPES.find((type) => type.code === normalized);
  if (byCode) return byCode.code;
  return ID_TYPE[normalized as keyof typeof ID_TYPE];
}

/** "Cédula", "RUC"…; si el valor no se reconoce, se muestra tal cual. */
export function identificationTypeLabel(value: string | null | undefined): string {
  const code = toIdentificationTypeCode(value);
  return IDENTIFICATION_TYPES.find((type) => type.code === code)?.label ?? (value || '');
}
