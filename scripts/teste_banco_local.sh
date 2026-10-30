#!/usr/bin/env bash
# Regressão: modo LOCAL (SQLite em arquivo) continua funcionando após o
# suporte ao Turso. Sem TURSO_DATABASE_URL definido, comportamento antigo.
set -e
cd /home/z/my-project

PORTA=3200
LOG=/tmp/teste-local-server.log

unset TURSO_DATABASE_URL TURSO_AUTH_TOKEN || true
export NODE_ENV=production
export PORT=$PORTA
export HOSTNAME=127.0.0.1

node .next/standalone/server.js > "$LOG" 2>&1 &
PID=$!
trap "kill $PID 2>/dev/null || true" EXIT

for i in $(seq 1 30); do
  if curl -s -o /dev/null http://127.0.0.1:$PORTA/login; then break; fi
  sleep 1
done

# Login no banco local existente (admin já cadastrado) — só o código HTTP.
CODIGO=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:$PORTA/api/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"wagnerlima378@gmail.com\",\"senha\":\"$(cat /tmp/senha_admin_local)\"}")

echo "HTTP do login local: $CODIGO"
[ "$CODIGO" = "200" ] && echo "REGRESSÃO OK — modo local intacto" || { echo "FALHA"; tail -30 "$LOG"; exit 1; }
