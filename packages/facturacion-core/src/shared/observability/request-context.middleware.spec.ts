import { Logger } from '@nestjs/common';
import * as express from 'express';
import * as request from 'supertest';

import { currentRequestContext, requestIdFrom, setRequestUser } from './request-context';
import { requestContextMiddleware } from './request-context.middleware';

function app() {
  const server = express();
  server.use(requestContextMiddleware);
  server.get('/eco', async (_req, res) => {
    await new Promise((resolve) => setTimeout(resolve, 1));
    setRequestUser('u1', 'c1');
    res.json(currentRequestContext());
  });
  server.get('/falla', (_req, res) => {
    res.status(500).json({});
  });
  return server;
}

describe('contexto de la petición', () => {
  let logs: { level: string; message: any }[];

  beforeEach(() => {
    logs = [];
    jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation((message) => void logs.push({ level: 'log', message }));
    jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation((message) => void logs.push({ level: 'warn', message }));
    jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation((message) => void logs.push({ level: 'error', message }));
  });

  afterEach(() => jest.restoreAllMocks());

  it('da un id a la petición, lo devuelve y lo expone a la web', async () => {
    const res = await request(app()).get('/eco').expect(200);

    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f]{12}$/);
    expect(res.headers['access-control-expose-headers']).toBe('X-Request-Id');
    expect(res.body).toEqual({
      requestId: res.headers['x-request-id'],
      userId: 'u1',
      companyId: 'c1',
    });
  });

  it('respeta el id de un cliente (el POS) si es seguro', async () => {
    const res = await request(app()).get('/eco').set('X-Request-Id', 'pos-0001-abcd').expect(200);
    expect(res.headers['x-request-id']).toBe('pos-0001-abcd');
  });

  it('ignora un id con caracteres raros', () => {
    expect(requestIdFrom('<script>alert(1)</script>')).toMatch(/^[0-9a-f]{12}$/);
    expect(requestIdFrom('corto')).toMatch(/^[0-9a-f]{12}$/);
  });

  it('deja una línea por petición, sin la query, y como error si falló', async () => {
    await request(app()).get('/falla?token=secreto').expect(500);

    expect(logs).toEqual([
      {
        level: 'error',
        message: expect.objectContaining({ method: 'GET', path: '/falla', status: 500 }),
      },
    ]);
    expect(JSON.stringify(logs)).not.toContain('secreto');
  });
});
