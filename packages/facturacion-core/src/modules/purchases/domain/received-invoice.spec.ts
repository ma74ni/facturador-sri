import { readReceivedInvoice } from './received-invoice';

/*
 * Facturas armadas con la estructura de la ficha técnica (versiones 1.1.0 y 2.1.0), con datos
 * inventados: RUCs, nombres y claves no son de nadie. El SRI devuelve el XML firmado; la firma no
 * se lee, pero va para comprobar que no estorba.
 */
const SIGNATURE =
  '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="S1"><ds:SignedInfo/></ds:Signature>';

function invoiceXml(version: string, infoFactura: string, detalles: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="${version}">
  <infoTributaria>
    <ambiente>2</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>DISTRIBUIDORA ANDINA S.A.</razonSocial>
    <nombreComercial>ANDINA</nombreComercial>
    <ruc>0990000001001</ruc>
    <claveAcceso>2510202601099000000100120010020000456781234567811</claveAcceso>
    <codDoc>01</codDoc>
    <estab>001</estab>
    <ptoEmi>002</ptoEmi>
    <secuencial>000045678</secuencial>
    <dirMatriz>Av. Siempre Viva 123</dirMatriz>
  </infoTributaria>
  <infoFactura>
    <fechaEmision>25/10/2026</fechaEmision>
    <obligadoContabilidad>SI</obligadoContabilidad>
    <tipoIdentificacionComprador>04</tipoIdentificacionComprador>
    <razonSocialComprador>EMPRESA COMPRADORA</razonSocialComprador>
    <identificacionComprador>1790000002001</identificacionComprador>
    ${infoFactura}
  </infoFactura>
  <detalles>${detalles}</detalles>
  ${SIGNATURE}
</factura>`;
}

const detalle = (description: string, total: string, discount = '0.00') => `
  <detalle>
    <codigoPrincipal>P1</codigoPrincipal>
    <descripcion>${description}</descripcion>
    <cantidad>2.000000</cantidad>
    <precioUnitario>${(Number(total) / 2).toFixed(6)}</precioUnitario>
    <descuento>${discount}</descuento>
    <precioTotalSinImpuesto>${total}</precioTotalSinImpuesto>
    <impuestos><impuesto><codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje>
      <tarifa>15</tarifa><baseImponible>${total}</baseImponible><valorg>0</valorg></impuesto></impuestos>
  </detalle>`;

describe('factura recibida del SRI', () => {
  it('lee una factura 1.1.0 con una tarifa, propina y un pago', () => {
    const xml = invoiceXml(
      '1.1.0',
      `<totalSinImpuestos>120.00</totalSinImpuestos>
       <totalDescuento>5.00</totalDescuento>
       <totalConImpuestos>
         <totalImpuesto><codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje>
           <baseImponible>120.00</baseImponible><valor>18.00</valor></totalImpuesto>
       </totalConImpuestos>
       <propina>2.50</propina>
       <importeTotal>140.50</importeTotal>
       <moneda>DOLAR</moneda>
       <pagos><pago><formaPago>20</formaPago><total>140.50</total></pago></pagos>`,
      detalle('Queso fresco', '120.00', '5.00'),
    );

    expect(readReceivedInvoice(xml)).toEqual({
      accessKey: '2510202601099000000100120010020000456781234567811',
      issuer: {
        ruc: '0990000001001',
        businessName: 'DISTRIBUIDORA ANDINA S.A.',
        tradeName: 'ANDINA',
      },
      establishmentCode: '001',
      emissionPointCode: '002',
      sequential: '000045678',
      issueDate: '2026-10-25',
      buyerIdentification: '1790000002001',
      taxes: [{ ivaCode: '4', taxBase: 120, ivaValue: 18 }],
      totalDiscount: 5,
      iceValue: 0,
      otherCharges: 2.5,
      total: 140.5,
      paymentMethodCode: '20',
      items: [{ description: 'Queso fresco', quantity: 2, unitPrice: 60, discount: 5, total: 120 }],
      itemCount: 1,
      warnings: [],
    });
  });

  it('lee una factura 2.1.0 con varias tarifas, ICE y varios pagos', () => {
    const xml = invoiceXml(
      '2.1.0',
      `<totalSinImpuestos>155.50</totalSinImpuestos>
       <totalDescuento>0.00</totalDescuento>
       <totalConImpuestos>
         <totalImpuesto><codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje>
           <baseImponible>130.00</baseImponible><valor>19.50</valor></totalImpuesto>
         <totalImpuesto><codigo>2</codigo><codigoPorcentaje>0</codigoPorcentaje>
           <baseImponible>35.50</baseImponible><valor>0.00</valor></totalImpuesto>
         <totalImpuesto><codigo>3</codigo><codigoPorcentaje>3011</codigoPorcentaje>
           <baseImponible>120.00</baseImponible><valor>10.00</valor></totalImpuesto>
       </totalConImpuestos>
       <propina>0.00</propina>
       <importeTotal>185.00</importeTotal>
       <pagos>
         <pago><formaPago>01</formaPago><total>15.00</total></pago>
         <pago><formaPago>19</formaPago><total>170.00</total><plazo>30</plazo></pago>
       </pagos>`,
      detalle('Gaseosa', '120.00') + detalle('Pan', '35.50'),
    );

    const invoice = readReceivedInvoice(xml);
    // La base del 15 % llega con el ICE adentro (130 = 120 + 10); se guarda sin él.
    expect(invoice.taxes).toEqual([
      { ivaCode: '4', taxBase: 120, ivaValue: 19.5 },
      { ivaCode: '0', taxBase: 35.5, ivaValue: 0 },
    ]);
    expect(invoice.iceValue).toBe(10);
    expect(invoice.paymentMethodCode).toBe('19');
    expect(invoice.itemCount).toBe(2);
    expect(invoice.warnings).toEqual([]);
  });

  it('con dos tarifas gravadas, resta el ICE de la tarifa de su línea, no de la primera', () => {
    const line = (description: string, total: string, ivaCode: string, ice = '') => `
      <detalle><descripcion>${description}</descripcion><cantidad>1</cantidad>
        <precioUnitario>${total}</precioUnitario><descuento>0</descuento>
        <precioTotalSinImpuesto>${total}</precioTotalSinImpuesto>
        <impuestos>
          ${ice ? `<impuesto><codigo>3</codigo><codigoPorcentaje>3011</codigoPorcentaje><baseImponible>${total}</baseImponible><valor>${ice}</valor></impuesto>` : ''}
          <impuesto><codigo>2</codigo><codigoPorcentaje>${ivaCode}</codigoPorcentaje><baseImponible>0</baseImponible><valor>0</valor></impuesto>
        </impuestos>
      </detalle>`;
    const xml = invoiceXml(
      '2.1.0',
      `<totalSinImpuestos>140.00</totalSinImpuestos>
       <totalConImpuestos>
         <totalImpuesto><codigo>2</codigo><codigoPorcentaje>5</codigoPorcentaje>
           <baseImponible>40.00</baseImponible><valor>2.00</valor></totalImpuesto>
         <totalImpuesto><codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje>
           <baseImponible>110.00</baseImponible><valor>16.50</valor></totalImpuesto>
         <totalImpuesto><codigo>3</codigo><codigoPorcentaje>3011</codigoPorcentaje>
           <baseImponible>100.00</baseImponible><valor>10.00</valor></totalImpuesto>
       </totalConImpuestos>
       <importeTotal>168.50</importeTotal>`,
      line('Cemento', '40.00', '5') + line('Cerveza', '100.00', '4', '10.00'),
    );

    const invoice = readReceivedInvoice(xml);
    expect(invoice.taxes).toEqual([
      { ivaCode: '5', taxBase: 40, ivaValue: 2 },
      { ivaCode: '4', taxBase: 100, ivaValue: 16.5 },
    ]);
    expect(invoice.warnings).toEqual([]);
  });

  it('si no sabe a qué tarifa va el ICE, avisa y no toca las bases', () => {
    const xml = invoiceXml(
      '2.1.0',
      `<totalSinImpuestos>140.00</totalSinImpuestos>
       <totalConImpuestos>
         <totalImpuesto><codigo>2</codigo><codigoPorcentaje>5</codigoPorcentaje>
           <baseImponible>40.00</baseImponible><valor>2.00</valor></totalImpuesto>
         <totalImpuesto><codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje>
           <baseImponible>110.00</baseImponible><valor>16.50</valor></totalImpuesto>
         <totalImpuesto><codigo>3</codigo><codigoPorcentaje>3011</codigoPorcentaje>
           <baseImponible>100.00</baseImponible><valor>10.00</valor></totalImpuesto>
       </totalConImpuestos>
       <importeTotal>168.50</importeTotal>`,
      '',
    );

    const invoice = readReceivedInvoice(xml);
    expect(invoice.taxes.map((tax) => tax.taxBase)).toEqual([40, 110]);
    expect(invoice.warnings).toContain('No se pudo saber a qué tarifa de IVA corresponde el ICE');
  });

  it('avisa el ICE que no tiene una base gravada donde descontarse', () => {
    const xml = invoiceXml(
      '2.1.0',
      `<totalSinImpuestos>10.00</totalSinImpuestos>
       <totalConImpuestos>
         <totalImpuesto><codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje>
           <baseImponible>2.00</baseImponible><valor>0.30</valor></totalImpuesto>
         <totalImpuesto><codigo>3</codigo><codigoPorcentaje>3011</codigoPorcentaje>
           <baseImponible>10.00</baseImponible><valor>5.00</valor></totalImpuesto>
       </totalConImpuestos>
       <importeTotal>15.30</importeTotal>`,
      '',
    );

    expect(readReceivedInvoice(xml).warnings).toContain(
      'El ICE no cabe en la base de la tarifa de IVA con código 4',
    );
  });

  it('suma las líneas repetidas de una misma tarifa', () => {
    const xml = invoiceXml(
      '2.0.0',
      `<totalSinImpuestos>30.00</totalSinImpuestos>
       <totalConImpuestos>
         <totalImpuesto><codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje>
           <baseImponible>10.00</baseImponible><valor>1.50</valor></totalImpuesto>
         <totalImpuesto><codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje>
           <baseImponible>20.00</baseImponible><valor>3.00</valor></totalImpuesto>
       </totalConImpuestos>
       <importeTotal>34.50</importeTotal>`,
      detalle('Harina', '30.00'),
    );
    const invoice = readReceivedInvoice(xml);
    expect(invoice.taxes).toEqual([{ ivaCode: '4', taxBase: 30, ivaValue: 4.5 }]);
    expect(invoice.paymentMethodCode).toBeNull();
  });

  it('avisa lo que no cuadra o no conoce, sin corregirlo', () => {
    const xml = invoiceXml(
      '1.0.0',
      `<totalSinImpuestos>50.00</totalSinImpuestos>
       <totalConImpuestos>
         <totalImpuesto><codigo>2</codigo><codigoPorcentaje>99</codigoPorcentaje>
           <baseImponible>40.00</baseImponible><valor>0.00</valor></totalImpuesto>
         <totalImpuesto><codigo>9</codigo><codigoPorcentaje>1</codigoPorcentaje>
           <baseImponible>40.00</baseImponible><valor>1.00</valor></totalImpuesto>
       </totalConImpuestos>
       <importeTotal>41.00</importeTotal>`,
      '',
    );
    expect(readReceivedInvoice(xml).warnings).toEqual([
      'La tarifa de IVA con código 99 no está en el catálogo',
      'La factura trae un impuesto con código 9 que no se registra',
      'Las bases suman $40.00 y la factura dice $50.00 sin impuestos',
    ]);
  });

  it('rechaza lo que no es una factura', () => {
    expect(() =>
      readReceivedInvoice('<notaCredito><infoTributaria/><infoNotaCredito/></notaCredito>'),
    ).toThrow('El comprobante que devolvió el SRI no es una factura');
    expect(() => readReceivedInvoice('no es xml')).toThrow();
  });

  it('rechaza una factura sin fecha de emisión válida', () => {
    const xml = invoiceXml('1.1.0', '<importeTotal>10.00</importeTotal>', '').replace(
      '<fechaEmision>25/10/2026</fechaEmision>',
      '<fechaEmision>2026-10-25</fechaEmision>',
    );
    expect(() => readReceivedInvoice(xml)).toThrow(
      'La factura del SRI no trae su RUC, número o fecha de emisión',
    );
  });
});
