import { JsonLogger, useJsonLogs } from './json-logger';
import { runWithRequestContext } from './request-context';

function capture() {
  const lines: { entry: Record<string, any>; stream: string }[] = [];
  const logger = new JsonLogger((line, stream) => lines.push({ entry: JSON.parse(line), stream }));
  return { logger, lines };
}

describe('JsonLogger', () => {
  it('escribe una línea JSON con el contexto de la petición', () => {
    const { logger, lines } = capture();

    runWithRequestContext({ requestId: 'abc123def456', companyId: 'c1', userId: 'u1' }, () =>
      logger.log('Factura creada', 'InvoicesService'),
    );

    expect(lines[0].entry).toMatchObject({
      level: 'log',
      context: 'InvoicesService',
      msg: 'Factura creada',
      requestId: 'abc123def456',
      companyId: 'c1',
      userId: 'u1',
    });
    expect(lines[0].stream).toBe('stdout');
  });

  it('fuera de una petición no inventa contexto', () => {
    const { logger, lines } = capture();

    logger.warn('Arrancando');

    expect(lines[0].entry).not.toHaveProperty('requestId');
    expect(lines[0].entry).not.toHaveProperty('context');
  });

  it('los errores van a stderr con su stack', () => {
    const { logger, lines } = capture();

    logger.error('Falló la firma', new Error('boom').stack, 'DigitalSignatureService');

    expect(lines[0].stream).toBe('stderr');
    expect(lines[0].entry).toMatchObject({
      level: 'error',
      msg: 'Falló la firma',
      context: 'DigitalSignatureService',
    });
    expect(lines[0].entry.stack).toContain('boom');
  });

  it('un objeto va como datos, no como texto', () => {
    const { logger, lines } = capture();

    logger.log({ method: 'GET', status: 200 }, 'HTTP');

    expect(lines[0].entry.data).toEqual({ method: 'GET', status: 200 });
  });

  it('JSON en producción o con LOG_FORMAT=json', () => {
    expect(useJsonLogs({ NODE_ENV: 'production' })).toBe(true);
    expect(useJsonLogs({ NODE_ENV: 'development' })).toBe(false);
    expect(useJsonLogs({ NODE_ENV: 'development', LOG_FORMAT: 'json' })).toBe(true);
    expect(useJsonLogs({ NODE_ENV: 'production', LOG_FORMAT: 'pretty' })).toBe(false);
  });
});
