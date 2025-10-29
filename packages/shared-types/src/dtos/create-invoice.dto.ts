/**
 * DTO para crear una nueva factura
 * Utilizado para la integración entre POS y facturacion-core
 */
export interface CreateInvoiceDto {
  /** ID del cliente */
  customerId: string;

  /** ID del establecimiento */
  establishmentId: string;

  /** ID del punto de emisión */
  emissionPointId: string;

  /** Items de la factura */
  items: CreateInvoiceItemDto[];

  /** Metadata adicional para integración */
  metadata?: {
    /** Fuente del documento (POS_HELADERIA, POS_RETAIL, MANUAL, etc) */
    source?: string;

    /** ID externo del documento en el sistema origen */
    externalId?: string;

    /** Información adicional de la cuenta (para POS) */
    accountId?: string;

    /** ID del pago asociado (para POS) */
    paymentId?: string;

    /** Campos adicionales personalizados */
    [key: string]: any;
  };
}

/**
 * DTO para un item de factura
 */
export interface CreateInvoiceItemDto {
  /** ID del producto (opcional si se proporciona mainCode) */
  productId?: string;

  /** Código principal del producto */
  mainCode?: string;

  /** Descripción del item */
  description?: string;

  /** Cantidad */
  quantity: number;

  /** Precio unitario */
  unitPrice: number;

  /** Descuento aplicado */
  discount?: number;
}
