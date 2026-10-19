import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgresql://lifedash:lifedash_dev@localhost:5432/lifedash_test';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` lanza fuera de React Server Components; en tests de servicio se sustituye por un módulo vacío.
      'server-only': fileURLToPath(new URL('./src/test/empty.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Los tests de integración usan la base de datos de pruebas (nunca la de desarrollo) y no pueden ir en paralelo.
    env: { DATABASE_URL: TEST_DB, ENCRYPTION_KEY: 'a'.repeat(64) },
    globalSetup: ['./src/test/global-setup.ts'],
    fileParallelism: false,
  },
});
