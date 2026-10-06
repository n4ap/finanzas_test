#!/usr/bin/env bash
# Ejecuta todas las pruebas e2e: reinicia datos demo, levanta la app compilada y lanza cada script.
# Requisitos: PostgreSQL en marcha, `npm run build` hecho y Chromium (variable CHROMIUM si no está en /opt/pw-browsers/chromium).
# Sin argumentos ejecuta todo; p. ej. `npm run e2e -- phase6` ejecuta solo ese script.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-3100}"
STRICT_PORT="${STRICT_PORT:-3101}"
MOCK_PORT="${MOCK_PORT:-3199}"
NEXT="node node_modules/next/dist/bin/next" # directamente node (no npx): así el PID guardado ES el del servidor y se puede parar de verdad

port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
free_port() {
  port_busy "$1" || return 0
  { fuser -k "$1/tcp" || (command -v lsof >/dev/null && lsof -ti "tcp:$1" | xargs kill); } >/dev/null 2>&1 || true
  for _ in $(seq 1 30); do port_busy "$1" || return 0; sleep 0.5; done
  echo "ERROR: el puerto $1 sigue ocupado y no se ha podido liberar" >&2; exit 1
}
start() { # start <puerto> [VAR=valor ...]  → deja el PID en $LAST_PID y comprueba que arranca de verdad
  local port="$1"; shift
  free_port "$port"
  env SCHEDULER=off "$@" $NEXT start -p "$port" >"/tmp/ld-e2e-$port.log" 2>&1 &
  LAST_PID=$!
  for _ in $(seq 1 40); do curl -sf "http://localhost:$port/login" >/dev/null && return 0; kill -0 "$LAST_PID" 2>/dev/null || break; sleep 1; done
  echo "ERROR: el servidor del puerto $port no arrancó (ver /tmp/ld-e2e-$port.log)" >&2; tail -5 "/tmp/ld-e2e-$port.log" >&2; exit 1
}

npx prisma db push --skip-generate >/dev/null
export BASE_URL="http://localhost:$PORT" LOGIN_RATE_LIMIT=1000
SCRIPTS=("$@"); [ ${#SCRIPTS[@]} -eq 0 ] && SCRIPTS=(smoke phase2 phase3 phase4 phase5 phase6 phase7 mobile)
status=0
pids=()
cleanup() { for p in "${pids[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done; free_port "$PORT" 2>/dev/null || true; free_port "$STRICT_PORT" 2>/dev/null || true; }
trap cleanup EXIT
for script in "${SCRIPTS[@]}"; do
  npx tsx prisma/seed.ts >/dev/null
  pids=()
  if [ "$script" = "phase6" ]; then
    # phase6 prueba conexiones externas con servidores de fixtures locales: una instancia con ALLOW_PRIVATE_FETCH=1 (y una API de Anthropic simulada)
    # y otra ESTRICTA (sin permiso) para comprobar que bloquea direcciones privadas.
    start "$PORT" ALLOW_PRIVATE_FETCH=1 "ANTHROPIC_BASE_URL=http://127.0.0.1:$MOCK_PORT"; pids+=("$LAST_PID")
    start "$STRICT_PORT"; pids+=("$LAST_PID")
    export STRICT_URL="http://localhost:$STRICT_PORT" MOCK_PORT
  else
    start "$PORT"; pids+=("$LAST_PID")
  fi
  echo "── e2e/$script.mjs"
  node "e2e/$script.mjs" || status=1
  for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done
  for p in "${pids[@]}"; do wait "$p" 2>/dev/null || true; done
  free_port "$PORT"; free_port "$STRICT_PORT"
done
exit $status
