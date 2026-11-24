import { chargesVat, saleIvaCode } from './tax-profile';

describe('perfil tributario e IVA', () => {
  it('solo el negocio popular del RIMPE no cobra IVA', () => {
    expect(chargesVat('GENERAL')).toBe(true);
    expect(chargesVat('RIMPE_EMPRENDEDOR')).toBe(true);
    expect(chargesVat('RIMPE_NEGOCIO_POPULAR')).toBe(false);
    expect(chargesVat(undefined)).toBe(true);
  });

  it('un negocio popular vende lo gravado con tarifa 0%', () => {
    expect(saleIvaCode('RIMPE_NEGOCIO_POPULAR', '4')).toBe('0');
    expect(saleIvaCode('RIMPE_NEGOCIO_POPULAR', '5')).toBe('0');
    expect(saleIvaCode('RIMPE_NEGOCIO_POPULAR', '2')).toBe('0');
  });

  it('un negocio popular conserva lo no objeto y lo exento', () => {
    expect(saleIvaCode('RIMPE_NEGOCIO_POPULAR', '0')).toBe('0');
    expect(saleIvaCode('RIMPE_NEGOCIO_POPULAR', '6')).toBe('6');
    expect(saleIvaCode('RIMPE_NEGOCIO_POPULAR', '7')).toBe('7');
  });

  it('los demás regímenes usan la tarifa de la línea', () => {
    expect(saleIvaCode('GENERAL', '4')).toBe('4');
    expect(saleIvaCode('RIMPE_EMPRENDEDOR', '5')).toBe('5');
  });
});
