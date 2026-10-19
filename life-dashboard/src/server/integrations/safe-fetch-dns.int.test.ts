import { lookup } from 'node:dns/promises';
import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { safeFetchText } from './safe-fetch';

// Regresión: en Node ≥ 20 el `lookup` se llama con `all: true`; las pruebas con IP literal no pasan por él,
// así que un nombre de host real fallaba con ERR_INVALID_IP_ADDRESS. Necesita un nombre que resuelva a 127.0.0.1
// (p. ej. `127.0.0.1 testhost.example` en /etc/hosts); si no existe, la prueba se omite.
const HOST = 'testhost.example';
const resolvable = await lookup(HOST).then((r) => r.address === '127.0.0.1', () => false);

describe.skipIf(!resolvable)('safeFetchText con nombre de host (DNS)', () => {
  let server: http.Server; let port = 0; const prev = process.env.ALLOW_PRIVATE_FETCH;
  beforeAll(async () => {
    process.env.ALLOW_PRIVATE_FETCH = '1';
    server = http.createServer((_q, r) => r.end('BEGIN:VCALENDAR')).listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    port = (server.address() as { port: number }).port;
  });
  afterAll(() => { server.close(); if (prev === undefined) delete process.env.ALLOW_PRIVATE_FETCH; else process.env.ALLOW_PRIVATE_FETCH = prev; });
  it('conecta resolviendo el nombre por DNS', async () => {
    const r = await safeFetchText(`http://${HOST}:${port}/x.ics`, {});
    expect(r.text).toContain('BEGIN:VCALENDAR');
  });
});
