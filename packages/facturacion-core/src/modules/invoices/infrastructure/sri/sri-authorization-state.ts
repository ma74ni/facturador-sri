export type SriAuthorizationVerdict = 'AUTHORIZED' | 'REJECTED' | 'PENDING';

/**
 * Traduce el `estado` de autorizacionComprobante. El SRI responde
 * "NO AUTORIZADO" con espacio; cualquier otro valor ("EN PROCESO", sin
 * autorizaciones todavía) significa que aún no hay veredicto.
 */
export function classifyAuthorizationState(estado: string | undefined): SriAuthorizationVerdict {
  const normalized = (estado ?? '').toUpperCase().replace(/[\s_]+/g, ' ').trim();
  if (normalized === 'AUTORIZADO') return 'AUTHORIZED';
  if (['NO AUTORIZADO', 'RECHAZADA', 'RECHAZADO'].includes(normalized)) return 'REJECTED';
  return 'PENDING';
}

/**
 * Recepción devuelta porque el SRI ya tiene ese comprobante (un envío anterior
 * cuya autorización no alcanzamos a ver): hay que consultar, no reenviar.
 */
export function isAlreadyReceived(receptionMessage: string | undefined): boolean {
  return /CLAVE ACCESO REGISTRADA|EN PROCESAMIENTO/i.test(receptionMessage ?? '');
}
