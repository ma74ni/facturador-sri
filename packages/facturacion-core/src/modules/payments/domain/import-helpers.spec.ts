import { mapWithConcurrency } from '../../../shared/async/map-with-concurrency';
import { inferIdentificationType } from '../../customers/domain/identification-type';
import { contactData, missingContact, newestFirst } from './buyer-contact';
import { parseDdMmYyyy, parseIsoDate } from './import-dates';

describe('Piezas de la importación histórica', () => {
  describe('fechas', () => {
    it('lee dd/mm/aaaa del export del SRI como medianoche UTC', () => {
      expect(parseDdMmYyyy('27/02/2026')?.toISOString()).toBe('2026-02-27T00:00:00.000Z');
    });

    it.each([['2026-02-27'], ['27-02-2026'], [''], [undefined]])(
      '"%s" no es dd/mm/aaaa',
      (value) => {
        expect(parseDdMmYyyy(value)).toBeNull();
      },
    );

    it('lee fechas ISO y rechaza texto', () => {
      expect(parseIsoDate('2026-02-27')?.toISOString()).toBe('2026-02-27T00:00:00.000Z');
      expect(parseIsoDate('ayer')).toBeNull();
      expect(parseIsoDate('  ')).toBeNull();
    });
  });

  describe('contacto del comprador', () => {
    const buyer = { email: 'a@b.ec', phone: '0999', address: 'Quito' };

    it('para un cliente nuevo usa lo que trae el SRI', () => {
      expect(contactData({ email: 'a@b.ec', phone: null, address: null })).toEqual({
        email: 'a@b.ec',
        phone: undefined,
        address: undefined,
      });
    });

    it('a un cliente existente solo le completa lo vacío', () => {
      expect(missingContact({ email: 'mio@b.ec', phone: ' ', address: null }, buyer)).toEqual({
        phone: '0999',
        address: 'Quito',
      });
    });

    it('ordena de la más reciente a la más vieja sin tocar el original', () => {
      const items = [{ issueDate: new Date('2026-01-01') }, { issueDate: new Date('2026-03-01') }];
      expect(newestFirst(items)[0].issueDate.getUTCMonth()).toBe(2);
      expect(items[0].issueDate.getUTCMonth()).toBe(0);
    });
  });

  it.each([
    ['1790016919001', '04'],
    ['1715758502', '05'],
    ['AB123456', '06'],
  ])('la identificación %s se infiere como %s', (identification, code) => {
    expect(inferIdentificationType(identification)).toBe(code);
  });

  describe('mapWithConcurrency', () => {
    it('respeta el límite, conserva el orden y no corta por un fallo', async () => {
      let running = 0;
      let peak = 0;
      const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 5));
        running--;
        if (n === 3) throw new Error('falla el 3');
        return n * 10;
      });

      expect(peak).toBe(2);
      expect(results).toEqual([
        { ok: true, value: 10 },
        { ok: true, value: 20 },
        { ok: false, error: 'falla el 3' },
        { ok: true, value: 40 },
        { ok: true, value: 50 },
      ]);
    });
  });
});
