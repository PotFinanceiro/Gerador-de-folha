#!/usr/bin/env bash
# Teste E2E do modo nuvem (Turso/libSQL) usando arquivo local file:
# — mesmo motor e mesmo código do Turso real; só muda a URL.
set -e
cd /home/z/my-project

DB_SIM="file:/home/z/my-project/db/turso-sim.db"
PORTA=3100
LOG=/tmp/teste-turso-server.log

export TURSO_DATABASE_URL="$DB_SIM"
export TURSO_AUTH_TOKEN=""
export SESSAO_SEGREDO="segredo-teste-e2e"
export ADMIN_SENHA_INICIAL="SenhaTeste@123"
export NODE_ENV=production
export PORT=$PORTA
export HOSTNAME=127.0.0.1

rm -f db/turso-sim.db /tmp/cookies.txt

echo "== 1. Subindo servidor (modo nuvem simulado) =="
node .next/standalone/server.js > "$LOG" 2>&1 &
PID=$!
trap "kill $PID 2>/dev/null || true" EXIT

for i in $(seq 1 30); do
  if curl -s -o /dev/null http://127.0.0.1:$PORTA/login; then break; fi
  sleep 1
done

echo "== 2. Login com senha inicial de ADMIN_SENHA_INICIAL =="
RES=$(curl -s -w "\n%{http_code}" -c /tmp/cookies.txt -X POST http://127.0.0.1:$PORTA/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"wagnerlima378@gmail.com","senha":"SenhaTeste@123"}')
echo "$RES"
echo "$RES" | tail -1 | grep -q 200 || { echo "FALHA no login"; tail -30 "$LOG"; exit 1; }

echo "== 3. Listagem de usuários (prova leitura de datas pelo adaptador) =="
curl -s -b /tmp/cookies.txt http://127.0.0.1:$PORTA/api/usuarios | head -c 600; echo

echo "== 4. Criar usuário pela API =="
curl -s -b /tmp/cookies.txt -X POST http://127.0.0.1:$PORTA/api/usuarios \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Equipe Teste","email":"equipe@teste.com","senha":"Equipe@123","perfil":"USUARIO"}'; echo

echo "== 5. Reinício do servidor (simula hibernar e acordar na nuvem) =="
kill $PID 2>/dev/null || true; wait $PID 2>/dev/null || true
node .next/standalone/server.js >> "$LOG" 2>&1 &
PID=$!

for i in $(seq 1 30); do
  if curl -s -o /dev/null http://127.0.0.1:$PORTA/login; then break; fi
  sleep 1
done

echo "== 6. Sessão ainda válida (segredo fixo) e dados persistidos =="
curl -s -b /tmp/cookies.txt http://127.0.0.1:$PORTA/api/usuarios | head -c 900; echo

kill $PID 2>/dev/null || true
echo "TESTE CONCLUÍDO"
