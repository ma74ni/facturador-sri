import { Injectable } from '@nestjs/common';
import { create } from 'xmlbuilder2';
import * as dayjs from 'dayjs';

@Injectable()
export class XmlGeneratorService {
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
    
    infoFactura.ele('fechaEmision').txt(dayjs(invoice.issueDate).format('DD/MM/YYYY'));
    
    // Obligado a llevar contabilidad
    infoFactura.ele('obligadoContabilidad').txt('SI');
    
    // Tipo identificación comprador
    infoFactura.ele('tipoIdentificacionComprador').txt(invoice.customer.identificationType);
    infoFactura.ele('razonSocialComprador').txt(
      invoice.customer.businessName || 
      `${invoice.customer.firstName || ''} ${invoice.customer.lastName || ''}`.trim()
    );
    infoFactura.ele('identificacionComprador').txt(invoice.customer.identification);
    
    // Dirección comprador (opcional)
    if (invoice.customer.address) {
      infoFactura.ele('direccionComprador').txt(invoice.customer.address);
    }
    
    // Totales
    infoFactura.ele('totalSinImpuestos').txt(invoice.subtotal.toFixed(2));
    infoFactura.ele('totalDescuento').txt(invoice.totalDiscount.toFixed(2));

    // ==================== TOTAL CON IMPUESTOS ====================
    const totalConImpuestos = infoFactura.ele('totalConImpuestos');
    
    // IVA 15% (código 4)
    const totalImpuesto = totalConImpuestos.ele('totalImpuesto');
    totalImpuesto.ele('codigo').txt('2'); // 2 = IVA
    totalImpuesto.ele('codigoPorcentaje').txt('4'); // 4 = 15%
    totalImpuesto.ele('baseImponible').txt(invoice.subtotal.toFixed(2));
    totalImpuesto.ele('valor').txt(invoice.ivaValue.toFixed(2));
    
    // IVA 0% (obligatorio para validación del SRI)
    const totalImpuesto0 = totalConImpuestos.ele('totalImpuesto');
    totalImpuesto0.ele('codigo').txt('2');
    totalImpuesto0.ele('codigoPorcentaje').txt('0'); // 0 = 0%
    totalImpuesto0.ele('baseImponible').txt('0.00');
    totalImpuesto0.ele('valor').txt('0.00');
    
    // Propina (generalmente 0)
    infoFactura.ele('propina').txt('0.00');
    
    // Importe total
    infoFactura.ele('importeTotal').txt(invoice.total.toFixed(2));
    
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
      detalle.ele('cantidad').txt(item.quantity.toString());
      detalle.ele('precioUnitario').txt(item.unitPrice.toFixed(6));
      detalle.ele('descuento').txt(item.discount.toFixed(2));
      detalle.ele('precioTotalSinImpuesto').txt(item.subtotal.toFixed(2));

      // Impuestos del item
      const impuestos = detalle.ele('impuestos');
      const impuesto = impuestos.ele('impuesto');
      impuesto.ele('codigo').txt('2'); // IVA
      impuesto.ele('codigoPorcentaje').txt('4'); // 15%
      impuesto.ele('tarifa').txt('15'); // Tarifa solo va en detalles
      impuesto.ele('baseImponible').txt(item.subtotal.toFixed(2));
      
      const ivaItem = parseFloat(item.subtotal) * 0.15;
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