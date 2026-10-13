import { randomBytes } from 'crypto';
import { encryptSecret } from '../../crypto/secret-cipher';
import { MailjetProvider } from './mailjet.provider';

const apiConnect = jest.fn((_apiKey: string, _secretKey: string) => ({
  post: () => ({ request: jest.fn().mockResolvedValue({ body: { Messages: [{ Status: 'success', To: [{}] }] } }) }),
  get: () => ({ request: jest.fn().mockResolvedValue({}) }),
}));
jest.mock('node-mailjet', () => ({ apiConnect: (a: string, s: string) => apiConnect(a, s) }));

describe('MailjetProvider · secret key de la empresa', () => {
  const key = randomBytes(32);
  const env = { ...process.env };
  const config: any = { get: (name: string) => ({ MAILJET_FROM_EMAIL: 'sistema@example.com' } as any)[name] };

  beforeEach(() => {
    process.env.CERTIFICATE_ENCRYPTION_KEY = key.toString('base64');
    apiConnect.mockClear();
  });

  afterAll(() => {
    process.env = { ...env };
  });

  const company = (mailjetSecretKey: string) => ({
    emailProvider: 'MAILJET',
    mailjetApiKey: 'api-key',
    mailjetSecretKey,
    mailjetFromEmail: 'ventas@empresa.com',
    businessName: 'Empresa',
  });

  it('descifra la secret key guardada antes de conectar', async () => {
    const provider = new MailjetProvider(config);

    await provider.sendEmail({
      to: 'cliente@example.com',
      subject: 'Factura',
      htmlContent: '<p>hola</p>',
      company: company(encryptSecret('secreto-real', key)),
    });

    expect(apiConnect).toHaveBeenLastCalledWith('api-key', 'secreto-real');
  });

  it('sigue aceptando una secret key antigua sin cifrar', async () => {
    const provider = new MailjetProvider(config);

    expect(await provider.verifyConnection('api-key', 'secreto-plano')).toBe(true);
    expect(apiConnect).toHaveBeenLastCalledWith('api-key', 'secreto-plano');
  });
});
