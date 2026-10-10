import { execSync } from 'node:child_process';

/**
 * Asegura que el esquema existe en la base de datos de PRUEBAS con un `db push` normal (idempotente, NO destructivo).
 * Cada test limpia sus propios datos; nunca se resetea la base de datos. Si un cambio de esquema exigiera perder datos,
 * el push falla y hay que revisarlo a mano (p. ej. `DROP DATABASE lifedash_test; CREATE DATABASE lifedash_test;`).
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://lifedash:lifedash_dev@localhost:5432/lifedash_test';
  if (!/test/i.test(new URL(url).pathname)) throw new Error(`Por seguridad la BD de tests debe contener «test» en su nombre: ${url}`);
  execSync('npx prisma db push --skip-generate', { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
}
