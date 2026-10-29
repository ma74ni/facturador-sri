import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateMailjetConfigDto } from './update-mailjet-config.dto';

const check = async (body: Record<string, unknown>) =>
  (await validate(plainToInstance(UpdateMailjetConfigDto, body))).map((e) => e.property);

describe('UpdateMailjetConfigDto', () => {
  const keys = { mailjetApiKey: 'api', mailjetSecretKey: 'secret' };

  it('acepta las credenciales sin remitente; los vacíos de la web cuentan como no enviados', async () => {
    expect(await check(keys)).toEqual([]);
    expect(await check({ ...keys, mailjetFromEmail: '', mailjetFromName: '' })).toEqual([]);
  });

  it('exige las dos credenciales', async () => {
    expect(await check({ mailjetApiKey: 'api' })).toEqual(['mailjetSecretKey']);
    expect(await check({ mailjetApiKey: '', mailjetSecretKey: 'secret' })).toEqual([
      'mailjetApiKey',
    ]);
  });

  it('rechaza lo que no es texto y un remitente que no es email', async () => {
    expect(await check({ ...keys, mailjetApiKey: { $ne: '' } })).toEqual(['mailjetApiKey']);
    expect(await check({ ...keys, mailjetFromEmail: 'ventas' })).toEqual(['mailjetFromEmail']);
  });
});
