import { readSriAuthorizedInvoice } from './sri-authorized-invoice';

function factura(infoFactura: string, infoAdicional = '') {
  return `<?xml version="1.0" encoding="UTF-8"?><factura id="comprobante" version="1.1.0">
    <infoTributaria><ambiente>2</ambiente></infoTributaria>
    <infoFactura>${infoFactura}</infoFactura>
    <detalles></detalles>
    ${infoAdicional}
  </factura>`;
}

describe('readSriAuthorizedInvoice', () => {
  it('lee comprador, correo e importes de una factura con IVA 0', () => {
    const xml = factura(
      `<razonSocialComprador>ASOCIACION PROCAR</razonSocialComprador>
       <identificacionComprador>1792851432001</identificacionComprador>
       <totalSinImpuestos>165.00</totalSinImpuestos>
       <totalDescuento>0.00</totalDescuento>
       <totalConImpuestos><totalImpuesto><codigo>2</codigo><codigoPorcentaje>0</codigoPorcentaje>
         <baseImponible>165.00</baseImponible><valor>0.00</valor></totalImpuesto></totalConImpuestos>
       <importeTotal>165.00</importeTotal>`,
      '<infoAdicional><campoAdicional nombre="Email">contabilidad@procar.ec</campoAdicional></infoAdicional>',
    );

    expect(readSriAuthorizedInvoice(xml)).toEqual({
      buyer: {
        identification: '1792851432001',
        name: 'ASOCIACION PROCAR',
        address: null,
        email: 'contabilidad@procar.ec',
        phone: null,
      },
      subtotal: 165,
      totalDiscount: 0,
      ivaValue: 0,
      total: 165,
    });
  });

  it('suma el IVA de varias tarifas y deja fuera otros impuestos', () => {
    const xml = factura(
      `<identificacionComprador>0102030405</identificacionComprador>
       <totalSinImpuestos>200.00</totalSinImpuestos>
       <totalDescuento>5.00</totalDescuento>
       <totalConImpuestos>
         <totalImpuesto><codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje><valor>15.00</valor></totalImpuesto>
         <totalImpuesto><codigo>2</codigo><codigoPorcentaje>0</codigoPorcentaje><valor>0.00</valor></totalImpuesto>
         <totalImpuesto><codigo>3</codigo><codigoPorcentaje>3011</codigoPorcentaje><valor>7.50</valor></totalImpuesto>
       </totalConImpuestos>
       <importeTotal>222.50</importeTotal>`,
    );

    const invoice = readSriAuthorizedInvoice(xml);
    expect(invoice.ivaValue).toBe(15);
    expect(invoice.totalDiscount).toBe(5);
    expect(invoice.total).toBe(222.5);
    expect(invoice.buyer.identification).toBe('0102030405'); // sin perder el cero
  });

  it('toma dirección, teléfono y el primer correo aunque los nombres varíen', () => {
    const xml = factura(
      `<identificacionComprador>1793207110001</identificacionComprador>
       <direccionComprador>Av. Amazonas N34-12</direccionComprador>
       <totalSinImpuestos>10</totalSinImpuestos><importeTotal>10</importeTotal>`,
      `<infoAdicional>
         <campoAdicional nombre="Teléfono">0991234567</campoAdicional>
         <campoAdicional nombre="Correo">pagos@alimag.ec; gerencia@alimag.ec</campoAdicional>
       </infoAdicional>`,
    );

    const { buyer } = readSriAuthorizedInvoice(xml);
    expect(buyer.address).toBe('Av. Amazonas N34-12');
    expect(buyer.phone).toBe('0991234567');
    expect(buyer.email).toBe('pagos@alimag.ec');
  });

  it('usa la dirección de infoAdicional si falta direccionComprador', () => {
    const xml = factura(
      '<identificacionComprador>1793207110001</identificacionComprador><importeTotal>1</importeTotal>',
      '<infoAdicional><campoAdicional nombre="Dirección">Calle 1</campoAdicional></infoAdicional>',
    );
    expect(readSriAuthorizedInvoice(xml).buyer.address).toBe('Calle 1');
  });

  it('rechaza un comprobante que no es factura', () => {
    expect(() => readSriAuthorizedInvoice('<notaCredito><infoNotaCredito/></notaCredito>')).toThrow(
      'no es una factura',
    );
  });
});
