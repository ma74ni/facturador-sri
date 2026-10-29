import { Decimal } from '@prisma/client/runtime/library';
import { StoredLineTax } from '../../modules/tax-codes/domain/services/tax-calculator.service';

type Amount = Decimal.Value;
type Text = string | null | undefined;

/** Lo que el RIDE necesita del emisor. */
export interface RideIssuer {
  id: string;
  ruc: Text;
  businessName: Text;
  tradeName?: Text;
  address?: Text;
  branchAddress?: Text;
  specialTaxpayer?: Text;
  accountingRequired?: boolean | null;
  logoPath?: Text;
}

/** Lo que el RIDE necesita del comprador. */
export interface RideCustomer {
  businessName?: Text;
  firstName?: Text;
  lastName?: Text;
  identificationType?: Text;
  identification?: Text;
  address?: Text;
  phone?: Text;
  email?: Text;
}

/** Una línea del detalle, con el IVA ya guardado en la emisión. */
export interface RideItem extends StoredLineTax {
  mainCode?: Text;
  code?: Text;
  description?: Text;
  quantity?: Amount | null;
  unitPrice?: Amount | null;
}

/**
 * Un comprobante electrónico listo para dibujar su RIDE, sin importar si es factura o nota de
 * crédito. Cada módulo traduce su entidad a este modelo; el dibujo vive en `RidePdfRenderer`.
 */
export interface RideDocument {
  /** Título del cuadro tributario: "FACTURA", "NOTA DE CRÉDITO"… */
  title: string;
  establishmentCode: Text;
  emissionPointCode: Text;
  sequential: Text;
  accessKey: string;
  authorizationNumber?: Text;
  authorizationDate?: Date | string | null;
  /** `PRODUCTION` o `TEST`, el ambiente con el que se emitió. */
  environment: Text;
  issueDate: Date | string;
  issuer: RideIssuer;
  customer?: RideCustomer | null;
  items: RideItem[];
  total: Amount | null | undefined;
  iceValue?: Amount | null;
  irbpnrValue?: Amount | null;
  tip?: Amount | null;
  /** Solo facturas: la tabla de forma de pago. */
  payment?: { method?: Text };
  /** Solo notas de crédito: el comprobante que se modifica y el motivo. */
  modifiedDocument?: { type: string; number: Text; reason: Text };
}
