# Life Dashboard

Centro de control personal: Next.js 15 (App Router) · TypeScript estricto · Tailwind · Prisma + PostgreSQL · Recharts · Lucide.

## Arranque

Requisitos: Node.js 20+ y PostgreSQL 16 (lo más fácil: Docker).

```bash
# 1) PostgreSQL con el usuario/base que espera .env.example (también crea la base de tests)
docker run -d --name lifedash-pg -p 5432:5432 -e POSTGRES_USER=lifedash -e POSTGRES_PASSWORD=lifedash_dev -e POSTGRES_DB=lifedash postgres:16
docker exec lifedash-pg psql -U lifedash -c "CREATE DATABASE lifedash_test"

# 2) Configuración y dependencias
cp .env.example .env          # genera una ENCRYPTION_KEY propia (ver el comentario del fichero)
npm install

# 3) Esquema + datos demo, y arrancar
npm run db:reset              # CUIDADO: borra y recrea la base `lifedash`
npm run dev                   # http://localhost:3000
```

Sin Docker: instala PostgreSQL, crea el rol `lifedash` (contraseña `lifedash_dev`) y las bases `lifedash` y `lifedash_test`, o cambia `DATABASE_URL` en `.env`.
Para uso diario (más rápido y como producción): `npm run build && npm start`.

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
- **Fase 3** — Finanzas (`/finance`): resumen con KPIs y 4 gráficos, movimientos con filtros y paginación, presupuestos por categoría con avisos al 80 %/100 %, cuentas manuales y **compartidas entre dos usuarios**, **importación CSV** (vista previa, detección de duplicados, mapeo de columnas), exportación CSV segura e historial de cambios. Inversiones (`/investments`): valor, rentabilidad, evolución, distribución por tipo y dividendos. El botón **Actualizar precios** pide el último precio a Yahoo Finance (sin clave) y lo guarda en euros: usa el símbolo tal cual (`AAPL`), con sufijo de bolsa para Europa (`VWCE.DE`, `SAN.MC`) o la pareja en euros para cripto (`BTC` → `BTC-EUR`). Los fondos por ISIN no están soportados.
- Dinero siempre en céntimos enteros (`src/lib/finance.ts`); todo cambio financiero se audita en la misma transacción de BD (`AuditLog`, con quién y valor anterior).
- Lógica de negocio en `src/server/finance/` (independiente de cookies, testeada contra BD real); las *server actions* son envoltorios finos con límites de frecuencia.
- Precios de inversión introducidos a mano; no hay conexión con bancos, brokers ni mercados. Un `MarketDataProvider` podrá añadirse en la Fase 6.
- **Fase 4** — Proyectos (`/projects`, `/projects/[id]`): progreso y estado («en marcha», «en riesgo», «fuera de plazo») derivados de las tareas, sin porcentaje manual. Salud (`/health`): peso, pasos, sueño y entrenos manuales, metas propias, 4 gráficos con tabla alternativa y observaciones descriptivas (no consejo médico). Viajes (`/travel`, `/travel/[id]`): reservas, itinerario por días, presupuesto frente a coste de reservas y maleta. Familia (`/family`): personas, próximos cumpleaños y lista de la compra. El dashboard y Ctrl+K los incluyen; las prioridades avisan de proyectos en riesgo, cumpleaños y maletas pendientes.
- Salud: sin conexión con relojes ni apps (el campo `source` ya distingue el origen). Lógica pura en `src/lib/{projects,health,travel,family}.ts`; servicios con comprobación de propiedad en `src/server/life/`.
- **Fase 5** — Asistente (`/assistant`) con herramientas internas: agenda, tareas, gastos y presupuestos, pagos, inversiones, salud, viajes, cumpleaños, prioridades, emails y plan semanal. Las **acciones** (crear tarea/evento, completar tarea, añadir a la compra, reprogramar) **nunca se ejecutan solas**: el asistente crea una *propuesta* que confirmas o descartas (caduca a las 24 h; confirmar es atómico, así que no se ejecuta dos veces). Automatizaciones (`/automations`): reglas «cuando X → entonces Y» (tarea atrasada, presupuesto al 80/100 %, cumpleaños, email por responder, viaje con maleta sin hacer, resumen semanal) con vista previa sin efectos, idempotentes (cada coincidencia dispara una vez) y con confirmación por defecto cuando crean datos. Recomendaciones deterministas en el estado vacío del asistente.
- Arquitectura del asistente (`src/server/ai/`): el proveedor (`AIProvider`) solo pide herramientas y redacta; **nunca toca la BD**. Cada herramienta valida sus argumentos con zod y acota todo por `userId`; las de escritura solo producen propuestas (`AIProposal`, que sirve además de registro de auditoría). El proveedor activo es `local` (reglas deterministas, sin LLM ni red; `AI_PROVIDER`). Un LLM real (Fase 6) se enchufa implementando la misma interfaz, sin tocar herramientas ni confirmaciones. El contenido de emails es dato no confiable: solo se entregan extractos y ninguna llamada de escritura salta la confirmación (hay tests con un proveedor malicioso).
- Automatizaciones sin proceso en segundo plano: se evalúan con «Ejecutar ahora» o, para ejecución periódica, con un planificador externo: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://tu-app/api/automations/run` (sin `CRON_SECRET` de ≥ 24 caracteres la ruta no existe; solo devuelve recuentos).
- **Fase 6** — Ajustes (`/settings`): perfil y zona horaria, conexiones, IA, seguridad y datos/privacidad.
  - **Conexiones reales** (`src/server/integrations/`): suscripción a calendarios iCal (`.ics`/`webcal://`, solo lectura, con recurrencias, TZID y días completos) y feeds RSS/Atom. Las URLs se guardan cifradas (AES-256-GCM). Toda descarga pasa por `safeFetchText`: valida la IP **al conectar** (anti DNS-rebinding e IP literales), rechaza redes privadas/metadatos cloud, revalida cada redirección y limita tamaño, tiempo y redirecciones. `ALLOW_PRIVATE_FETCH=1` desactiva esa protección (solo para redes de confianza o pruebas). Gmail/Outlook/Google Calendar/bancos **no están implementados**: requieren registrar la app en cada proveedor (OAuth propio); las interfaces `EmailProvider`/`CalendarProvider` están listas.
  - **IA con Claude** (`src/server/ai/anthropic-provider.ts`, SDK oficial): clave propia por usuario, guardada cifrada y validada contra la API antes de guardarla; consentimiento explícito de que los datos consultados se envían a Anthropic (se retira al volver al asistente local). Modelos Opus 5.5 (por defecto) y Sonnet 5.5, razonamiento siempre activado y `fallbacks: "default"`. Los bloques de razonamiento se reenvían tal cual dentro del turno. Las acciones de escritura siguen exigiendo confirmación sea cual sea el motor.
  - **Privacidad**: exportar todos tus datos en JSON (sin contraseñas/sesiones/claves), importar (se *añade*, validado entero y en una transacción: todo o nada), borrar todos los datos o eliminar la cuenta (con contraseña; las cuentas bancarias compartidas pasan a la otra persona sin perder movimientos).
  - **Seguridad**: cambio de contraseña (cierra las demás sesiones), lista y cierre de sesiones, Content-Security-Policy con nonce por petición (los scripts inyectados no se ejecutan), HSTS bajo HTTPS, límites de intentos en acciones sensibles.
  - **Móvil/PWA**: manifest instalable, iconos (incl. maskable), `viewport-fit=cover` y barra inferior con área segura.
  - **Zona horaria** del usuario: la usan el planificador (cron) y la interpretación de calendarios suscritos.
  - **Migraciones**: `prisma/migrations/0001_baseline` (verificada: aplicada en una BD nueva, el diff con el esquema es vacío). Producción: `npm run db:migrate`. Una BD de desarrollo creada con `db push`: `npx prisma migrate resolve --applied 0001_baseline`. Nuevos cambios: `npx prisma migrate dev --name <cambio>`.
- Sincronización periódica: `POST /api/automations/run` (con `CRON_SECRET`) también refresca calendarios y feeds conectados.
- Pendiente conocido: el límite de intentos es en memoria (una instancia); para varias instancias hay que sustituirlo por Redis. `npm audit` señala avisos en dependencias de *build/CLI* (`prisma`/`deepmerge-ts`, `postcss` de Next) cuya corrección automática exige cambios mayores; no afectan al código que se ejecuta con datos de usuario, pero conviene revisarlos al actualizar Next/Prisma.
- Esquema gestionado con `prisma db push` en desarrollo; antes de producción hay que pasar a migraciones (`prisma migrate`).
