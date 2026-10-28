import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCustomerDto } from '../application/dto/create-customer.dto';
import { UpdateCustomerDto } from '../application/dto/update-customer.dto';
import { buyerIdentificationTypeForSri, toIdentificationTypeCode } from './identification-type';

describe('Tipo de identificación', () => {
  describe('toIdentificationTypeCode', () => {
    it.each([
      ['04', '04'],
      ['05', '05'],
      ['06', '06'],
      ['07', '07'],
      ['08', '08'],
      ['RUC', '04'],
      ['CEDULA', '05'],
      ['PASAPORTE', '06'],
      ['CONSUMIDOR_FINAL', '07'],
      ['IDENTIFICACION_EXTERIOR', '08'],
      [' cedula ', '05'],
    ])('"%s" es el código %s', (value, code) => {
      expect(toIdentificationTypeCode(value)).toBe(code);
    });

    it.each([['DNI'], ['09'], [''], [null], [5]])('"%s" no es un tipo válido', (value) => {
      expect(toIdentificationTypeCode(value)).toBeNull();
    });
  });

  describe('buyerIdentificationTypeForSri', () => {
    it('manda al SRI el código aunque el cliente tenga guardado el nombre', () => {
      expect(buyerIdentificationTypeForSri('CEDULA')).toBe('05');
    });

    it('un valor desconocido va como consumidor final', () => {
      expect(buyerIdentificationTypeForSri('DNI')).toBe('07');
    });
  });

  describe('DTO de cliente', () => {
    const base = { identification: '1715758502', firstName: 'Diego', lastName: 'Paredes' };

    it('guarda el código cuando la web manda el nombre', async () => {
      const dto = plainToInstance(CreateCustomerDto, { ...base, identificationType: 'CEDULA' });

      expect(await validate(dto)).toHaveLength(0);
      expect(dto.identificationType).toBe('05');
    });

    it('acepta el código tal cual', async () => {
      const dto = plainToInstance(CreateCustomerDto, { ...base, identificationType: '04' });

      expect(await validate(dto)).toHaveLength(0);
      expect(dto.identificationType).toBe('04');
    });

    it('rechaza un tipo que no existe', async () => {
      const errors = await validate(
        plainToInstance(CreateCustomerDto, { ...base, identificationType: 'DNI' }),
      );

      expect(errors.map((e) => e.property)).toContain('identificationType');
    });

    it('al editar también convierte el nombre en código', async () => {
      const dto = plainToInstance(UpdateCustomerDto, { identificationType: 'PASAPORTE' });

      expect(await validate(dto)).toHaveLength(0);
      expect(dto.identificationType).toBe('06');
    });
  });
});
