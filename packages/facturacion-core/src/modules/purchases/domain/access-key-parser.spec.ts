import { AccessKeyService } from '../../invoices/domain/services/access-key.service';
import { module11, normalizeAccessKey, parseAccessKey } from './access-key-parser';

// Claves reales, armadas con el mismo generador que usan las facturas emitidas.
const keyFor = (environment = 'PRODUCTION', documentType = '01') =>
  new AccessKeyService().generateAccessKey(
    new Date('2026-10-25T00:00:00.000Z'),
    documentType,
    '1792146739001',
    environment,
    '001',
    '002',
    '000045678',
  );

describe('clave de acceso de una compra', () => {
  it('separa fecha, tipo, RUC del emisor, ambiente y número', () => {
    const key = keyFor();
    expect(parseAccessKey(key)).toEqual({
      error: null,
      parts: {
        accessKey: key,
        issueDate: '2026-10-25',
        documentType: '01',
        issuerRuc: '1792146739001',
        environment: 'PRODUCTION',
        establishmentCode: '001',
        emissionPointCode: '002',
        sequential: '000045678',
      },
    });
    expect(parseAccessKey(keyFor('TEST')).parts?.environment).toBe('TEST');
  });

  it('acepta la clave pegada con espacios, guiones o saltos de línea', () => {
    const key = keyFor();
    const pasted = `${key.slice(0, 10)} ${key.slice(10, 30)}-\n${key.slice(30)} `;
    expect(normalizeAccessKey(pasted)).toBe(key);
    expect(parseAccessKey(pasted).parts?.accessKey).toBe(key);
  });

  it('avisa cuántos dígitos tiene cuando no son 49', () => {
    expect(parseAccessKey(keyFor().slice(0, 48)).error).toBe(
      'La clave de acceso tiene 49 dígitos y esta tiene 48',
    );
    expect(parseAccessKey('').error).toBe('La clave de acceso solo lleva números');
    expect(parseAccessKey('12345abc').error).toBe('La clave de acceso solo lleva números');
  });

  it('detecta un dígito mal copiado con el verificador', () => {
    const key = keyFor();
    const typo = key.slice(0, 20) + ((Number(key[20]) + 1) % 10) + key.slice(21);
    expect(parseAccessKey(typo).error).toBe(
      'El último dígito no cuadra: revisa si copiaste bien la clave',
    );
  });

  it('rechaza una fecha imposible aunque el verificador cuadre', () => {
    const body = '3102202601179214673900120010020000456781234567811'.slice(0, 48);
    const key = body + module11(body);
    expect(parseAccessKey(key).error).toBe(
      'La fecha de la clave de acceso no es válida: revisa los primeros 8 dígitos',
    );
  });

  it('rechaza un ambiente que no es 1 ni 2', () => {
    const key = keyFor();
    const body = key.slice(0, 23) + '3' + key.slice(24, 48);
    expect(parseAccessKey(body + module11(body)).error).toBe(
      'La clave de acceso no es válida: revisa los 49 dígitos',
    );
  });

  it('rechaza un tipo de emisión que no es 1 (normal)', () => {
    const key = keyFor();
    const body = key.slice(0, 47) + '2';
    expect(parseAccessKey(body + module11(body)).error).toBe(
      'La clave de acceso no es válida: revisa los 49 dígitos',
    );
  });

  it('el módulo 11 coincide con el de las facturas emitidas', () => {
    for (const key of [keyFor(), keyFor('TEST'), keyFor('PRODUCTION', '04')]) {
      expect(module11(key.slice(0, 48))).toBe(key[48]);
    }
  });
});
