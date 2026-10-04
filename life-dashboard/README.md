# Life Dashboard

Centro de control personal: Next.js 15 (App Router) · TypeScript estricto · Tailwind · Prisma + PostgreSQL · Recharts · Lucide.

## Arranque

```bash
cp .env.example .env          # y genera ENCRYPTION_KEY (ver comentario en el fichero)
npm install
npm run db:reset              # crea el esquema y carga datos demo
npm run dev                   # http://localhost:3000
```

Usuario demo: `demo@lifedashboard.dev` / `demo-password-123`

## Scripts
`npm test` (vitest) · `npm run typecheck` · `npm run lint` · `npm run build` · `node e2e/smoke.mjs` (Playwright contra la app en marcha, `BASE_URL` configurable).

## Arquitectura
- `src/server/providers/` — interfaces `EmailProvider`, `CalendarProvider`, `NewsProvider`, `FinanceProvider`, `AIProvider` + registro de adapters. La UI no depende de ningún proveedor concreto.
- `src/server/insights.ts` — prioridades, conflictos, gasto inusual y «¿qué hago ahora?» como funciones puras (testeadas, sin enviar datos a terceros).
- `src/server/auth.ts` — sesiones con token opaco (solo se guarda su SHA-256), cookie httpOnly; contraseñas con scrypt.
- `src/lib/crypto.ts` — AES-256-GCM para tokens de integraciones; `rate-limit.ts` para login/registro/búsqueda.
- `src/components/widgets/` + `src/lib/widgets.ts` — sistema de widgets: añadir uno = entrada en el catálogo + línea en `registry.tsx`.
- Todas las consultas se filtran por `userId`; las acciones de servidor validan con zod.
