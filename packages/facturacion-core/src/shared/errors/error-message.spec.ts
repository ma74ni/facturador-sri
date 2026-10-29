import { errorMessage } from './error-message';

describe('errorMessage', () => {
  it.each([
    [new Error('SRI caído'), 'SRI caído'],
    ['texto suelto', 'texto suelto'],
    [{ message: 'de un SDK' }, 'de un SDK'],
    [{ code: 500 }, 'error desconocido'],
    [null, 'error desconocido'],
    [undefined, 'error desconocido'],
  ])('%p → "%s"', (error, message) => {
    expect(errorMessage(error)).toBe(message);
  });

  it('usa el texto de respaldo que se le pase', () => {
    expect(errorMessage(42, 'Error desconocido')).toBe('Error desconocido');
  });
});
