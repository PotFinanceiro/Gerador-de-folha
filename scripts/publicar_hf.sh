#!/usr/bin/env bash
# =============================================================
#  Publica o sistema no Hugging Face Spaces (Docker) — By WayCode
#
#  Uso:
#    HF_USUARIO=wagner-51 HF_TOKEN=hf_xxx bash scripts/publicar_hf.sh
#    (opcional: HF_SPACE=operacao-trabalho SENHA_ADMIN='SenhaForte@123')
#
#  O que faz:
#    1. Monta uma cópia limpa do projeto (sem dados, segredos ou lixo)
#    2. Coloca o Dockerfile na raiz (exigência do HF) + README com metadados
#    3. Envia por git para o Space
#    4. Define os segredos do Space (Turso, sessão, senha inicial do admin)
# =============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

HF_USUARIO="${HF_USUARIO:?Defina HF_USUARIO (seu usuário no Hugging Face)}"
HF_TOKEN="${HF_TOKEN:?Defina HF_TOKEN (token Write do Hugging Face)}"
HF_SPACE="${HF_SPACE:-operacao-trabalho}"
REPO="$HF_USUARIO/$HF_SPACE"
DESTINO=/tmp/hf-space

# Credenciais do Turso (arquivo fora do git)
set -a; source db/turso.env; set +a

# Segredo da sessão: gera uma vez e guarda junto do turso.env
if ! grep -q SESSAO_SEGREDO db/turso.env 2>/dev/null; then
  echo "SESSAO_SEGREDO=$(openssl rand -hex 32)" >> db/turso.env
  echo "» SESSAO_SEGREDO gerado e salvo em db/turso.env"
fi
set -a; source db/turso.env; set +a

# Senha inicial do admin: usa a informada ou gera uma forte e salva
if [ -z "${SENHA_ADMIN:-}" ] && ! grep -q ADMIN_SENHA_INICIAL db/turso.env; then
  SENHA_ADMIN="Way$(openssl rand -hex 6)@30"
  echo "ADMIN_SENHA_INICIAL=$SENHA_ADMIN" >> db/turso.env
  echo "» Senha inicial do admin gerada e salva em db/turso.env"
fi
set -a; source db/turso.env; set +a

echo "== 1/4 Preparando cópia limpa do projeto =="
rm -rf "$DESTINO" && mkdir -p "$DESTINO"
rsync -a \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude db --exclude data --exclude upload --exclude download \
  --exclude scripts --exclude examples --exclude skills --exclude tests \
  --exclude mini-services --exclude tool-results --exclude .zscripts \
  --exclude dev.log --exclude server.log --exclude .env --exclude .gitignore \
  --exclude bun.lock --exclude deploy --exclude Caddyfile --exclude 3000 \
  ./ "$DESTINO"/

cp deploy/Dockerfile.huggingface "$DESTINO/Dockerfile"
cat > "$DESTINO/README.md" <<EOF
---
title: Operação Trabalho — Rede Cidadã
emoji: 📋
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

Programa Operação Trabalho — Rede Cidadã · By WayCode
EOF

echo "== 2/4 Criando commit =="
cd "$DESTINO"
git init -q -b main
git add -A
git -c user.name="WayCode Deploy" -c user.email="deploy@waycode.local" \
  commit -qm "Programa Operação Trabalho — publicação no HF Spaces"

echo "== 3/4 Enviando para o Space =="
export GIT_TERMINAL_PROMPT=0
git remote add space "https://$HF_USUARIO:$HF_TOKEN@huggingface.co/spaces/$REPO"
if ! git push -f space main:main 2>&1 | sed "s/$HF_TOKEN/***TOKEN***/g"; then
  echo ""
  echo "FALHA no push. O Space '$REPO' existe e está em modo Docker?"
  echo "Crie em: https://huggingface.co/new-space  (SDK: Docker, template Blank, visibilidade Public)"
  exit 1
fi

echo "== 4/4 Definindo segredos do Space =="
definir_segredo() {
  local CHAVE="$1" VALOR="$2"
  local HTTP
  HTTP=$(curl -s -o /tmp/hf-secret-resp.json -w "%{http_code}" \
    -X POST "https://huggingface.co/api/spaces/$REPO/secrets" \
    -H "Authorization: Bearer $HF_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"$CHAVE\",\"value\":\"$VALOR\"}")
  if [ "$HTTP" = "200" ] || [ "$HTTP" = "201" ]; then
    echo "  ✓ $CHAVE definido"
  else
    echo "  ✗ $CHAVE (HTTP $HTTP): $(cat /tmp/hf-secret-resp.json)"
  fi
}
definir_segredo "TURSO_DATABASE_URL" "$TURSO_DATABASE_URL"
definir_segredo "TURSO_AUTH_TOKEN"   "$TURSO_AUTH_TOKEN"
definir_segredo "SESSAO_SEGREDO"     "$SESSAO_SEGREDO"
definir_segredo "ADMIN_SENHA_INICIAL" "$ADMIN_SENHA_INICIAL"

echo ""
echo "PUBLICADO! Acompanhe o build em:"
echo "  https://huggingface.co/spaces/$REPO"
echo "Sistema ficará em: https://$(echo "$HF_USUARIO" | tr '[:upper:]' '[:lower:]')-$HF_SPACE.hf.space"
echo "Login inicial: wagnerlima378@gmail.com (troque a senha após o 1º acesso)"
