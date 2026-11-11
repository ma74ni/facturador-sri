import { parseExpenseAccountList } from './expense-account-list';

describe('lista de cuentas de gasto pegada', () => {
  it('lee lo copiado de Excel: código y nombre separados por tabulación, sin el encabezado', () => {
    const { accounts, errors } = parseExpenseAccountList(
      'Código\tNombre\n5.1.01\tMateria prima\n5.2.03\tArriendo   del local\n',
    );

    expect(errors).toEqual([]);
    expect(accounts).toEqual([
      { line: 2, code: '5.1.01', name: 'Materia prima' },
      { line: 3, code: '5.2.03', name: 'Arriendo del local' },
    ]);
  });

  it('acepta "código nombre", "código - nombre", "código: nombre" y "código;nombre"', () => {
    const { accounts } = parseExpenseAccountList(
      '510 Servicios básicos\n5.1.02 - Envases\n520: Publicidad\n530;Mantenimiento',
    );

    expect(accounts.map(({ code, name }) => [code, name])).toEqual([
      ['510', 'Servicios básicos'],
      ['5.1.02', 'Envases'],
      ['520', 'Publicidad'],
      ['530', 'Mantenimiento'],
    ]);
  });

  it('una línea sin código es solo el nombre de la cuenta', () => {
    const { accounts } = parseExpenseAccountList('Arriendo\n\n  Combustible  ');

    expect(accounts).toEqual([
      { line: 1, code: null, name: 'Arriendo' },
      { line: 3, code: null, name: 'Combustible' },
    ]);
  });

  it('no confunde un nombre que empieza con letras con un código', () => {
    expect(parseExpenseAccountList('IVA no recuperable').accounts).toEqual([
      { line: 1, code: null, name: 'IVA no recuperable' },
    ]);
  });

  it('informa las líneas que no se pueden usar, con su número', () => {
    const { accounts, errors } = parseExpenseAccountList(
      `5.1.01\tMateria prima\nGA/01\tGastos varios\n5.9\t${'x'.repeat(121)}`,
    );

    expect(accounts).toHaveLength(1);
    expect(errors.map((e) => [e.line, e.reason])).toEqual([
      [2, 'El código solo puede tener letras, números, puntos y guiones'],
      [3, 'El nombre puede tener hasta 120 caracteres'],
    ]);
  });
});
