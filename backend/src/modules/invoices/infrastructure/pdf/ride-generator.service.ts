import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as bwipjs from 'bwip-js';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

@Injectable()
export class RideGeneratorService {
  private readonly logger = new Logger(RideGeneratorService.name);
  private readonly ridePath = join(process.cwd(), 'storage', 'ride');

  // ========================= Helpers =========================
  private money(v: any): string {
    return `$${Number(v || 0).toFixed(2)}`;
  }

  private pad(s: any): string {
    return (s ?? '').toString().trim();
  }

  private hrule(doc: PDFKit.PDFDocument, x1: number, y: number, x2: number): void {
    doc.moveTo(x1, y).lineTo(x2, y).stroke();
  }

  private box(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number): void {
    doc.rect(x, y, w, h).stroke();
  }

  // Calcula altura de texto
  private getTextHeight(doc: PDFKit.PDFDocument, text: string, width: number): number {
    const currentFont = doc.font;
    const currentSize = doc.fontSize;
    return doc.heightOfString(text, { width });
  }

  // ========================= Infra =========================
  async ensureRideFolder(): Promise<void> {
    if (!existsSync(this.ridePath)) {
      await mkdir(this.ridePath, { recursive: true });
    }
  }

  async generateRide(invoice: any, company: any): Promise<string> {
    await this.ensureRideFolder();

    const filename = `${invoice.accessKey}.pdf`;
    const filepath = join(this.ridePath, filename);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 30, bottom: 30, left: 40, right: 40 },
        });

        const stream = createWriteStream(filepath);
        doc.pipe(stream);

        this.buildRideContent(doc, invoice, company)
          .then(() => {
            doc.end();
          })
          .catch((err) => {
            this.logger.error('❌ Error construyendo RIDE:', err);
            doc.end();
            reject(err);
          });

        stream.on('finish', () => {
          this.logger.log(`✅ RIDE generado: ${filepath}`);
          resolve(filepath);
        });

        stream.on('error', (error) => {
          this.logger.error('❌ Error escribiendo PDF:', error);
          reject(error);
        });
      } catch (error) {
        this.logger.error('❌ Error creando PDF:', error);
        reject(error);
      }
    });
  }

  // ========================= Layout principal =========================
  private async buildRideContent(
  doc: PDFKit.PDFDocument,
  invoice: any,
  company: any,
): Promise<void> {
  let y = 30;

  // Header izquierdo + Cuadro derecho
  const afterHeader = await this.drawHeaderAndTaxBox(doc, invoice, company, y);
  y = afterHeader + 10;

  // Línea separadora
  this.hrule(doc, 40, y, 555);
  y += 10;

  // Info factura
  y = this.drawInvoiceInfo(doc, invoice, y);

  // Info cliente
  y = this.drawCustomerInfo(doc, invoice.customer, y);

  // Línea separadora
  this.hrule(doc, 40, y, 555);
  y += 10;

  // Detalle
  y = await this.drawItemsTable(doc, invoice.items || [], y);

  // Info adicional + Forma de pago (izq) || Subtotales + Total (der)
  y = this.drawAdditionalInfoAndTotals(doc, invoice, y);
}

  // ========================= Bloques de dibujo =========================

  /**
   * Header: Logo arriba, luego info empresa (izquierda) + cuadro tributario (derecha)
   */
  private async drawHeaderAndTaxBox(
    doc: PDFKit.PDFDocument,
    invoice: any,
    company: any,
    startY: number,
  ): Promise<number> {
    const leftX = 40;
    const rightX = 330;
    const boxW = 225;
    let leftY = startY;

    // ========== IZQUIERDA: LOGO Y DATOS EMPRESA ==========

    // Logo primero (centrado o a la izquierda)
    if (company.logoPath && existsSync(company.logoPath)) {
      try {
        doc.image(company.logoPath, leftX, leftY, {
          fit: [120, 70],
          align: 'center',
        });
        leftY += 75; // Espacio después del logo
      } catch (error) {
        this.logger.warn('⚠️ Error al cargar logo:', error);
      }
    }

    // Razón social
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(this.pad(company.businessName), leftX, leftY, { width: 280 });
    leftY += 16;

    // Nombre comercial
    if (company.tradeName && company.tradeName !== company.businessName) {
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(this.pad(company.tradeName), leftX, leftY, { width: 280 });
      leftY += 13;
    }

    // Dirección matriz
    doc.fontSize(7).font('Helvetica');
    doc.text(`Dir. Matriz: ${this.pad(company.address)}`, leftX, leftY, { width: 280 });
    leftY += 10;

    // Dirección sucursal (si aplica)
    if (company.branchAddress) {
      doc.text(`Dir. Sucursal: ${this.pad(company.branchAddress)}`, leftX, leftY, {
        width: 280,
      });
      leftY += 10;
    }

    // Contribuyente especial
    if (company.specialTaxpayer) {
      doc.text(
        `Contribuyente Especial Nro: ${this.pad(company.specialTaxpayer)}`,
        leftX,
        leftY,
        { width: 280 },
      );
      leftY += 10;
    }

    // Obligado a llevar contabilidad
    const obligado = company.accountingRequired !== false ? 'SI' : 'NO';
    doc.text(`OBLIGADO A LLEVAR CONTABILIDAD: ${obligado}`, leftX, leftY, { width: 280 });
    leftY += 10;

    const leftHeight = leftY - startY;

    // ========== DERECHA: CUADRO TRIBUTARIO ==========
    let boxY = startY;
    const boxHeight = 190; // Altura fija del cuadro
    this.box(doc, rightX, boxY, boxW, boxHeight);

    boxY += 8;

    // RUC
    doc.fontSize(8).font('Helvetica-Bold').text('R.U.C:', rightX + 10, boxY);
    doc.font('Helvetica').text(this.pad(company.ruc), rightX + 50, boxY);
    boxY += 14;

    // FACTURA
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('FACTURA', rightX, boxY, { width: boxW, align: 'center' });
    boxY += 18;

    // Número
    const invoiceNumber = `${this.pad(invoice.establishmentCode)}-${this.pad(
      invoice.emissionPointCode,
    )}-${this.pad(invoice.sequential)}`;
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(invoiceNumber, rightX, boxY, { width: boxW, align: 'center' });
    boxY += 18;

    // Número de autorización
    doc
      .fontSize(7)
      .font('Helvetica-Bold')
      .text('NÚMERO DE AUTORIZACIÓN', rightX + 10, boxY);
    boxY += 9;

    const authNumber = invoice.authorizationNumber || invoice.accessKey;
    doc
      .fontSize(6)
      .font('Helvetica')
      .text(this.pad(authNumber), rightX + 10, boxY, { width: boxW - 20 });
    boxY += 16;

    // Fecha y hora de autorización
    if (invoice.authorizationDate) {
      doc
        .fontSize(7)
        .font('Helvetica-Bold')
        .text('FECHA Y HORA DE AUTORIZACIÓN:', rightX + 10, boxY);
      boxY += 9;
      doc
        .font('Helvetica')
        .text(
          new Date(invoice.authorizationDate).toLocaleString('es-EC'),
          rightX + 10,
          boxY,
          { width: boxW - 20 },
        );
      boxY += 12;
    }

    // Ambiente
    const ambiente =
      (invoice.company?.environment || company.environment) === 'PRODUCTION'
        ? 'PRODUCCIÓN'
        : 'PRUEBAS';
    doc.fontSize(7).font('Helvetica-Bold').text('AMBIENTE:', rightX + 10, boxY);
    doc.font('Helvetica').text(ambiente, rightX + 60, boxY);
    boxY += 10;

    // Emisión
    doc.font('Helvetica-Bold').text('EMISIÓN:', rightX + 10, boxY);
    doc.font('Helvetica').text('NORMAL', rightX + 60, boxY);
    boxY += 12;

    // Clave de acceso
    doc.font('Helvetica-Bold').text('CLAVE DE ACCESO', rightX + 10, boxY);
    boxY += 9;

    // Código de barras
    try {
      const barcodeBuffer = await this.generateBarcode(invoice.accessKey);
      doc.image(barcodeBuffer, rightX + 10, boxY, { width: boxW - 20, height: 30 });
      boxY += 32;

      // NÚMERO DEBAJO DEL CÓDIGO DE BARRAS
      doc
        .fontSize(6)
        .font('Helvetica')
        .text(this.pad(invoice.accessKey), rightX + 10, boxY, {
          width: boxW - 20,
          align: 'center',
        });
      boxY += 10;
    } catch (error) {
      this.logger.warn('⚠️ Error generando código de barras:', error);
      // Fallback: solo texto
      doc
        .fontSize(6)
        .font('Helvetica')
        .text(this.pad(invoice.accessKey), rightX + 10, boxY, { width: boxW - 20 });
      boxY += 12;
    }

    return Math.max(leftHeight + startY, startY + boxHeight);
  }

  /**
   * Genera código de barras CODE128
   */
  private async generateBarcode(text: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        bwipjs.toBuffer(
          {
            bcid: 'code128',
            text: text,
            scale: 2,
            height: 10,
            includetext: false,
          },
          (err, png) => {
            if (err) {
              reject(err);
            } else {
              resolve(png);
            }
          },
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Información de la factura
   */
  private drawInvoiceInfo(doc: PDFKit.PDFDocument, invoice: any, y: number): number {
    doc.fontSize(8).font('Helvetica-Bold');

    // Razón Social / Nombres
    doc.text('Razón Social / Nombres y Apellidos:', 40, y);

    const customerName =
      invoice.customer?.businessName ||
      `${this.pad(invoice.customer?.firstName)} ${this.pad(invoice.customer?.lastName)}`.trim();

    doc.font('Helvetica').text(customerName, 200, y, { width: 300 });

    // Identificación
    const idType =
      invoice.customer?.identificationType === '04'
        ? 'RUC'
        : invoice.customer?.identificationType === '05'
          ? 'Cédula'
          : 'Pasaporte';

    doc.font('Helvetica-Bold').text(`${idType}:`, 40, y + 12);
    doc.font('Helvetica').text(this.pad(invoice.customer?.identification), 200, y + 12);

    // Fecha de emisión
    doc.font('Helvetica-Bold').text('Fecha de Emisión:', 40, y + 24);
    doc
      .font('Helvetica')
      .text(new Date(invoice.issueDate).toLocaleDateString('es-EC'), 200, y + 24);

    return y + 36;
  }

  /**
   * Información del cliente (dirección, teléfono)
   */
  private drawCustomerInfo(doc: PDFKit.PDFDocument, customer: any, y: number): number {
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

  /**
   * Tabla de detalles con ALTURA DINÁMICA
   */
  private async drawItemsTable(
    doc: PDFKit.PDFDocument,
    items: any[],
    y: number,
  ): Promise<number> {
    const tableLeft = 40;
    const tableRight = 555;
    const tableWidth = tableRight - tableLeft;

    // Columnas
    const cols = {
      code: { x: tableLeft, w: 70 },
      desc: { x: tableLeft + 70, w: 190 },
      qty: { x: tableLeft + 260, w: 45 },
      unit: { x: tableLeft + 305, w: 60 },
      disc: { x: tableLeft + 365, w: 60 },
      total: { x: tableLeft + 425, w: 90 },
    };

    // Header
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

    // Items con altura dinámica
    doc.fontSize(7).font('Helvetica');

    for (const item of items) {
      // Verificar si necesita nueva página
      if (y > 700) {
        doc.addPage();
        y = 40;
      }

      // Calcular altura necesaria para la descripción
      const description = this.pad(item?.description);
      const descHeight = this.getTextHeight(doc, description, cols.desc.w - 6);
      const rowHeight = Math.max(14, descHeight + 6); // Mínimo 14, pero crece según contenido

      // Dibujar bordes de la fila
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

      // Contenido (centrado verticalmente)
      const textY = rowTop + 3;

      doc.text(this.pad(item?.mainCode || item?.code), cols.code.x + 3, textY, {
        width: cols.code.w - 6,
      });

      // Descripción con wrapping
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

  /**
 * Información adicional + Forma de pago (izquierda) || Subtotales + Total (derecha)
 */
private drawAdditionalInfoAndTotals(
  doc: PDFKit.PDFDocument,
  invoice: any,
  y: number,
): number {
  const leftX = 40;
  const rightX = 320;
  const startY = y;

  let leftY = startY;
  let rightY = startY;

  // ========== IZQUIERDA: INFORMACIÓN ADICIONAL ==========
  if (invoice.customer?.email || invoice.customer?.phone) {
    doc.fontSize(8).font('Helvetica-Bold').text('Información Adicional', leftX, leftY);
    leftY += 12;

    doc.fontSize(7).font('Helvetica');

    if (invoice.customer?.email) {
      doc.text(`Email: ${this.pad(invoice.customer.email)}`, leftX, leftY, { width: 250 });
      leftY += 10;
    }

    if (invoice.customer?.phone) {
      doc.text(`Teléfono: ${this.pad(invoice.customer.phone)}`, leftX, leftY, { width: 250 });
      leftY += 10;
    }

    leftY += 5; // Espacio antes de Forma de Pago
  }

  // ========== IZQUIERDA: FORMA DE PAGO (CON ALTURA DINÁMICA) ==========
  const paymentBoxX = leftX;
  const paymentBoxWidth = 250;
  const headerColWidth = 150;
  const valueColWidth = 100;

  // Header de tabla
  const paymentHeaderY = leftY;
  doc.fontSize(7).font('Helvetica-Bold');
  doc.text('Forma de Pago', paymentBoxX + 2, paymentHeaderY + 2, { width: headerColWidth - 4 });
  doc.text('Valor', paymentBoxX + headerColWidth + 2, paymentHeaderY + 2, { width: valueColWidth - 4 });

  leftY += 12;
  this.hrule(doc, paymentBoxX, leftY, paymentBoxX + paymentBoxWidth);
  leftY += 4;

  // Contenido (con altura dinámica)
  doc.font('Helvetica');
  const formaPago = invoice.paymentMethod || 'SIN UTILIZACION DEL SISTEMA FINANCIERO';
  
  // Calcular altura necesaria para el texto de forma de pago
  const paymentTextHeight = this.getTextHeight(doc, formaPago, headerColWidth - 4);
  const rowHeight = Math.max(14, paymentTextHeight + 4);

  const rowStartY = leftY;

  // Texto de forma de pago (izquierda)
  doc.text(formaPago, paymentBoxX + 2, rowStartY, { width: headerColWidth - 4 });

  // Valor (derecha, centrado verticalmente)
  doc.text(
    this.money(invoice.total),
    paymentBoxX + headerColWidth + 2,
    rowStartY,
    { width: valueColWidth - 4 }
  );

  leftY += rowHeight;
  this.hrule(doc, paymentBoxX, leftY, paymentBoxX + paymentBoxWidth);
  leftY += 10;

  // ========== DERECHA: SUBTOTALES ==========
  const labelX = rightX;
  const valueX = 485; // Más espacio para el valor
  const valueW = 70; // Ancho ampliado para valores hasta $999,999.99

  doc.fontSize(7).font('Helvetica');

  const addRow = (label: string, value: number) => {
    doc.text(label, labelX, rightY, { width: 160 });
    doc.text(this.money(value), valueX, rightY, { width: valueW, align: 'right' });
    rightY += 10;
  };

  // Subtotales por tarifa IVA
  if (invoice.subtotal15) addRow('SUBTOTAL 15%', invoice.subtotal15);
  if (invoice.subtotal5) addRow('SUBTOTAL 5%', invoice.subtotal5);
  if (invoice.subtotal0) addRow('SUBTOTAL 0%', invoice.subtotal0);
  if (invoice.subtotalNoObjeto) addRow('SUBTOTAL NO OBJETO DE IVA', invoice.subtotalNoObjeto);
  if (invoice.subtotalExento) addRow('SUBTOTAL EXENTO DE IVA', invoice.subtotalExento);

  addRow('SUBTOTAL SIN IMPUESTOS', invoice.subtotal || 0);

  if (invoice.totalDiscount) addRow('TOTAL DESCUENTO', invoice.totalDiscount);
  if (invoice.iceValue) addRow('ICE', invoice.iceValue);
  if (invoice.irbpnrValue) addRow('IRBPNR', invoice.irbpnrValue);

  if (invoice.iva5Value) addRow('IVA 5%', invoice.iva5Value);
  addRow('IVA 15%', invoice.ivaValue || 0);

  if (invoice.tip) addRow('PROPINA', invoice.tip);

  rightY += 2;

  // ========== DERECHA: LÍNEA Y TOTAL ==========
  this.hrule(doc, labelX, rightY, valueX + valueW);
  rightY += 8;

  // VALOR TOTAL (con más espacio)
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('VALOR TOTAL', labelX, rightY, { width: 160 });
  doc.text(this.money(invoice.total), valueX, rightY, { width: valueW, align: 'right' });
  rightY += 15;

  // Retornar la Y más baja de ambas columnas
  return Math.max(leftY, rightY) + 10;
}

  
}