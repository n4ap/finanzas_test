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
`npm test` (vitest; los tests de integración usan PostgreSQL real: crea una base `lifedash_test` con el mismo usuario, o define `TEST_DATABASE_URL`. El setup solo ejecuta un `db push` normal y se niega a tocar bases cuyo nombre no contenga «test») · `npm run typecheck` · `npm run lint` · `npm run build` · `npm run e2e` (reinicia datos demo, levanta la app compilada y ejecuta `e2e/smoke.mjs`, `phase2.mjs` y `mobile.mjs` con Playwright; requiere `npm run build` previo y Chromium, `CHROMIUM` configurable).

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
- **Fase 3** — Finanzas (`/finance`): resumen con KPIs y 4 gráficos, movimientos con filtros y paginación, presupuestos por categoría con avisos al 80 %/100 %, cuentas manuales y **compartidas entre dos usuarios**, **importación CSV** (vista previa, detección de duplicados, mapeo de columnas), exportación CSV segura e historial de cambios. Inversiones (`/investments`): valor, rentabilidad, evolución, distribución por tipo y dividendos.
- Dinero siempre en céntimos enteros (`src/lib/finance.ts`); todo cambio financiero se audita en la misma transacción de BD (`AuditLog`, con quién y valor anterior).
- Lógica de negocio en `src/server/finance/` (independiente de cookies, testeada contra BD real); las *server actions* son envoltorios finos con límites de frecuencia.
- Precios de inversión introducidos a mano; no hay conexión con bancos, brokers ni mercados. Un `MarketDataProvider` podrá añadirse en la Fase 6.
- **Fase 4** — Proyectos (`/projects`, `/projects/[id]`): progreso y estado («en marcha», «en riesgo», «fuera de plazo») derivados de las tareas, sin porcentaje manual. Salud (`/health`): peso, pasos, sueño y entrenos manuales, metas propias, 4 gráficos con tabla alternativa y observaciones descriptivas (no consejo médico). Viajes (`/travel`, `/travel/[id]`): reservas, itinerario por días, presupuesto frente a coste de reservas y maleta. Familia (`/family`): personas, próximos cumpleaños y lista de la compra. El dashboard y Ctrl+K los incluyen; las prioridades avisan de proyectos en riesgo, cumpleaños y maletas pendientes.
- Salud: sin conexión con relojes ni apps (el campo `source` ya distingue el origen). Lógica pura en `src/lib/{projects,health,travel,family}.ts`; servicios con comprobación de propiedad en `src/server/life/`.
- **Fase 5** — Asistente (`/assistant`) con herramientas internas: agenda, tareas, gastos y presupuestos, pagos, inversiones, salud, viajes, cumpleaños, prioridades, emails y plan semanal. Las **acciones** (crear tarea/evento, completar tarea, añadir a la compra, reprogramar) **nunca se ejecutan solas**: el asistente crea una *propuesta* que confirmas o descartas (caduca a las 24 h; confirmar es atómico, así que no se ejecuta dos veces). Automatizaciones (`/automations`): reglas «cuando X → entonces Y» (tarea atrasada, presupuesto al 80/100 %, cumpleaños, email por responder, viaje con maleta sin hacer, resumen semanal) con vista previa sin efectos, idempotentes (cada coincidencia dispara una vez) y con confirmación por defecto cuando crean datos. Recomendaciones deterministas en el estado vacío del asistente.
- Arquitectura del asistente (`src/server/ai/`): el proveedor (`AIProvider`) solo pide herramientas y redacta; **nunca toca la BD**. Cada herramienta valida sus argumentos con zod y acota todo por `userId`; las de escritura solo producen propuestas (`AIProposal`, que sirve además de registro de auditoría). El proveedor activo es `local` (reglas deterministas, sin LLM ni red; `AI_PROVIDER`). Un LLM real (Fase 6) se enchufa implementando la misma interfaz, sin tocar herramientas ni confirmaciones. El contenido de emails es dato no confiable: solo se entregan extractos y ninguna llamada de escritura salta la confirmación (hay tests con un proveedor malicioso).
- Automatizaciones sin proceso en segundo plano: se evalúan con «Ejecutar ahora» o, para ejecución periódica, con un planificador externo: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://tu-app/api/automations/run` (sin `CRON_SECRET` de ≥ 24 caracteres la ruta no existe; solo devuelve recuentos).
- Esquema gestionado con `prisma db push` en desarrollo; antes de producción hay que pasar a migraciones (`prisma migrate`).
