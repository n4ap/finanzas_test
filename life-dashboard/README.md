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
`npm test` (vitest) · `npm run typecheck` · `npm run lint` · `npm run build` · `npm run e2e` (reinicia datos demo, levanta la app compilada y ejecuta `e2e/smoke.mjs`, `phase2.mjs` y `mobile.mjs` con Playwright; requiere `npm run build` previo y Chromium, `CHROMIUM` configurable).

## Arquitectura
- `src/server/providers/` — interfaces `EmailProvider`, `CalendarProvider`, `NewsProvider`, `FinanceProvider`, `AIProvider` + registro de adapters. La UI no depende de ningún proveedor concreto.
- `src/server/insights.ts` — prioridades, conflictos, gasto inusual y «¿qué hago ahora?» como funciones puras (testeadas, sin enviar datos a terceros).
- `src/server/auth.ts` — sesiones con token opaco (solo se guarda su SHA-256), cookie httpOnly; contraseñas con scrypt.
- `src/lib/crypto.ts` — AES-256-GCM para tokens de integraciones; `rate-limit.ts` para login/registro/búsqueda.
- `src/components/widgets/` + `src/lib/widgets.ts` — sistema de widgets: añadir uno = entrada en el catálogo + línea en `registry.tsx`.
- Todas las consultas se filtran por `userId`; las acciones de servidor validan con zod.

## Funcionalidad por fases
- **Fase 1** — auth, esquema, dashboard con widgets, Focus, Ctrl+K, notificaciones.
- **Fase 2** — Tareas (lista, Kanban con arrastrar y soltar, calendario; subtareas, recurrencia, recordatorios), Calendario (día/semana/mes/agenda, CRUD, búsqueda, varios calendarios), Email (carpetas, análisis, resumen, fecha límite, tareas extraídas, borradores) y Noticias («Lo importante de hoy» ≤5, categorías priorizables).
- Los emails **nunca se envían** desde la app: solo se generan borradores (`mailto:`/copiar).
- Resúmenes y análisis de email/noticias son heurísticas locales deterministas (`src/server/email-ai.ts`, `news-rank.ts`); un `AIProvider` real los sustituirá en la Fase 6.
