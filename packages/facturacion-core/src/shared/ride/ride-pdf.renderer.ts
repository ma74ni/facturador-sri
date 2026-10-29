import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as bwipjs from 'bwip-js';
import { ivaSubtotalLabel, IvaTreatment } from '../../modules/tax-codes/domain/iva-rate.catalog';
import { TaxCalculatorService } from '../../modules/tax-codes/domain/services/tax-calculator.service';
import { RideDocument, RideItem } from './ride-document';

type Doc = PDFKit.PDFDocument;

// Página A4 y márgenes (puntos).
const PAGE_TOP = 30;
const PAGE_BOTTOM = 842 - 30;
const LEFT = 40;
const RIGHT = 555;
const WIDTH = RIGHT - LEFT;

const GAP = 10;
const RADIUS = 6;
const PAD = 8;
const BORDER = '#000000';
const HEADER_FILL = '#eeeeee';
const MISSING_LOGO_COLOR = '#e00000';

const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';

/** Columnas del detalle; la descripción toma el ancho que sobra. */
const ITEM_COLUMNS = [
  { key: 'code', label: 'Cod. Principal', width: 65, align: 'left' },
  { key: 'quantity', label: 'Cant.', width: 50, align: 'right' },
  { key: 'description', label: 'Descripción', width: 0, align: 'left' },
  { key: 'unitPrice', label: 'Precio Unitario', width: 70, align: 'right' },
  { key: 'discount', label: 'Descuento', width: 60, align: 'right' },
  { key: 'total', label: 'Precio Total', width: 70, align: 'right' },
] as const;

const ECUADOR_TZ = 'America/Guayaquil';
const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Dibuja el RIDE (representación impresa) de cualquier comprobante electrónico.
 * No sabe de R2 ni de Prisma: recibe el comprobante ya traducido y el logo, y devuelve el PDF.
 *
 * Diseño: logo (o "NO TIENE LOGO") y datos del emisor a la izquierda, cuadro tributario a la
 * derecha, comprador, detalle y, abajo, información adicional + forma de pago junto a los totales.
 */
@Injectable()
export class RidePdfRenderer {
  private readonly logger = new Logger(RidePdfRenderer.name);

  constructor(private readonly taxCalculator: TaxCalculatorService) {}

