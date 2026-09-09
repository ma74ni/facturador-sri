import { Injectable, Logger } from '@nestjs/common';
import { create } from 'xmlbuilder2';

@Injectable()
export class XmlGeneratorService {
  private readonly logger = new Logger(XmlGeneratorService.name);

  /**
   * Formatea una fecha a DD/MM/YYYY en UTC (issueDate se guarda normalizado
   * a medianoche UTC). Usar dayjs/Date sin fijar UTC toma la hora LOCAL del
   * proceso y en un servidor detrás de UTC (Ecuador es UTC-5) retrocede un día.
   */
  private formatDateUtc(date: Date): string {
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear().toString();
    return `${day}/${month}/${year}`;
  }

  /**
   * Mapea el tipo de identificación del cliente al código del SRI
   */
  private mapIdentificationType(type: string): string {
    // Ya viene como código del catálogo SRI (04/05/06/07/08): usarlo tal cual.
    // Sin esto, un cliente creado con identificationType "05" caía al default
    // '07' y el SRI rechazaba con error 69 (tipo 07 exige identificación
    // 9999999999999).
    if (['04', '05', '06', '07', '08'].includes(type)) {
      return type;
    }

    const mapping: Record<string, string> = {
      'CEDULA': '05',
      'RUC': '04',
      'PASAPORTE': '06',
      'CONSUMIDOR_FINAL': '07',
      'IDENTIFICACION_EXTERIOR': '08',
    };

    return mapping[type] || '07'; // Default: Consumidor final
  }

  /**
   * Valida y ajusta la identificación según el tipo
   */
  private normalizeIdentification(identification: string, type: string): string {
    // Venta a consumidor final: 13 dígitos de nueve
    if (type === 'CONSUMIDOR_FINAL' || type === '07') {
      return '9999999999999';
    }

    return identification;
  }

