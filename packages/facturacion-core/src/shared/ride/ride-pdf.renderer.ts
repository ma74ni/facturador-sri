import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as bwipjs from 'bwip-js';
import { ivaSubtotalLabel, IvaTreatment } from '../../modules/tax-codes/domain/iva-rate.catalog';
import { TaxCalculatorService } from '../../modules/tax-codes/domain/services/tax-calculator.service';
import { RideCustomer, RideDocument, RideItem } from './ride-document';

/**
 * Dibuja el RIDE (representación impresa) de cualquier comprobante electrónico.
 * No sabe de R2 ni de Prisma: recibe el comprobante ya traducido y el logo, y devuelve el PDF.
 */
@Injectable()
export class RidePdfRenderer {
  private readonly logger = new Logger(RidePdfRenderer.name);

  constructor(private readonly taxCalculator: TaxCalculatorService) {}

  render(document: RideDocument, logo: Buffer | null): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 30, bottom: 30, left: 40, right: 40 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (error) => {
        this.logger.error('❌ Error generando PDF:', error);
        reject(error);
      });

      this.drawContent(doc, document, logo)
        .then(() => doc.end())
        .catch((error) => {
          this.logger.error('❌ Error construyendo RIDE:', error);
          doc.end();
          reject(error);
        });
    });
  }

  // ========================= Helpers =========================
  private money(v: unknown): string {
    return `$${Number(v || 0).toFixed(2)}`;
  }

  private pad(s: unknown): string {
    return (s ?? '').toString().trim();
  }

  private hrule(doc: PDFKit.PDFDocument, x1: number, y: number, x2: number): void {
    doc.moveTo(x1, y).lineTo(x2, y).stroke();
  }

  private box(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number): void {
    doc.rect(x, y, w, h).stroke();
  }

  private getTextHeight(doc: PDFKit.PDFDocument, text: string, width: number): number {
    return doc.heightOfString(text, { width });
  }

  // ========================= Layout principal =========================
  private async drawContent(
    doc: PDFKit.PDFDocument,
    document: RideDocument,
    logo: Buffer | null,
  ): Promise<void> {
    let y = 30;

    // Header izquierdo + Cuadro derecho
    const afterHeader = await this.drawHeaderAndTaxBox(doc, document, logo, y);
    y = afterHeader + 10;

    this.hrule(doc, 40, y, 555);
    y += 10;

    y = this.drawDocumentInfo(doc, document, y);
    y = this.drawCustomerInfo(doc, document.customer, y);

    this.hrule(doc, 40, y, 555);
    y += 10;

    y = this.drawItemsTable(doc, document.items, y);

    // Info adicional + Forma de pago (izq) || Subtotales + Total (der)
    this.drawAdditionalInfoAndTotals(doc, document, y);
  }

  // ========================= Bloques de dibujo =========================

  /**
   * Header: Logo arriba, luego info empresa (izquierda) + cuadro tributario (derecha)
   */
  private async drawHeaderAndTaxBox(
    doc: PDFKit.PDFDocument,
    document: RideDocument,
    logo: Buffer | null,
    startY: number,
  ): Promise<number> {
    const { issuer } = document;
    const leftX = 40;
    const rightX = 330;
    const boxW = 225;
    let leftY = startY;

    // ========== IZQUIERDA: LOGO Y DATOS EMPRESA ==========
    if (logo) {
      try {
        doc.image(logo, leftX, leftY, { fit: [120, 70], align: 'center' });
        leftY += 75;
      } catch (error) {
        this.logger.warn('⚠️ Logo inválido, el RIDE sale sin logo:', error);
      }
    }

    // Razón social
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(this.pad(issuer.businessName), leftX, leftY, { width: 280 });
    leftY += 16;

    // Nombre comercial
    if (issuer.tradeName && issuer.tradeName !== issuer.businessName) {
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(this.pad(issuer.tradeName), leftX, leftY, { width: 280 });
      leftY += 13;
    }

    // Dirección matriz
    doc.fontSize(7).font('Helvetica');
    doc.text(`Dir. Matriz: ${this.pad(issuer.address)}`, leftX, leftY, { width: 280 });
    leftY += 10;

    if (issuer.branchAddress) {
      doc.text(`Dir. Sucursal: ${this.pad(issuer.branchAddress)}`, leftX, leftY, {
        width: 280,
      });
      leftY += 10;
    }

    if (issuer.specialTaxpayer) {
      doc.text(`Contribuyente Especial Nro: ${this.pad(issuer.specialTaxpayer)}`, leftX, leftY, {
        width: 280,
      });
      leftY += 10;
    }

    const obligado = issuer.accountingRequired !== false ? 'SI' : 'NO';
    doc.text(`OBLIGADO A LLEVAR CONTABILIDAD: ${obligado}`, leftX, leftY, { width: 280 });
    leftY += 10;

    const leftHeight = leftY - startY;

    // ========== DERECHA: CUADRO TRIBUTARIO ==========
    let boxY = startY;
    const boxHeight = 190; // Altura fija del cuadro
    this.box(doc, rightX, boxY, boxW, boxHeight);

    boxY += 8;

    // RUC
    doc
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('R.U.C:', rightX + 10, boxY);
    doc.font('Helvetica').text(this.pad(issuer.ruc), rightX + 50, boxY);
    boxY += 14;

    // Tipo de comprobante
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(document.title, rightX, boxY, { width: boxW, align: 'center' });
    boxY += 18;

    // Número
    const documentNumber = `${this.pad(document.establishmentCode)}-${this.pad(
      document.emissionPointCode,
    )}-${this.pad(document.sequential)}`;
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(documentNumber, rightX, boxY, { width: boxW, align: 'center' });
    boxY += 18;

    // Número de autorización
    doc
      .fontSize(7)
      .font('Helvetica-Bold')
      .text('NÚMERO DE AUTORIZACIÓN', rightX + 10, boxY);
    boxY += 9;

    const authNumber = document.authorizationNumber || document.accessKey;
    doc
      .fontSize(6)
      .font('Helvetica')
      .text(this.pad(authNumber), rightX + 10, boxY, { width: boxW - 20 });
    boxY += 16;

    // Fecha y hora de autorización
    if (document.authorizationDate) {
      doc
        .fontSize(7)
        .font('Helvetica-Bold')
        .text('FECHA Y HORA DE AUTORIZACIÓN:', rightX + 10, boxY);
      boxY += 9;
      doc
        .font('Helvetica')
        .text(new Date(document.authorizationDate).toLocaleString('es-EC'), rightX + 10, boxY, {
          width: boxW - 20,
        });
      boxY += 12;
    }

    // Ambiente
    const ambiente = document.environment === 'PRODUCTION' ? 'PRODUCCIÓN' : 'PRUEBAS';
    doc
      .fontSize(7)
      .font('Helvetica-Bold')
      .text('AMBIENTE:', rightX + 10, boxY);
    doc.font('Helvetica').text(ambiente, rightX + 60, boxY);
    boxY += 10;

    // Emisión
    doc.font('Helvetica-Bold').text('EMISIÓN:', rightX + 10, boxY);
    doc.font('Helvetica').text('NORMAL', rightX + 60, boxY);
    boxY += 12;

    // Clave de acceso
    doc.font('Helvetica-Bold').text('CLAVE DE ACCESO', rightX + 10, boxY);
    boxY += 9;

    try {
      const barcodeBuffer = await this.generateBarcode(document.accessKey);
      doc.image(barcodeBuffer, rightX + 10, boxY, { width: boxW - 20, height: 30 });
      boxY += 32;

      // Número debajo del código de barras
      doc
        .fontSize(6)
        .font('Helvetica')
        .text(this.pad(document.accessKey), rightX + 10, boxY, {
          width: boxW - 20,
          align: 'center',
        });
      boxY += 10;
    } catch (error) {
      this.logger.warn('⚠️ Error generando código de barras:', error);
      // Sin código de barras queda al menos la clave en texto
      doc
        .fontSize(6)
        .font('Helvetica')
        .text(this.pad(document.accessKey), rightX + 10, boxY, { width: boxW - 20 });
      boxY += 12;
    }

    return Math.max(leftHeight + startY, startY + boxHeight);
  }

  /** Código de barras CODE128 de la clave de acceso. */
  private generateBarcode(text: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        bwipjs.toBuffer(
          { bcid: 'code128', text, scale: 2, height: 10, includetext: false },
          (err, png) => (err ? reject(err) : resolve(png)),
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  /** Comprador, fecha de emisión y, en notas de crédito, el comprobante que se modifica. */
  private drawDocumentInfo(doc: PDFKit.PDFDocument, document: RideDocument, y: number): number {
    const { customer } = document;
    doc.fontSize(8).font('Helvetica-Bold');

    doc.text('Razón Social / Nombres y Apellidos:', 40, y);

    const customerName =
      customer?.businessName ||
      `${this.pad(customer?.firstName)} ${this.pad(customer?.lastName)}`.trim();

    doc.font('Helvetica').text(customerName, 200, y, { width: 300 });

    const idType =
      customer?.identificationType === '04'
        ? 'RUC'
        : customer?.identificationType === '05'
          ? 'Cédula'
          : 'Pasaporte';

    doc.font('Helvetica-Bold').text(`${idType}:`, 40, y + 12);
    doc.font('Helvetica').text(this.pad(customer?.identification), 200, y + 12);

    doc.font('Helvetica-Bold').text('Fecha de Emisión:', 40, y + 24);
    doc
      .font('Helvetica')
      .text(
        new Date(document.issueDate).toLocaleDateString('es-EC', { timeZone: 'UTC' }),
        200,
        y + 24,
      );

    const modified = document.modifiedDocument;
    if (!modified) {
      return y + 36;
    }

    doc.font('Helvetica-Bold').text('Comprobante que se modifica:', 40, y + 36);
    doc.font('Helvetica').text(`${modified.type} ${this.pad(modified.number)}`, 200, y + 36);

    doc.font('Helvetica-Bold').text('Motivo:', 40, y + 48);
    const reasonHeight = this.getTextHeight(doc, this.pad(modified.reason), 350);
    doc.font('Helvetica').text(this.pad(modified.reason), 200, y + 48, { width: 350 });

    return y + 48 + Math.max(10, reasonHeight) + 12;
  }

  /** Dirección y teléfono del comprador. */
  private drawCustomerInfo(
    doc: PDFKit.PDFDocument,
    customer: RideCustomer | null | undefined,
    y: number,
  ): number {
    doc.fontSize(7).font('Helvetica');

    let currentY = y;

    if (customer?.address) {
      doc.font('Helvetica-Bold').text('Dirección:', 40, currentY);
      doc.font('Helvetica').text(this.pad(customer.address), 100, currentY, { width: 450 });
      currentY += 10;
    }

    if (customer?.phone) {
      doc.font('Helvetica-Bold').text('Teléfono:', 40, currentY);
      doc.font('Helvetica').text(this.pad(customer.phone), 100, currentY);
      currentY += 10;
    }

    return currentY;
  }

  /** Detalle con filas de altura variable según la descripción. */
  private drawItemsTable(doc: PDFKit.PDFDocument, items: RideItem[], y: number): number {
    const tableLeft = 40;
    const tableRight = 555;
    const tableWidth = tableRight - tableLeft;

    const cols = {
      code: { x: tableLeft, w: 70 },
      desc: { x: tableLeft + 70, w: 190 },
      qty: { x: tableLeft + 260, w: 45 },
      unit: { x: tableLeft + 305, w: 60 },
      disc: { x: tableLeft + 365, w: 60 },
      total: { x: tableLeft + 425, w: 90 },
    };

    doc.fontSize(8).font('Helvetica-Bold');

    const headerY = y;
    doc.rect(tableLeft, headerY, tableWidth, 18).fillAndStroke('#e0e0e0', '#000000');

    doc.fillColor('#000000');
    doc.text('Cod. Principal', cols.code.x + 3, headerY + 5, {
      width: cols.code.w - 6,
      align: 'left',
    });
    doc.text('Descripción', cols.desc.x + 3, headerY + 5, {
      width: cols.desc.w - 6,
      align: 'left',
    });
    doc.text('Cant.', cols.qty.x + 3, headerY + 5, { width: cols.qty.w - 6, align: 'right' });
    doc.text('P. Unit.', cols.unit.x + 3, headerY + 5, {
      width: cols.unit.w - 6,
      align: 'right',
    });
    doc.text('Desc.', cols.disc.x + 3, headerY + 5, { width: cols.disc.w - 6, align: 'right' });
    doc.text('Precio Total', cols.total.x + 3, headerY + 5, {
      width: cols.total.w - 6,
      align: 'right',
    });

    y = headerY + 18;

    doc.fontSize(7).font('Helvetica');

    for (const item of items) {
      if (y > 700) {
        doc.addPage();
        y = 40;
      }

      const description = this.pad(item?.description);
      const descHeight = this.getTextHeight(doc, description, cols.desc.w - 6);
      const rowHeight = Math.max(14, descHeight + 6);

      const rowTop = y;
      const rowBottom = y + rowHeight;

      // Líneas verticales
      doc.moveTo(tableLeft, rowTop).lineTo(tableLeft, rowBottom).stroke();
      doc.moveTo(cols.desc.x, rowTop).lineTo(cols.desc.x, rowBottom).stroke();
      doc.moveTo(cols.qty.x, rowTop).lineTo(cols.qty.x, rowBottom).stroke();
      doc.moveTo(cols.unit.x, rowTop).lineTo(cols.unit.x, rowBottom).stroke();
      doc.moveTo(cols.disc.x, rowTop).lineTo(cols.disc.x, rowBottom).stroke();
      doc.moveTo(cols.total.x, rowTop).lineTo(cols.total.x, rowBottom).stroke();
      doc.moveTo(tableRight, rowTop).lineTo(tableRight, rowBottom).stroke();

      // Línea horizontal inferior
      doc.moveTo(tableLeft, rowBottom).lineTo(tableRight, rowBottom).stroke();

      const textY = rowTop + 3;

      doc.text(this.pad(item?.mainCode || item?.code), cols.code.x + 3, textY, {
        width: cols.code.w - 6,
      });

      doc.text(description, cols.desc.x + 3, textY, {
        width: cols.desc.w - 6,
        lineGap: 1,
      });

      doc.text(String(item?.quantity ?? 0), cols.qty.x + 3, textY, {
        width: cols.qty.w - 6,
        align: 'right',
      });
      doc.text(this.money(item?.unitPrice), cols.unit.x + 3, textY, {
        width: cols.unit.w - 6,
        align: 'right',
      });
      doc.text(this.money(item?.discount || 0), cols.disc.x + 3, textY, {
        width: cols.disc.w - 6,
        align: 'right',
      });

      const subtotalCalc =
        Number(item?.quantity || 0) * Number(item?.unitPrice || 0) - Number(item?.discount || 0);
      doc.text(this.money(item?.subtotal ?? subtotalCalc), cols.total.x + 3, textY, {
        width: cols.total.w - 6,
        align: 'right',
      });

      y = rowBottom;
    }

    return y + 10;
  }

  /** Información adicional + forma de pago (izquierda) || subtotales + total (derecha). */
  private drawAdditionalInfoAndTotals(
    doc: PDFKit.PDFDocument,
    document: RideDocument,
    y: number,
  ): number {
    const { customer, payment } = document;
    const leftX = 40;
    const rightX = 320;
    const startY = y;

    let leftY = startY;
    let rightY = startY;

    // ========== IZQUIERDA: INFORMACIÓN ADICIONAL ==========
    if (customer?.email || customer?.phone) {
      doc.fontSize(8).font('Helvetica-Bold').text('Información Adicional', leftX, leftY);
      leftY += 12;

      doc.fontSize(7).font('Helvetica');

      if (customer?.email) {
        doc.text(`Email: ${this.pad(customer.email)}`, leftX, leftY, { width: 250 });
        leftY += 10;
      }

      if (customer?.phone) {
        doc.text(`Teléfono: ${this.pad(customer.phone)}`, leftX, leftY, { width: 250 });
        leftY += 10;
      }

      if (payment) leftY += 5; // Espacio antes de Forma de Pago
    }

    // ========== IZQUIERDA: FORMA DE PAGO ==========
    if (payment) {
      const paymentBoxX = leftX;
      const paymentBoxWidth = 250;
      const headerColWidth = 150;
      const valueColWidth = 100;

      const paymentHeaderY = leftY;
      doc.fontSize(7).font('Helvetica-Bold');
      doc.text('Forma de Pago', paymentBoxX + 2, paymentHeaderY + 2, {
        width: headerColWidth - 4,
      });
      doc.text('Valor', paymentBoxX + headerColWidth + 2, paymentHeaderY + 2, {
        width: valueColWidth - 4,
      });

      leftY += 12;
      this.hrule(doc, paymentBoxX, leftY, paymentBoxX + paymentBoxWidth);
      leftY += 4;

      doc.font('Helvetica');
      const formaPago = payment.method || 'SIN UTILIZACION DEL SISTEMA FINANCIERO';

      const paymentTextHeight = this.getTextHeight(doc, formaPago, headerColWidth - 4);
      const rowHeight = Math.max(14, paymentTextHeight + 4);

      const rowStartY = leftY;

      doc.text(formaPago, paymentBoxX + 2, rowStartY, { width: headerColWidth - 4 });
      doc.text(this.money(document.total), paymentBoxX + headerColWidth + 2, rowStartY, {
        width: valueColWidth - 4,
      });

      leftY += rowHeight;
      this.hrule(doc, paymentBoxX, leftY, paymentBoxX + paymentBoxWidth);
      leftY += 10;
    }

    // ========== DERECHA: SUBTOTALES ==========
    const labelX = rightX;
    const valueX = 485;
    const valueW = 70; // Alcanza para valores hasta $999,999.99

    doc.fontSize(7).font('Helvetica');

    const addRow = (label: string, value: unknown) => {
      doc.text(label, labelX, rightY, { width: 160 });
      doc.text(this.money(value), valueX, rightY, { width: valueW, align: 'right' });
      rightY += 10;
    };

    // Subtotales e IVA por tarifa, desde el IVA guardado en cada línea.
    const taxes = this.taxCalculator.summarize(document.items);
    for (const group of taxes.groups) {
      addRow(ivaSubtotalLabel(group), group.taxBase.toNumber());
    }

    addRow('SUBTOTAL SIN IMPUESTOS', taxes.totalWithoutTaxes.toNumber());

    if (taxes.totalDiscount.gt(0)) addRow('TOTAL DESCUENTO', taxes.totalDiscount.toNumber());
    if (document.iceValue) addRow('ICE', document.iceValue);
    if (document.irbpnrValue) addRow('IRBPNR', document.irbpnrValue);

    const taxedGroups = taxes.groups.filter((group) => group.treatment === IvaTreatment.TAXED);
    for (const group of taxedGroups) {
      addRow(`IVA ${group.percentage}%`, group.ivaValue.toNumber());
    }
    if (taxedGroups.length === 0) addRow('IVA', 0);

    if (document.tip) addRow('PROPINA', document.tip);

    rightY += 2;

    // ========== DERECHA: LÍNEA Y TOTAL ==========
    this.hrule(doc, labelX, rightY, valueX + valueW);
    rightY += 8;

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('VALOR TOTAL', labelX, rightY, { width: 160 });
    doc.text(this.money(document.total), valueX, rightY, { width: valueW, align: 'right' });
    rightY += 15;

    return Math.max(leftY, rightY) + 10;
  }
}