  render(document: RideDocument, logo: Buffer | null): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: PAGE_TOP, bottom: 30, left: LEFT, right: 40 },
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

  // ========================= Formatos =========================

  private text(value: unknown): string {
    return (value ?? '').toString().trim();
  }

  /** `$1,200.00` */
  private money(value: unknown): string {
    const amount = Number(value || 0);
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /** Cantidades: al menos 2 decimales, hasta 6 si los tiene. */
  private quantity(value: unknown): string {
    return Number(value ?? 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  }

  /** Fecha de emisión: se guarda como fecha sin hora (medianoche UTC). */
  private date(value: Date | string): string {
    const d = new Date(value);
    return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  }

  /** Fecha y hora de autorización en hora de Ecuador, sin importar dónde corra el servidor. */
  private dateTime(value: Date | string): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: ECUADOR_TZ,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(value));
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
    return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
  }

  // ========================= Primitivas =========================

  private roundedBox(doc: Doc, x: number, y: number, w: number, h: number): void {
    doc.lineWidth(0.8).roundedRect(x, y, w, h, RADIUS).stroke(BORDER);
  }

  private cell(doc: Doc, x: number, y: number, w: number, h: number, fill?: string): void {
    doc.lineWidth(0.5);
    if (fill) doc.rect(x, y, w, h).fillAndStroke(fill, BORDER);
    else doc.rect(x, y, w, h).stroke(BORDER);
    doc.fillColor('#000000');
  }

  /** Etiqueta en negrita y valor a su derecha; devuelve la altura usada. */
  private labeled(
    doc: Doc,
    label: string,
    value: string,
    x: number,
    y: number,
    labelWidth: number,
    valueWidth: number,
    size = 8,
  ): number {
    doc.fontSize(size).font(FONT_BOLD);
    const labelHeight = doc.heightOfString(label, { width: labelWidth });
    doc.text(label, x, y, { width: labelWidth });
    doc.font(FONT);
    const valueHeight = doc.heightOfString(value || ' ', { width: valueWidth });
    doc.text(value, x + labelWidth, y, { width: valueWidth });
    return Math.max(labelHeight, valueHeight);
  }

  /** Salta de página si lo que sigue no entra; devuelve la Y donde dibujar. */
  private ensureSpace(doc: Doc, y: number, needed: number): number {
    if (y + needed <= PAGE_BOTTOM) return y;
    doc.addPage();
    return PAGE_TOP;
  }

  // ========================= Layout =========================

  private async drawContent(doc: Doc, document: RideDocument, logo: Buffer | null): Promise<void> {
    let y = await this.drawHeader(doc, document, logo, PAGE_TOP);
    y = this.drawBuyer(doc, document, y + GAP);
    y = this.drawItems(doc, document.items, y + GAP);
    this.drawFooter(doc, document, y + GAP);
  }

  /** Logo y emisor (izquierda) + cuadro tributario (derecha), ambos hasta la misma altura. */
  private async drawHeader(
    doc: Doc,
    document: RideDocument,
    logo: Buffer | null,
    top: number,
  ): Promise<number> {
    const leftW = 255;
    const rightX = LEFT + leftW + GAP;
    const rightW = RIGHT - rightX;
    const logoH = 80;

    // ---- Logo o aviso ----
    let hasLogo = false;
    if (logo) {
      try {
        doc.image(logo, LEFT, top, { fit: [leftW, logoH], align: 'center', valign: 'center' });
        hasLogo = true;
      } catch (error) {
        this.logger.warn('⚠️ Logo inválido, el RIDE sale sin logo:', error);
      }
    }
    if (!hasLogo) {
      doc
        .fontSize(20)
        .font(FONT_BOLD)
        .fillColor(MISSING_LOGO_COLOR)
        .text('NO TIENE LOGO', LEFT, top + logoH / 2 - 10, { width: leftW, align: 'center' });
      doc.fillColor('#000000');
    }

    // ---- Emisor ----
    const { issuer } = document;
    const issuerTop = top + logoH + GAP;
    const innerX = LEFT + PAD;
    const innerW = leftW - 2 * PAD;
    let ly = issuerTop + PAD;

    doc.fontSize(9).font(FONT_BOLD);
    doc.text(this.text(issuer.businessName), innerX, ly, { width: innerW });
    ly += doc.heightOfString(this.text(issuer.businessName) || ' ', { width: innerW }) + 4;

    if (issuer.tradeName && issuer.tradeName !== issuer.businessName) {
      doc.fontSize(8).font(FONT);
      doc.text(this.text(issuer.tradeName), innerX, ly, { width: innerW });
      ly += doc.heightOfString(this.text(issuer.tradeName), { width: innerW }) + 6;
    }

    const labelW = 70;
    ly +=
      this.labeled(
        doc,
        'Dirección Matriz:',
        this.text(issuer.address),
        innerX,
        ly,
        labelW,
        innerW - labelW,
        7,
      ) + 6;
    if (issuer.branchAddress) {
      ly +=
        this.labeled(
          doc,
          'Dirección Sucursal:',
          this.text(issuer.branchAddress),
          innerX,
          ly,
          labelW,
          innerW - labelW,
          7,
        ) + 6;
    }
    if (issuer.specialTaxpayer) {
      ly +=
        this.labeled(
          doc,
          'Contribuyente Especial Nro.:',
          this.text(issuer.specialTaxpayer),
          innerX,
          ly,
          115,
          innerW - 115,
          7,
        ) + 6;
    }
    const obligado = issuer.accountingRequired !== false ? 'SI' : 'NO';
    ly += this.labeled(
      doc,
      'OBLIGADO A LLEVAR CONTABILIDAD:',
      obligado,
      innerX,
      ly,
      145,
      innerW - 145,
      7,
    );
    const leftBottom = ly + PAD;

    // ---- Cuadro tributario ----
    const rx = rightX + PAD;
    const rw = rightW - 2 * PAD;
    let ry = top + PAD;

    doc
      .fontSize(10)
      .font(FONT_BOLD)
      .text('R.U.C.:', rx, ry + 2, { width: 50 });
    doc
      .fontSize(12)
      .font(FONT)
      .text(this.text(issuer.ruc), rx + 50, ry, { width: rw - 50 });
    ry += 20;

    doc.fontSize(14).font(FONT_BOLD).text(document.title, rx, ry, { width: rw });
    ry += 20;

    const number = `${this.text(document.establishmentCode)}-${this.text(
      document.emissionPointCode,
    )}-${this.text(document.sequential)}`;
    ry += this.labeled(doc, 'No.', number, rx, ry, 25, rw - 25, 9) + 8;

    doc.fontSize(8).font(FONT_BOLD).text('NÚMERO DE AUTORIZACIÓN', rx, ry, { width: rw });
    ry += 11;
    doc
      .fontSize(7)
      .font(FONT)
      .text(this.text(document.authorizationNumber || document.accessKey), rx, ry, { width: rw });
    ry += 14;

    if (document.authorizationDate) {
      ry +=
        this.labeled(
          doc,
          'FECHA Y HORA DE AUTORIZACIÓN:',
          this.dateTime(document.authorizationDate),
          rx,
          ry,
          95,
          rw - 95,
          8,
        ) + 6;
    }

    const environment = document.environment === 'PRODUCTION' ? 'PRODUCCIÓN' : 'PRUEBAS';
    ry += this.labeled(doc, 'AMBIENTE:', environment, rx, ry, 95, rw - 95, 8) + 6;
    ry += this.labeled(doc, 'EMISIÓN:', 'NORMAL', rx, ry, 95, rw - 95, 8) + 8;

    doc.fontSize(8).font(FONT_BOLD).text('CLAVE DE ACCESO', rx, ry, { width: rw });
    ry += 11;
    try {
      const barcode = await this.generateBarcode(document.accessKey);
      doc.image(barcode, rx, ry, { width: rw, height: 34 });
      ry += 36;
    } catch (error) {
      this.logger.warn('⚠️ Error generando código de barras:', error);
    }
    doc
      .fontSize(7)
      .font(FONT)
      .text(this.text(document.accessKey), rx, ry, { width: rw, align: 'center' });
    ry += 10;
    const rightBottom = ry + PAD;

    // Los dos lados terminan a la misma altura.
    const bottom = Math.max(leftBottom, rightBottom);
    this.roundedBox(doc, LEFT, issuerTop, leftW, bottom - issuerTop);
    this.roundedBox(doc, rightX, top, rightW, bottom - top);
    return bottom;
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
  private drawBuyer(doc: Doc, document: RideDocument, top: number): number {
    const { customer } = document;
    const x = LEFT + PAD;
    const w = WIDTH - 2 * PAD;
    const half = w / 2;
    let y = top + PAD;

    const name =
      customer?.businessName ||
      `${this.text(customer?.firstName)} ${this.text(customer?.lastName)}`.trim();
    y += this.labeled(doc, 'Razón Social / Nombres y Apellidos:', name, x, y, 160, w - 160) + 5;

    const idHeight = this.labeled(
      doc,
      'Identificación:',
      this.text(customer?.identification),
      x,
      y,
      160,
      half - 160,
    );
    const dateHeight = this.labeled(
      doc,
      'Fecha Emisión:',
      this.date(document.issueDate),
      x + half,
      y,
      75,
      half - 75,
    );
    y += Math.max(idHeight, dateHeight) + 5;

    if (customer?.address) {
      y += this.labeled(doc, 'Dirección:', this.text(customer.address), x, y, 160, w - 160) + 5;
    }

    const modified = document.modifiedDocument;
    if (modified) {
      y += 2;
      doc
        .lineWidth(0.5)
        .moveTo(x, y)
        .lineTo(x + w, y)
        .stroke(BORDER);
      y += 7;
      y +=
        this.labeled(
          doc,
          'Comprobante que se modifica:',
          `${modified.type} ${this.text(modified.number)}`,
          x,
          y,
          160,
          w - 160,
        ) + 5;
      y +=
        this.labeled(
          doc,
          'Razón de Modificación:',
          this.text(modified.reason),
          x,
          y,
          160,
          w - 160,
        ) + 5;
    }

    const bottom = y - 5 + PAD;
    this.roundedBox(doc, LEFT, top, WIDTH, bottom - top);
    return bottom;
  }

  /** Detalle con filas de altura variable; repite el encabezado al cambiar de página. */
  private drawItems(doc: Doc, items: RideItem[], top: number): number {
    const fixed = ITEM_COLUMNS.reduce((sum, col) => sum + col.width, 0);
    let cx = LEFT;
    const columns = ITEM_COLUMNS.map((col) => {
      const width = col.width || WIDTH - fixed;
      const placed = { ...col, x: cx, width };
      cx += width;
      return placed;
    });

    const headerH = 22;
    const drawHeaderRow = (y: number) => {
      doc.fontSize(7.5).font(FONT_BOLD);
      for (const col of columns) {
        this.cell(doc, col.x, y, col.width, headerH, HEADER_FILL);
        doc.text(col.label, col.x + 3, y + 4, { width: col.width - 6, align: 'center' });
      }
      return y + headerH;
    };

    let y = drawHeaderRow(this.ensureSpace(doc, top, headerH + 16));

    for (const item of items) {
      const values: Record<(typeof ITEM_COLUMNS)[number]['key'], string> = {
        code: this.text(item.mainCode || item.code),
        quantity: this.quantity(item.quantity),
        description: this.text(item.description),
        unitPrice: this.money(item.unitPrice),
        discount: this.money(item.discount),
        total: this.money(
          item.subtotal ??
            Number(item.quantity || 0) * Number(item.unitPrice || 0) - Number(item.discount || 0),
        ),
      };

      doc.fontSize(7.5).font(FONT);
      const rowH = Math.max(
        16,
        ...columns.map(
          (col) => doc.heightOfString(values[col.key] || ' ', { width: col.width - 6 }) + 8,
        ),
      );

      if (y + rowH > PAGE_BOTTOM) {
        doc.addPage();
        y = drawHeaderRow(PAGE_TOP);
        doc.fontSize(7.5).font(FONT);
      }

      for (const col of columns) {
        this.cell(doc, col.x, y, col.width, rowH);
        doc.text(values[col.key], col.x + 3, y + 4, { width: col.width - 6, align: col.align });
      }
      y += rowH;
    }

    return y;
  }

  /** Información adicional + forma de pago (izquierda) || totales (derecha). */
  private drawFooter(doc: Doc, document: RideDocument, top: number): void {
    const rows = this.totalRows(document);
    const rowH = 15;
    const totalsH = rows.length * rowH;

    const infoRows = [
      ['Email', this.text(document.customer?.email)],
      ['Teléfono', this.text(document.customer?.phone)],
    ].filter(([, value]) => value);
    const infoH = infoRows.length ? 18 + infoRows.length * 14 + 4 : 0;
    const paymentH = document.payment ? 18 + 24 : 0;

    const needed = Math.max(totalsH, infoH + (infoH && paymentH ? GAP : 0) + paymentH);
    const y0 = this.ensureSpace(doc, top, needed);

    // ---- Derecha: totales ----
    const tw = 225;
    const tx = RIGHT - tw;
    const valueW = 75;
    let ty = y0;
    for (const [label, value, bold] of rows) {
      this.cell(doc, tx, ty, tw - valueW, rowH);
      this.cell(doc, tx + tw - valueW, ty, valueW, rowH);
      doc.fontSize(bold ? 8.5 : 7.5).font(bold ? FONT_BOLD : FONT);
      doc.text(label, tx + 4, ty + 4, { width: tw - valueW - 8 });
      doc.text(this.money(value), tx + tw - valueW + 3, ty + 4, {
        width: valueW - 7,
        align: 'right',
      });
      ty += rowH;
    }

    // ---- Izquierda: información adicional ----
    const lw = tx - LEFT - GAP;
    let ly = y0;
    if (infoRows.length) {
      const boxTop = ly;
      doc
        .fontSize(8)
        .font(FONT_BOLD)
        .text('Información Adicional', LEFT, ly + 6, { width: lw, align: 'center' });
      ly += 18;
      doc
        .lineWidth(0.5)
        .moveTo(LEFT, ly)
        .lineTo(LEFT + lw, ly)
        .stroke(BORDER);
      ly += 4;
      for (const [label, value] of infoRows) {
        this.labeled(doc, `${label}:`, value, LEFT + PAD, ly, 50, lw - 50 - 2 * PAD, 7.5);
        ly += 14;
      }
      this.roundedBox(doc, LEFT, boxTop, lw, ly - boxTop + 4);
      ly += 4 + GAP;
    }

    // ---- Izquierda: forma de pago ----
    if (document.payment) {
      const valueColW = 75;
      const methodW = lw - valueColW;
      doc.fontSize(7.5).font(FONT_BOLD);
      this.cell(doc, LEFT, ly, methodW, 18, HEADER_FILL);
      this.cell(doc, LEFT + methodW, ly, valueColW, 18, HEADER_FILL);
      doc.text('Forma de Pago', LEFT + 3, ly + 5, { width: methodW - 6, align: 'center' });
      doc.text('Valor', LEFT + methodW + 3, ly + 5, { width: valueColW - 6, align: 'center' });
      ly += 18;

      const method = this.text(document.payment.method) || 'SIN UTILIZACION DEL SISTEMA FINANCIERO';
      doc.font(FONT);
      const methodH = Math.max(24, doc.heightOfString(method, { width: methodW - 6 }) + 8);
      this.cell(doc, LEFT, ly, methodW, methodH);
      this.cell(doc, LEFT + methodW, ly, valueColW, methodH);
      doc.text(method, LEFT + 3, ly + 4, { width: methodW - 6 });
      doc.text(this.money(document.total), LEFT + methodW + 3, ly + 4, {
        width: valueColW - 7,
        align: 'right',
      });
    }
  }

  /** Filas de totales en el orden del SRI; solo las que tienen valor, más el total. */
  private totalRows(document: RideDocument): Array<[string, unknown, boolean?]> {
    const taxes = this.taxCalculator.summarize(document.items);
    const rows: Array<[string, unknown, boolean?]> = [];

    for (const group of taxes.groups) {
      rows.push([ivaSubtotalLabel(group), group.taxBase.toNumber()]);
    }
    rows.push(['SUBTOTAL SIN IMPUESTOS', taxes.totalWithoutTaxes.toNumber()]);
    if (taxes.totalDiscount.gt(0)) rows.push(['TOTAL DESCUENTO', taxes.totalDiscount.toNumber()]);
    if (Number(document.iceValue || 0) > 0) rows.push(['ICE', document.iceValue]);

    const taxed = taxes.groups.filter((group) => group.treatment === IvaTreatment.TAXED);
    for (const group of taxed) {
      rows.push([`IVA ${group.percentage}%`, group.ivaValue.toNumber()]);
    }

    if (Number(document.irbpnrValue || 0) > 0) rows.push(['IRBPNR', document.irbpnrValue]);
    if (Number(document.tip || 0) > 0) rows.push(['PROPINA', document.tip]);
    rows.push(['VALOR TOTAL', document.total, true]);
    return rows;
  }
}
