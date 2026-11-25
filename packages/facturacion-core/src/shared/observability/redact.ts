/**
 * Los logs salen a un servicio externo: no deben llevar datos personales de los clientes de
 * nuestros clientes. `maskEmail` deja ver lo justo para soporte ("j***@gmail.com") y
 * `redactPersonalData` es la red de seguridad del logger: tapa cualquier email que se cuele.
 */
const EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '(sin email)';
  return email.replace(EMAIL, '$1***@$2');
}

export function redactPersonalData(text: string): string {
  return text.replace(EMAIL, '$1***@$2');
}
