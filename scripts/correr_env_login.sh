#!/bin/bash
# Restaura as variáveis do Turso no .env (perdidas na reciclagem do sandbox),
# reinicia o servidor e redefine a senha do admin. Uso: bash scripts/correr_env_login.sh
set -e
cd /home/z/my-project

# 1. Carrega db/turso.env sem imprimir segredos
set -a
source db/turso.env
set +a

# 2. Garante as chaves no .env (adiciona só as que faltam)
grep -q '^TURSO_DATABASE_URL=' .env || echo "TURSO_DATABASE_URL=$TURSO_DATABASE_URL" >> .env
grep -q '^TURSO_AUTH_TOKEN=' .env   || echo "TURSO_AUTH_TOKEN=$TURSO_AUTH_TOKEN" >> .env
grep -q '^ADMIN_SENHA_INICIAL=' .env || echo "ADMIN_SENHA_INICIAL=$ADMIN_SENHA_INICIAL" >> .env
echo "1. .env corrigido: $(grep -c '=' .env) variáveis (Turso incluso) ✓"

# 3. Reinicia o servidor para reler o .env
fuser -k 3000/tcp 2>/dev/null || pkill -f 'next dev' 2>/dev/null || true
sleep 2
(setsid nohup bun run dev > /tmp/dev-server.log 2>&1 & disown)
for i in $(seq 1 60); do ss -tln | grep -q ':3000' && break; sleep 2; done
ss -tln | grep -q ':3000' && echo "2. Servidor reiniciado na porta 3000 ✓"

# 4. Diagnóstico + reset da senha (Turso e local)
bun scripts/resetar_senha_admin.ts

# 5. Teste HTTP real
echo ""
curl -s --max-time 30 -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"wagnerlima378@gmail.com","senha":"'"$ADMIN_SENHA_INICIAL"'"}' \
  -w "\n→ HTTP %{http_code} (200 = login OK)\n" | head -3
