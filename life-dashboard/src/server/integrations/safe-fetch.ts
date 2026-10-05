import 'server-only';
import { lookup as dnsLookup } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { checkUserUrl, isPublicIp } from '@/lib/net-guard';
import { ServiceError } from '../life/core';

export interface SafeFetchOptions { maxBytes?: number; timeoutMs?: number; maxRedirects?: number; accept?: string }

/**
 * ALLOW_PRIVATE_FETCH=1 desactiva la protección contra redes privadas. Solo para pruebas o para despliegues en una red de
 * confianza que necesitan leer un calendario/feed interno (p. ej. un NAS). Por defecto está desactivado.
 */
let warned = false;
const allowPrivate = () => {
  const on = process.env.ALLOW_PRIVATE_FETCH === '1';
  if (on && !warned) { warned = true; console.warn('[seguridad] ALLOW_PRIVATE_FETCH=1: las suscripciones pueden acceder a direcciones de redes privadas (protección SSRF desactivada).'); }
  return on;
};

/**
 * Descarga texto de una URL aportada por el usuario con defensas contra SSRF:
 * la IP se valida EN EL MOMENTO DE CONECTAR (anti DNS-rebinding), cada redirección se revalida,
 * y hay límites de tamaño, tiempo y número de redirecciones.
 */
export async function safeFetchText(rawUrl: string, opts: SafeFetchOptions = {}): Promise<{ text: string; finalUrl: string }> {
  const { maxBytes = 2_000_000, timeoutMs = 10_000, maxRedirects = 3, accept = '*/*' } = opts;
  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const checked = checkUserUrl(current);
    if (!checked.ok) throw new ServiceError(checked.error);
    const res = await once(checked.url, { maxBytes, timeoutMs, accept });
    if (res.redirect) { current = new URL(res.redirect, checked.url).toString(); continue; }
    return { text: res.text, finalUrl: checked.url.toString() };
  }
  throw new ServiceError('Demasiadas redirecciones');
}

function once(url: URL, o: { maxBytes: number; timeoutMs: number; accept: string }): Promise<{ text: string; redirect?: string }> {
  return new Promise((resolve, reject) => {
    // Node NO llama a `lookup` cuando el host ya es una IP literal: se valida aquí (URL normaliza 0x7f.1 / 2130706433 a 127.0.0.1).
    const literal = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(literal) && !allowPrivate() && !isPublicIp(literal)) return reject(new ServiceError('Dirección no permitida'));
    const lib = url.protocol === 'https:' ? https : http;
    const guardedLookup: typeof dnsLookup = ((host: string, options: unknown, cb: (...a: unknown[]) => void) => {
      const done = typeof options === 'function' ? (options as (...a: unknown[]) => void) : cb;
      if (isIP(host)) { if (!allowPrivate() && !isPublicIp(host)) return done(new ServiceError('Dirección no permitida')); return done(null, host, isIP(host)); }
      dnsLookup(host, { all: true }, (err, addrs) => {
        if (err) return done(err);
        const list = addrs as { address: string; family: number }[];
        if (!allowPrivate() && list.some((a) => !isPublicIp(a.address))) return done(new ServiceError('La dirección resuelve a una red privada y no está permitida'));
        const first = list[0]!;
        return done(null, first.address, first.family);
      });
    }) as typeof dnsLookup;
    const req = lib.request(url, { method: 'GET', lookup: guardedLookup, headers: { accept: o.accept, 'user-agent': 'LifeDashboard/1.0 (+self-hosted)' }, timeout: o.timeoutMs }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) { res.resume(); return resolve({ text: '', redirect: res.headers.location }); }
      if (status < 200 || status >= 300) { res.resume(); return reject(new ServiceError(`El servidor respondió ${status}`)); }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (c: Buffer) => {
        size += c.length;
        if (size > o.maxBytes) { req.destroy(new ServiceError('La respuesta es demasiado grande')); return; }
        chunks.push(c);
      });
      res.on('end', () => resolve({ text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', (e) => reject(e));
    });
    const wall = setTimeout(() => req.destroy(new ServiceError('Tiempo de espera agotado')), o.timeoutMs * 2);
    req.on('timeout', () => req.destroy(new ServiceError('Tiempo de espera agotado')));
    req.on('error', (e) => {
      clearTimeout(wall);
      if (e instanceof ServiceError) return reject(e);
      const code = String((e as { code?: string }).code ?? '');
      if (/ENOTFOUND|EAI_AGAIN/.test(code)) return reject(new ServiceError('No se encontró el servidor'));
      // Solo el código técnico (p. ej. ETIMEDOUT, SELF_SIGNED_CERT_IN_CHAIN): ayuda a diagnosticar sin filtrar la URL.
      console.warn('[safe-fetch] fallo de conexión:', code || e.message);
      reject(new ServiceError(`No se pudo conectar con la dirección${/^[A-Z0-9_]{3,60}$/.test(code) ? ` (${code})` : ''}`));
    });
    req.on('close', () => clearTimeout(wall));
    req.end();
  });
}
