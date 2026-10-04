import { beforeAll, describe, expect, it } from 'vitest';
import { decrypt, encrypt, hashPassword, verifyPassword } from './crypto';
import { rateLimit, resetRateLimit } from './rate-limit';

beforeAll(() => { process.env.ENCRYPTION_KEY = 'a'.repeat(64); });

describe('crypto', () => {
  it('hashea y verifica contraseñas', async () => {
    const h = await hashPassword('correcta-horse-battery');
    expect(h).not.toContain('correcta');
    expect(await verifyPassword('correcta-horse-battery', h)).toBe(true);
    expect(await verifyPassword('otra', h)).toBe(false);
  });
  it('cifra y descifra tokens (AES-GCM) y detecta manipulación', () => {
    const c = encrypt('ya29.token');
    expect(c).not.toContain('ya29');
    expect(decrypt(c)).toBe('ya29.token');
    expect(() => decrypt(c.slice(0, -2) + 'AA')).toThrow();
  });
});

describe('rateLimit', () => {
  it('bloquea tras superar el límite y se recupera con la ventana', () => {
    resetRateLimit();
    expect(rateLimit('k', 2, 1000, 0).ok).toBe(true);
    expect(rateLimit('k', 2, 1000, 10).ok).toBe(true);
    expect(rateLimit('k', 2, 1000, 20).ok).toBe(false);
    expect(rateLimit('k', 2, 1000, 1500).ok).toBe(true);
  });
});
