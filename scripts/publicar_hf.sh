#!/usr/bin/env bash
# =============================================================
#  Publica o sistema no Hugging Face Spaces (Docker) — By WayCode
#  Usa huggingface_hub (protocolo xet, aceita os .docx dos templates).
#
#  Uso:
#    bash scripts/publicar_hf.sh
#  (credenciais vêm de db/hf.env e db/turso.env — fora do git)
# =============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

source db/hf.env
REPO="$HF_USUARIO/$HF_SPACE"
DESTINO=/tmp/hf-space
PY=/tmp/venv-hf/bin/python

# Credenciais do Turso (fora do git)
set -a; source db/turso.env; set +a

# Segredo da sessão: gera uma vez e guarda junto do turso.env
if ! grep -q SESSAO_SEGREDO db/turso.env 2>/dev/null; then
  echo "SESSAO_SEGREDO=$(openssl rand -hex 32)" >> db/turso.env
  echo "» SESSAO_SEGREDO gerado e salvo em db/turso.env"
fi
set -a; source db/turso.env; set +a

# Senha inicial do admin: gera uma vez e guarda
if ! grep -q ADMIN_SENHA_INICIAL db/turso.env; then
  echo "ADMIN_SENHA_INICIAL=Way$(openssl rand -hex 6)@30" >> db/turso.env
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

echo "== 2/4 Convertendo o Space para modo Docker e limpando restos do template Static =="
"$PY" - <<PYEOF
import os
from huggingface_hub import HfApi

api = HfApi(token=os.environ["HF_TOKEN"])
repo = os.environ["REPO"]

for arquivo in ["index.html", "style.css", ".gitattributes"]:
    try:
        api.delete_file(arquivo, repo, repo_type="space")
        print("  removido:", arquivo)
    except Exception as e:
        print("  (ignorado)", arquivo, "-", type(e).__name__)
PYEOF

echo "== 3/4 Enviando o sistema para o Space (protocolo xet) =="
export HF_TOKEN REPO DESTINO
"$PY" - <<PYEOF
import os
from huggingface_hub import HfApi

api = HfApi(token=os.environ["HF_TOKEN"])
api.upload_folder(
    folder_path=os.environ["DESTINO"],
    repo_id=os.environ["REPO"],
    repo_type="space",
    commit_message="Programa Operação Trabalho — publicação By WayCode",
)
print("  upload concluído ✓")
PYEOF

echo "== 4/4 Definindo segredos do Space =="
"$PY" - <<PYEOF
import os
from huggingface_hub import HfApi

api = HfApi(token=os.environ["HF_TOKEN"])
repo = os.environ["REPO"]
segredos = {
    "TURSO_DATABASE_URL": os.environ["TURSO_DATABASE_URL"],
    "TURSO_AUTH_TOKEN": os.environ["TURSO_AUTH_TOKEN"],
    "SESSAO_SEGREDO": os.environ["SESSAO_SEGREDO"],
    "ADMIN_SENHA_INICIAL": os.environ["ADMIN_SENHA_INICIAL"],
}
for k, v in segredos.items():
    api.add_space_secret(repo_id=repo, key=k, value=v)
    print("  ✓", k)
PYEOF

echo ""
echo "PUBLICADO! Acompanhe o build em:"
echo "  https://huggingface.co/spaces/$REPO"
echo "Sistema: https://$(echo "$HF_USUARIO" | tr '[:upper:]' '[:lower:]')-$HF_SPACE.hf.space"
