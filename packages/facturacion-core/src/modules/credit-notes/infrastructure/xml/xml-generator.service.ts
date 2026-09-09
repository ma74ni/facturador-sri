import { Injectable } from '@nestjs/common';
import { create } from 'xmlbuilder2';

@Injectable()
export class CreditNoteXmlGeneratorService {
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
   * Genera el XML de una nota de crédito según esquema SRI
   * Código de documento: 04
   * Estructura basada en ANEXO 1 - Ficha Técnica SRI v2.28+
   */
  generateCreditNoteXml(creditNote: any, company: any): string {
    const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('notaCredito', {
      id: 'comprobante',
      version: '1.1.0',
    });

    // ==================== INFO TRIBUTARIA ====================
    const infoTributaria = root.ele('infoTributaria');

    infoTributaria.ele('ambiente').txt(company.environment === 'PRODUCTION' ? '2' : '1');
    infoTributaria.ele('tipoEmision').txt('1'); // 1 = Normal
    infoTributaria.ele('razonSocial').txt(company.businessName);
    infoTributaria.ele('nombreComercial').txt(company.tradeName || company.businessName);
    infoTributaria.ele('ruc').txt(company.ruc);
    infoTributaria.ele('claveAcceso').txt(creditNote.accessKey);
    infoTributaria.ele('codDoc').txt('04'); // 04 = Nota de Crédito
    infoTributaria.ele('estab').txt(creditNote.establishmentCode);
    infoTributaria.ele('ptoEmi').txt(creditNote.emissionPointCode);
    infoTributaria.ele('secuencial').txt(creditNote.sequential);
    infoTributaria.ele('dirMatriz').txt(company.address);

    // ==================== INFO NOTA DE CREDITO ====================
    const infoNotaCredito = root.ele('infoNotaCredito');

    // dayjs().format() usa la hora LOCAL del proceso — en un servidor detrás
    // de UTC (Ecuador es UTC-5) esto retrocede un día porque issueDate se
    // guarda normalizado a medianoche UTC. Se formatea en UTC a mano.
    infoNotaCredito.ele('fechaEmision').txt(this.formatDateUtc(creditNote.issueDate));

    // Dirección del establecimiento
    if (company.address) {
      infoNotaCredito.ele('dirEstablecimiento').txt(company.address);
    }

    // Tipo identificación comprador
    infoNotaCredito
      .ele('tipoIdentificacionComprador')
      .txt(creditNote.customer.identificationType);
    infoNotaCredito
      .ele('razonSocialComprador')
      .txt(
        creditNote.customer.businessName ||
          `${creditNote.customer.firstName || ''} ${creditNote.customer.lastName || ''}`.trim(),
      );
    infoNotaCredito.ele('identificacionComprador').txt(creditNote.customer.identification);

    // Obligado a llevar contabilidad
    infoNotaCredito.ele('obligadoContabilidad').txt('SI');

    // ==================== DOCUMENTO MODIFICADO ====================
    infoNotaCredito.ele('codDocModificado').txt(creditNote.modifiedDocType); // "01" = Factura
    infoNotaCredito.ele('numDocModificado').txt(creditNote.modifiedNumber); // 001-001-000000001

    // Fecha de emisión del documento sustento (factura modificada)
    // Si tenemos la factura completa, usamos su fecha, sino usamos la misma fecha de la nota
    const fechaSustento = creditNote.modifiedInvoice?.issueDate
      ? creditNote.modifiedInvoice.issueDate
      : creditNote.issueDate;
    infoNotaCredito
      .ele('fechaEmisionDocSustento')
      .txt(this.formatDateUtc(fechaSustento));

    // ==================== TOTALES ====================
    // ORDEN CORRECTO SEGÚN ESQUEMA SRI:
    // 1. totalSinImpuestos
    // 2. valorModificacion
    // 3. moneda
    // 4. totalConImpuestos
    // 5. motivo

    infoNotaCredito.ele('totalSinImpuestos').txt(creditNote.subtotal.toFixed(2));
    infoNotaCredito.ele('valorModificacion').txt(creditNote.total.toFixed(2));
    infoNotaCredito.ele('moneda').txt('DOLAR');

    // ==================== TOTAL CON IMPUESTOS ====================
    const totalConImpuestos = infoNotaCredito.ele('totalConImpuestos');

    // IVA 15% (código 4)
    const totalImpuesto = totalConImpuestos.ele('totalImpuesto');
    totalImpuesto.ele('codigo').txt('2'); // 2 = IVA
    totalImpuesto.ele('codigoPorcentaje').txt('4'); // 4 = 15%
    totalImpuesto.ele('baseImponible').txt(creditNote.subtotal.toFixed(2));
    totalImpuesto.ele('valor').txt(creditNote.ivaValue.toFixed(2));
    totalImpuesto.ele('valorDevolucionIva').txt('0.00'); // Campo requerido por SRI

    // IVA 0% (obligatorio para validación del SRI)
    const totalImpuesto0 = totalConImpuestos.ele('totalImpuesto');
    totalImpuesto0.ele('codigo').txt('2');
    totalImpuesto0.ele('codigoPorcentaje').txt('0'); // 0 = 0%
    totalImpuesto0.ele('baseImponible').txt('0.00');
    totalImpuesto0.ele('valor').txt('0.00');

    // Motivo de la nota de crédito (DEBE IR AL FINAL)
    infoNotaCredito.ele('motivo').txt(creditNote.reason);

    // ==================== DETALLES ====================
    const detalles = root.ele('detalles');

    for (const item of creditNote.items) {
      const detalle = detalles.ele('detalle');

      detalle.ele('codigoInterno').txt(item.mainCode);
      detalle.ele('codigoAdicional').txt(item.mainCode); // Mismo código como adicional
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
    infoAdicional
      .ele('campoAdicional', { nombre: 'Email' })
      .txt(creditNote.customer.email || 'N/A');
    if (creditNote.customer.phone) {
      infoAdicional.ele('campoAdicional', { nombre: 'Telefono' }).txt(creditNote.customer.phone);
    }
    infoAdicional
      .ele('campoAdicional', { nombre: 'Factura Modificada' })
      .txt(creditNote.modifiedNumber);

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
    if (!xml.includes('<notaCredito')) {
      errors.push('Falta elemento raíz <notaCredito>');
    }
    if (!xml.includes('<infoTributaria>')) {
      errors.push('Falta <infoTributaria>');
    }
    if (!xml.includes('<infoNotaCredito>')) {
      errors.push('Falta <infoNotaCredito>');
    }
    if (!xml.includes('<detalles>')) {
      errors.push('Falta <detalles>');
    }
    if (!xml.includes('<claveAcceso>')) {
      errors.push('Falta <claveAcceso>');
    }
    if (!xml.includes('<codDocModificado>')) {
      errors.push('Falta <codDocModificado>');
    }
    if (!xml.includes('<numDocModificado>')) {
      errors.push('Falta <numDocModificado>');
    }
    if (!xml.includes('<motivo>')) {
      errors.push('Falta <motivo>');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
