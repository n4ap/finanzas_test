import { isIP } from 'node:net';

/** ¿Es una dirección IP pública (enrutable en Internet)? Rechaza loopback, privadas, link-local (metadatos cloud), CGNAT, multicast y reservadas. */
export function isPublicIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPublicV4(ip);
  if (v === 6) {
    const s = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
    if (mapped) return isPublicV4(mapped[1]!);
    const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(s);
    if (mappedHex) { const a = parseInt(mappedHex[1]!, 16), b = parseInt(mappedHex[2]!, 16); return isPublicV4(`${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`); }
    if (s === '::' || s === '::1') return false;
    const first = parseInt(s.split(':')[0] || '0', 16);
    if ((first & 0xfe00) === 0xfc00) return false; // fc00::/7 única local
    if ((first & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
    if ((first & 0xff00) === 0xff00) return false; // multicast
    if (s.startsWith('2001:db8')) return false; // documentación
    if (s.startsWith('64:ff9b:')) return false; // NAT64
    return true;
  }
  return false;
}

function isPublicV4(ip: string): boolean {
  const [a, b, c] = ip.split('.').map(Number) as [number, number, number];
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  if (a === 169 && b === 254) return false; // link-local / metadatos
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 198 && (b === 18 || b === 19)) return false; // pruebas de red
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false; // multicast + reservadas + broadcast
  return true;
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; error: string };

/** Validación sintáctica de una URL aportada por el usuario (la comprobación de IP se hace al conectar). */
export function checkUserUrl(raw: string): UrlCheck {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return { ok: false, error: 'La dirección no es una URL válida' }; }
  if (url.protocol === 'webcal:') url = new URL(`https://${raw.trim().slice('webcal://'.length)}`);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, error: 'Solo se admiten direcciones http(s)' };
  if (url.username || url.password) return { ok: false, error: 'La dirección no puede incluir usuario ni contraseña' };
  if (raw.length > 2000) return { ok: false, error: 'La dirección es demasiado larga' };
  if (!url.hostname || /^(localhost|.*\.local|.*\.internal)$/i.test(url.hostname)) return { ok: false, error: 'No se admiten direcciones locales' };
  return { ok: true, url };
}

export { safeHttpUrl } from './url';
