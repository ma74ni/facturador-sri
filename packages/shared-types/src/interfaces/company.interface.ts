import { SRIEnvironment } from '../enums/sri-environment.enum';

/**
 * Interface para Empresa
 * Representa una empresa emisora de comprobantes electrónicos
 */
export interface ICompany {
  /** ID único de la empresa */
  id: string;

  /** RUC de la empresa (único) */
  ruc: string;

  /** Razón social */
  businessName: string;

  /** Nombre comercial */
  tradeName?: string;

  /** Dirección */
  address: string;

  /** Teléfono */
  phone?: string;

  /** Email */
  email: string;

  /** Email para Reply-To */
  replyToEmail?: string;

  /** Ruta del logo en R2 */
  logoPath?: string;

  /** Ambiente del SRI (TEST o PRODUCTION) */
  environment: SRIEnvironment;

  /** Indica si la empresa está activa */
  isActive: boolean;

  /** Proveedor de email (SYSTEM, MAILJET, SMTP) */
  emailProvider: string;

  /** Indica si tiene certificado digital configurado */
  hasCertificate: boolean;

  /** Fecha de expiración del certificado */
  certificateExpiry?: Date;

  /** Fecha de creación */
  createdAt?: Date;

  /** Fecha de última actualización */
  updatedAt?: Date;
}
