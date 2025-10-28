import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as bwipjs from 'bwip-js';
import { R2StorageService } from '../../../../shared/storage/r2-storage.service';

@Injectable()
export class CreditNoteRideGeneratorService {
  private readonly logger = new Logger(CreditNoteRideGeneratorService.name);

  constructor(private r2Storage: R2StorageService) {}

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

  // ========================= Generación de RIDE =========================
  async generateRide(creditNote: any, company: any): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 30, bottom: 30, left: 40, right: 40 },
        });

        // Almacenar los chunks del PDF en memoria
        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));

        doc.on('end', async () => {
          try {
            // Combinar chunks en un solo buffer
            const pdfBuffer = Buffer.concat(chunks);

            // Subir a R2
            const r2Key = await this.r2Storage.uploadRide(
              company.id,
              creditNote.accessKey,
              pdfBuffer,
            );

            this.logger.log(`✅ RIDE de nota de crédito generado y subido a R2: ${r2Key}`);
            resolve(r2Key);
          } catch (uploadError) {
            this.logger.error('❌ Error subiendo RIDE a R2:', uploadError);
            reject(uploadError);
          }
        });

        doc.on('error', (error) => {
          this.logger.error('❌ Error generando PDF:', error);
          reject(error);
        });

        // Construir el contenido del PDF
        this.buildRideContent(doc, creditNote, company)
          .then(() => {
            doc.end();
          })
          .catch((err) => {
            this.logger.error('❌ Error construyendo RIDE:', err);
            doc.end();
            reject(err);
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
    creditNote: any,
    company: any,
  ): Promise<void> {
    let y = 30;

    // Header izquierdo + Cuadro derecho
    const afterHeader = await this.drawHeaderAndTaxBox(doc, creditNote, company, y);
    y = afterHeader + 10;

    // Línea separadora
    this.hrule(doc, 40, y, 555);
    y += 10;

    // Info nota de crédito
    y = this.drawCreditNoteInfo(doc, creditNote, y);

    // Info cliente
    y = this.drawCustomerInfo(doc, creditNote.customer, y);

    // Línea separadora
    this.hrule(doc, 40, y, 555);
    y += 10;

    // Detalle
    y = await this.drawItemsTable(doc, creditNote.items || [], y);

    // Info adicional + Forma de pago (izq) || Subtotales + Total (der)
    y = this.drawAdditionalInfoAndTotals(doc, creditNote, y);
  }

  // ========================= Bloques de dibujo =========================

  /**
   * Header: Logo arriba, luego info empresa (izquierda) + cuadro tributario (derecha)
   */
  private async drawHeaderAndTaxBox(
    doc: PDFKit.PDFDocument,
    creditNote: any,
    company: any,
    startY: number,
  ): Promise<number> {
    const leftX = 40;
    const rightX = 330;
    const boxW = 225;
    let leftY = startY;

    // ========== IZQUIERDA: LOGO Y DATOS EMPRESA ==========

    // Logo primero (descargado desde R2)
    if (company.logoPath) {
      try {
        const logoData = await this.r2Storage.downloadLogo(company.logoPath);
        doc.image(logoData.buffer, leftX, leftY, {
          fit: [120, 70],
          align: 'center',
        });
        leftY += 75; // Espacio después del logo
      } catch (error) {
        this.logger.warn('⚠️ Error al descargar logo desde R2:', error);
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

    // NOTA DE CRÉDITO
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('NOTA DE CRÉDITO', rightX, boxY, { width: boxW, align: 'center' });
    boxY += 18;

    // Número
    const creditNoteNumber = `${this.pad(creditNote.establishmentCode)}-${this.pad(
      creditNote.emissionPointCode,
    )}-${this.pad(creditNote.sequential)}`;
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(creditNoteNumber, rightX, boxY, { width: boxW, align: 'center' });
    boxY += 18;

    // Número de autorización
    doc
      .fontSize(7)
      .font('Helvetica-Bold')
      .text('NÚMERO DE AUTORIZACIÓN', rightX + 10, boxY);
    boxY += 9;

    const authNumber = creditNote.authorizationNumber || creditNote.accessKey;
    doc
      .fontSize(6)
      .font('Helvetica')
      .text(this.pad(authNumber), rightX + 10, boxY, { width: boxW - 20 });
    boxY += 16;

    // Fecha y hora de autorización
    if (creditNote.authorizationDate) {
      doc
        .fontSize(7)
        .font('Helvetica-Bold')
        .text('FECHA Y HORA DE AUTORIZACIÓN:', rightX + 10, boxY);
      boxY += 9;
      doc
        .font('Helvetica')
        .text(
          new Date(creditNote.authorizationDate).toLocaleString('es-EC'),
          rightX + 10,
          boxY,
          { width: boxW - 20 },
        );
      boxY += 12;
    }

    // Ambiente
    const ambiente =
      (creditNote.company?.environment || company.environment) === 'PRODUCTION'
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
      const barcodeBuffer = await this.generateBarcode(creditNote.accessKey);
      doc.image(barcodeBuffer, rightX + 10, boxY, { width: boxW - 20, height: 30 });
      boxY += 32;

      // NÚMERO DEBAJO DEL CÓDIGO DE BARRAS
      doc
        .fontSize(6)
        .font('Helvetica')
        .text(this.pad(creditNote.accessKey), rightX + 10, boxY, {
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
        .text(this.pad(creditNote.accessKey), rightX + 10, boxY, { width: boxW - 20 });
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
   * Información de la nota de crédito
   */
  private drawCreditNoteInfo(doc: PDFKit.PDFDocument, creditNote: any, y: number): number {
    doc.fontSize(8).font('Helvetica-Bold');

    // Razón Social / Nombres
    doc.text('Razón Social / Nombres y Apellidos:', 40, y);

    const customerName =
      creditNote.customer?.businessName ||
      `${this.pad(creditNote.customer?.firstName)} ${this.pad(creditNote.customer?.lastName)}`.trim();

    doc.font('Helvetica').text(customerName, 200, y, { width: 300 });

    // Identificación
    const idType =
      creditNote.customer?.identificationType === '04'
        ? 'RUC'
        : creditNote.customer?.identificationType === '05'
          ? 'Cédula'
          : 'Pasaporte';

    doc.font('Helvetica-Bold').text(`${idType}:`, 40, y + 12);
    doc.font('Helvetica').text(this.pad(creditNote.customer?.identification), 200, y + 12);

    // Fecha de emisión
    doc.font('Helvetica-Bold').text('Fecha de Emisión:', 40, y + 24);
    doc
      .font('Helvetica')
      .text(new Date(creditNote.issueDate).toLocaleDateString('es-EC'), 200, y + 24);

    // Comprobante que se modifica
    doc.font('Helvetica-Bold').text('Comprobante que se modifica:', 40, y + 36);
    doc.font('Helvetica').text(`FACTURA ${this.pad(creditNote.modifiedNumber)}`, 200, y + 36);

    // Motivo
    doc.font('Helvetica-Bold').text('Motivo:', 40, y + 48);
    const motivoHeight = this.getTextHeight(doc, this.pad(creditNote.reason), 350);
    doc.font('Helvetica').text(this.pad(creditNote.reason), 200, y + 48, { width: 350 });

    return y + 48 + Math.max(10, motivoHeight) + 12;
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
   * Información adicional + Totales (derecha)
   */
  private drawAdditionalInfoAndTotals(
    doc: PDFKit.PDFDocument,
    creditNote: any,
    y: number,
  ): number {
    const leftX = 40;
    const rightX = 320;
    const startY = y;

    let leftY = startY;
    let rightY = startY;

    // ========== IZQUIERDA: INFORMACIÓN ADICIONAL ==========
    if (creditNote.customer?.email || creditNote.customer?.phone) {
      doc.fontSize(8).font('Helvetica-Bold').text('Información Adicional', leftX, leftY);
      leftY += 12;

      doc.fontSize(7).font('Helvetica');

      if (creditNote.customer?.email) {
        doc.text(`Email: ${this.pad(creditNote.customer.email)}`, leftX, leftY, { width: 250 });
        leftY += 10;
      }

      if (creditNote.customer?.phone) {
        doc.text(`Teléfono: ${this.pad(creditNote.customer.phone)}`, leftX, leftY, {
          width: 250,
        });
        leftY += 10;
      }
    }

    // ========== DERECHA: SUBTOTALES ==========
    const labelX = rightX;
    const valueX = 485;
    const valueW = 70;

    doc.fontSize(7).font('Helvetica');

    const addRow = (label: string, value: number) => {
      doc.text(label, labelX, rightY, { width: 160 });
      doc.text(this.money(value), valueX, rightY, { width: valueW, align: 'right' });
      rightY += 10;
    };

    // Subtotales por tarifa IVA (si aplican)
    if (creditNote.subtotal15) addRow('SUBTOTAL 15%', creditNote.subtotal15);
    if (creditNote.subtotal5) addRow('SUBTOTAL 5%', creditNote.subtotal5);
    if (creditNote.subtotal0) addRow('SUBTOTAL 0%', creditNote.subtotal0);
    if (creditNote.subtotalNoObjeto)
      addRow('SUBTOTAL NO OBJETO DE IVA', creditNote.subtotalNoObjeto);
    if (creditNote.subtotalExento) addRow('SUBTOTAL EXENTO DE IVA', creditNote.subtotalExento);

    addRow('SUBTOTAL SIN IMPUESTOS', creditNote.subtotal || 0);

    if (creditNote.totalDiscount) addRow('TOTAL DESCUENTO', creditNote.totalDiscount);
    if (creditNote.iceValue) addRow('ICE', creditNote.iceValue);
    if (creditNote.irbpnrValue) addRow('IRBPNR', creditNote.irbpnrValue);

    if (creditNote.iva5Value) addRow('IVA 5%', creditNote.iva5Value);
    addRow('IVA 15%', creditNote.ivaValue || 0);

    if (creditNote.tip) addRow('PROPINA', creditNote.tip);

    rightY += 2;

    // ========== DERECHA: LÍNEA Y TOTAL ==========
    this.hrule(doc, labelX, rightY, valueX + valueW);
    rightY += 8;

    // VALOR TOTAL
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('VALOR TOTAL', labelX, rightY, { width: 160 });
    doc.text(this.money(creditNote.total), valueX, rightY, { width: valueW, align: 'right' });
    rightY += 15;

    // Retornar la Y más baja de ambas columnas
    return Math.max(leftY, rightY) + 10;
  }
}
