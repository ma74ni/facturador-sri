import { SRIStatus } from '@prisma/client';
import { availableForCreditNote, exceedsAvailable } from './credit-note-limit';

describe('credit-note-limit', () => {
  it('sin notas previas, todo el total de la factura está disponible', () => {
    expect(availableForCreditNote(100, [])).toBeCloseTo(100);
  });

  it('las notas pendientes y autorizadas consumen cupo; rechazadas y canceladas no', () => {
    const available = availableForCreditNote(100, [
      { total: 30, sriStatus: SRIStatus.AUTHORIZED },
      { total: 20, sriStatus: SRIStatus.PENDING },
      { total: 10, sriStatus: SRIStatus.ERROR },
      { total: 50, sriStatus: SRIStatus.REJECTED },
      { total: 50, sriStatus: SRIStatus.CANCELLED },
    ]);
    expect(available).toBeCloseTo(40);
  });

  it('una factura de $100 no acepta tres notas de $100', () => {
    const notes = [{ total: 100, sriStatus: SRIStatus.AUTHORIZED }];
    const available = availableForCreditNote(100, notes);
    expect(available).toBe(0);
    expect(exceedsAvailable(100, available)).toBe(true);
  });

  it('tolera un centavo de redondeo', () => {
    expect(exceedsAvailable(40.005, 40)).toBe(false);
    expect(exceedsAvailable(40.02, 40)).toBe(true);
  });

  it('nunca devuelve un cupo negativo', () => {
    expect(availableForCreditNote(10, [{ total: 15, sriStatus: SRIStatus.AUTHORIZED }])).toBe(0);
  });
});
