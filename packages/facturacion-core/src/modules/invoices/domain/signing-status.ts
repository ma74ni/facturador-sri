/**
 * Firma de facturas y notas de crédito al crearlas: cuándo no tiene sentido
 * emitir y qué decirle al usuario cuando el comprobante queda sin firmar.
 */

export type SignatureStatus = 'firmado' | 'sin_certificado' | 'error_firma' | 'error_generacion';

interface CompanyCertificate {
  hasCertificate: boolean;
  certificateExpiry: Date | null;
  certificateValidFrom?: Date | null;
}

const format = (date: Date) => date.toLocaleDateString('es-EC', { timeZone: 'America/Guayaquil' });

/**
 * Con el certificado vencido el servicio de firma firma igual y el SRI lo
 * rechaza ("La fecha de firma no esta dentro del periodo de validez del
 * certificado firmante"), gastando un secuencial. Se corta antes de reservarlo.
 */
export function unusableCertificateReason(company: CompanyCertificate, now: Date = new Date()): string | null {
  if (!company.hasCertificate) return null; // sin certificado se permite el borrador
  if (company.certificateExpiry && now > company.certificateExpiry) {
    return `El certificado de firma electrónica venció el ${format(company.certificateExpiry)}. Sube el certificado renovado en Empresa para seguir emitiendo.`;
  }
  if (company.certificateValidFrom && now < company.certificateValidFrom) {
    return `El certificado de firma electrónica recién es válido desde el ${format(company.certificateValidFrom)}.`;
  }
  return null;
}

/** Aviso para el usuario cuando el comprobante quedó sin firmar, con el motivo real. */
export function signatureWarning(document: string, status: SignatureStatus, detail?: string): string | null {
  switch (status) {
    case 'firmado':
      return null;
    case 'sin_certificado':
      return `${document} quedó sin firmar: sube el certificado de firma electrónica en Empresa.`;
    case 'error_firma':
      return `${document} quedó sin firmar${detail ? `: ${detail}` : ''}.`;
    case 'error_generacion':
      return `${document} quedó sin firmar porque no se pudo generar el XML${detail ? `: ${detail}` : ''}.`;
  }
}
