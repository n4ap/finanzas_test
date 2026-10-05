#!/usr/bin/env bash
# Ejecuta todas las pruebas e2e: reinicia datos demo, levanta la app compilada y lanza cada script.
# Requisitos: PostgreSQL en marcha, `npm run build` hecho y Chromium (variable CHROMIUM si no está en /opt/pw-browsers/chromium).
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-3100}"
npx prisma db push --skip-generate >/dev/null
export BASE_URL="http://localhost:$PORT" LOGIN_RATE_LIMIT=1000
status=0
for script in smoke phase2 mobile; do
  npx tsx prisma/seed.ts >/dev/null
  npx next start -p "$PORT" >/tmp/ld-e2e-server.log 2>&1 &
  server=$!
  for _ in $(seq 1 30); do curl -sf "$BASE_URL/login" >/dev/null && break; sleep 1; done
  echo "── e2e/$script.mjs"
  node "e2e/$script.mjs" || status=1
  kill "$server" 2>/dev/null || true
  wait "$server" 2>/dev/null || true
done
exit $status
