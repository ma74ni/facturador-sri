import { assertValidNextSequence, InvalidSequenceError, minimumNextSequence } from './emission-sequence';

describe('emission-sequence', () => {
  it('sin nada emitido en producción arranca en 1', () => {
    expect(minimumNextSequence(null)).toBe(1);
    expect(() => assertValidNextSequence('invoice', 1, null)).not.toThrow();
  });

  it('permite continuar la numeración de otro sistema', () => {
    expect(() => assertValidNextSequence('invoice', 1235, null)).not.toThrow();
  });

  it('no deja repetir un número ya emitido en producción', () => {
    expect(minimumNextSequence(44)).toBe(45);
    expect(() => assertValidNextSequence('invoice', 44, 44)).toThrow(InvalidSequenceError);
    expect(() => assertValidNextSequence('creditNote', 10, 44)).toThrow(
      'Ya se emitió en producción hasta el 44 de notas de crédito: el siguiente debe ser 45 o mayor',
    );
    expect(() => assertValidNextSequence('invoice', 45, 44)).not.toThrow();
  });

  it.each([0, -1, 1.5, 1_000_000_000])('rechaza %p', (next) => {
    expect(() => assertValidNextSequence('invoice', next, null)).toThrow(InvalidSequenceError);
  });
});