  /**
   * Genera el XML de una factura según esquema SRI v2.32
   * Estructura basada en ANEXO 1 - Ficha Técnica SRI
   */
  generateInvoiceXml(invoice: any, company: any): string {
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('factura', {
        id: 'comprobante',
        version: '2.1.0',
      });

    // ==================== INFO TRIBUTARIA ====================
    const infoTributaria = root.ele('infoTributaria');
    
    infoTributaria.ele('ambiente').txt(company.environment === 'PRODUCTION' ? '2' : '1');
    infoTributaria.ele('tipoEmision').txt('1'); // 1 = Normal
    infoTributaria.ele('razonSocial').txt(company.businessName);
    infoTributaria.ele('nombreComercial').txt(company.tradeName || company.businessName);
    infoTributaria.ele('ruc').txt(company.ruc);
    infoTributaria.ele('claveAcceso').txt(invoice.accessKey);
    infoTributaria.ele('codDoc').txt('01'); // 01 = Factura
    infoTributaria.ele('estab').txt(invoice.establishmentCode);
    infoTributaria.ele('ptoEmi').txt(invoice.emissionPointCode);
    infoTributaria.ele('secuencial').txt(invoice.sequential);
    infoTributaria.ele('dirMatriz').txt(company.address);

    // ==================== INFO FACTURA ====================
    const infoFactura = root.ele('infoFactura');

    // Orden según XSD del SRI
    // dayjs().format() usa la hora LOCAL del proceso — en un servidor detrás
    // de UTC (Ecuador es UTC-5) esto retrocede un día porque issueDate se
    // guarda normalizado a medianoche UTC. Se formatea en UTC a mano.
    infoFactura.ele('fechaEmision').txt(this.formatDateUtc(invoice.issueDate));
    infoFactura.ele('dirEstablecimiento').txt(company.address);

    // Obligado a llevar contabilidad
    infoFactura.ele('obligadoContabilidad').txt('SI');

    // Tipo identificación comprador - Usar código del SRI
    const tipoIdentificacionCodigo = this.mapIdentificationType(invoice.customer.identificationType);
    const identificacionNormalizada = this.normalizeIdentification(
      invoice.customer.identification,
      invoice.customer.identificationType
    );

    this.logger.log(`📝 Mapeo tipo identificación: "${invoice.customer.identificationType}" → "${tipoIdentificacionCodigo}"`);
    this.logger.log(`📝 Identificación normalizada: "${invoice.customer.identification}" → "${identificacionNormalizada}"`);

    infoFactura.ele('tipoIdentificacionComprador').txt(tipoIdentificacionCodigo);
    infoFactura.ele('razonSocialComprador').txt(
      invoice.customer.businessName ||
      `${invoice.customer.firstName || ''} ${invoice.customer.lastName || ''}`.trim() ||
      'CONSUMIDOR FINAL'
    );
    infoFactura.ele('identificacionComprador').txt(identificacionNormalizada);

    // Dirección comprador (opcional)
    if (invoice.customer.address) {
      infoFactura.ele('direccionComprador').txt(invoice.customer.address);
    }
    
    // Totales
    // totalSinImpuestos = subtotal - totalDescuento (base imponible)
    const subtotalSinImpuestos = parseFloat(invoice.subtotal) - parseFloat(invoice.totalDiscount);
    infoFactura.ele('totalSinImpuestos').txt(subtotalSinImpuestos.toFixed(2));
    infoFactura.ele('totalDescuento').txt(parseFloat(invoice.totalDiscount).toFixed(2));

    // ==================== TOTAL CON IMPUESTOS ====================
    const totalConImpuestos = infoFactura.ele('totalConImpuestos');

    // IVA 15% (código 4) - Solo si hay productos con IVA 15%
    if (subtotalSinImpuestos > 0) {
      const totalImpuesto = totalConImpuestos.ele('totalImpuesto');
      totalImpuesto.ele('codigo').txt('2'); // 2 = IVA
      totalImpuesto.ele('codigoPorcentaje').txt('4'); // 4 = 15%
      totalImpuesto.ele('baseImponible').txt(subtotalSinImpuestos.toFixed(2));
      totalImpuesto.ele('valor').txt(parseFloat(invoice.ivaValue).toFixed(2));
    }
    
    // Propina (generalmente 0)
    infoFactura.ele('propina').txt('0.00');

    // Importe total = totalSinImpuestos + IVA + propina
    infoFactura.ele('importeTotal').txt(parseFloat(invoice.total).toFixed(2));
    
    // Moneda
    infoFactura.ele('moneda').txt('DOLAR');

    // ==================== FORMA DE PAGO ====================
    const pagos = infoFactura.ele('pagos');
    const pago = pagos.ele('pago');
    pago.ele('formaPago').txt('01'); // 01 = Sin utilización del sistema financiero
    pago.ele('total').txt(invoice.total.toFixed(2));
    pago.ele('plazo').txt('0');
    pago.ele('unidadTiempo').txt('dias');

    // ==================== DETALLES ====================
    const detalles = root.ele('detalles');

    for (const item of invoice.items) {
      const detalle = detalles.ele('detalle');

      detalle.ele('codigoPrincipal').txt(item.mainCode);
      detalle.ele('codigoAuxiliar').txt(item.mainCode); // Mismo código como auxiliar
      detalle.ele('descripcion').txt(item.description);
      detalle.ele('cantidad').txt(parseFloat(item.quantity).toFixed(2));
      detalle.ele('precioUnitario').txt(parseFloat(item.unitPrice).toFixed(6));
      detalle.ele('descuento').txt(parseFloat(item.discount).toFixed(2));

      // precioTotalSinImpuesto = (cantidad * precioUnitario) - descuento
      const precioTotal = (parseFloat(item.quantity) * parseFloat(item.unitPrice)) - parseFloat(item.discount);
      detalle.ele('precioTotalSinImpuesto').txt(precioTotal.toFixed(2));

      // Impuestos del item
      const impuestos = detalle.ele('impuestos');
      const impuesto = impuestos.ele('impuesto');
      impuesto.ele('codigo').txt('2'); // IVA
      impuesto.ele('codigoPorcentaje').txt('4'); // 4 = 15%
      impuesto.ele('tarifa').txt('15.00'); // Tarifa 15%
      impuesto.ele('baseImponible').txt(precioTotal.toFixed(2));

      const ivaItem = precioTotal * 0.15;
      impuesto.ele('valor').txt(ivaItem.toFixed(2));
    }

    // ==================== INFO ADICIONAL (OPCIONAL) ====================
    const infoAdicional = root.ele('infoAdicional');
    infoAdicional.ele('campoAdicional', { nombre: 'Email' }).txt(invoice.customer.email || 'N/A');
    if (invoice.customer.phone) {
      infoAdicional.ele('campoAdicional', { nombre: 'Telefono' }).txt(invoice.customer.phone);
    }

    // Generar XML como string
    const xml = root.end({ prettyPrint: true });
    
    return xml;
  }

  /**
   * Valida que el XML tenga la estructura básica correcta
   */
  validateXmlStructure(xml: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validaciones básicas
    if (!xml.includes('<factura')) {
      errors.push('Falta elemento raíz <factura>');
    }
    if (!xml.includes('<infoTributaria>')) {
      errors.push('Falta <infoTributaria>');
    }
    if (!xml.includes('<infoFactura>')) {
      errors.push('Falta <infoFactura>');
    }
    if (!xml.includes('<detalles>')) {
      errors.push('Falta <detalles>');
    }
    if (!xml.includes('<claveAcceso>')) {
      errors.push('Falta <claveAcceso>');
    }
    if (!xml.includes('<totalConImpuestos>')) {
      errors.push('Falta <totalConImpuestos>');
    }
    if (!xml.includes('<totalImpuesto>')) {
      errors.push('Falta <totalImpuesto> dentro de <totalConImpuestos>');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}