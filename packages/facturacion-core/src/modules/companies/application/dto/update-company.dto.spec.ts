import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateCompanyDto } from './update-company.dto';

const toDto = (body: Record<string, unknown>) => plainToInstance(UpdateCompanyDto, body);
const check = async (body: Record<string, unknown>) =>
  (await validate(toDto(body))).map((e) => e.property);

describe('UpdateCompanyDto', () => {
  it('acepta un perfil tributario completo', async () => {
    expect(
      await check({
        taxRegime: 'RIMPE_EMPRENDEDOR',
        keepsAccounting: false,
        vatFilingPeriod: 'SEMIANNUAL',
        withholdingAgentResolution: '1',
        specialTaxpayerResolution: '12345',
      }),
    ).toEqual([]);
  });

  it('acepta editar solo una parte: lo que no llega no se toca', async () => {
    expect(await check({})).toEqual([]);
    expect(await check({ phone: '0999999999' })).toEqual([]);
  });

  it('un vacío de la web borra la resolución (queda null)', async () => {
    const dto = toDto({ withholdingAgentResolution: '  ', specialTaxpayerResolution: '' });

    expect(await validate(dto)).toEqual([]);
    expect(dto.withholdingAgentResolution).toBeNull();
    expect(dto.specialTaxpayerResolution).toBeNull();
  });

  it('el agente de retención es solo el número de la resolución, como lo pide el XML', async () => {
    expect(await check({ withholdingAgentResolution: 'NAC-DNCRASC20-00000001' })).toEqual([
      'withholdingAgentResolution',
    ]);
    expect(await check({ withholdingAgentResolution: '0' })).toEqual([
      'withholdingAgentResolution',
    ]);
    expect(await check({ withholdingAgentResolution: '123456789' })).toEqual([
      'withholdingAgentResolution',
    ]);
  });

  it('acepta la resolución con ceros a la izquierda, como viene en el documento, y los quita', async () => {
    const dto = toDto({ withholdingAgentResolution: '00000001' });

    expect(await validate(dto)).toEqual([]);
    expect(dto.withholdingAgentResolution).toBe('1');
  });

  it('el contribuyente especial tiene de 3 a 13 dígitos', async () => {
    expect(await check({ specialTaxpayerResolution: '12' })).toEqual(['specialTaxpayerResolution']);
    expect(await check({ specialTaxpayerResolution: '00123' })).toEqual([]);
  });

  it('rechaza regímenes y periodicidades que no existen', async () => {
    expect(await check({ taxRegime: 'RISE', vatFilingPeriod: 'YEARLY' })).toEqual([
      'taxRegime',
      'vatFilingPeriod',
    ]);
  });

  it('rechaza null en los campos obligatorios, en vez de dejarlo llegar a la base', async () => {
    expect(await check({ businessName: null, address: null, email: null })).toEqual([
      'businessName',
      'address',
      'email',
    ]);
  });

  it('no deja vaciar la razón social ni la dirección, que van en cada comprobante', async () => {
    expect(await check({ businessName: '  ', address: '' })).toEqual(['businessName', 'address']);
  });
});
