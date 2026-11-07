#!/usr/bin/env bash
# =============================================================
#  Verifica se o servidor está pronto para rodar o sistema de
#  Folhas de Ponto (Operação Trabalho / Zeladoria — Subprefeitura Sé).
#  Uso:  bash deploy/verificar_ambiente.sh
# =============================================================
OK=0
FALTA=()

verde()  { printf "\033[32m✔ %s\033[0m\n" "$1"; }
verm()   { printf "\033[31m✘ %s\033[0m\n" "$1"; }
azul()   { printf "\n\033[1;34m== %s ==\033[0m\n" "$1"; }

azul "1. Node.js (servidor web)"
if command -v node >/dev/null 2>&1; then
  verde "Node.js $(node --version)"
else
  verm "Node.js não encontrado — instale Node 20+ (https://nodejs.org)"; FALTA+=("node")
fi

azul "2. Python 3"
PYBIN="${PYTHON_BIN:-python3}"
if command -v "$PYBIN" >/dev/null 2>&1; then
  verde "$($PYBIN --version 2>&1) ($PYBIN)"
else
  verm "Python não encontrado (procurei por '$PYBIN') — sudo apt install python3 python3-venv"; FALTA+=("python")
fi

azul "3. Dependências Python (openpyxl, pypdf)"
if "$PYBIN" -c "import openpyxl, pypdf" >/dev/null 2>&1; then
  verde "openpyxl e pypdf importam corretamente"
else
  verm "Faltam pacotes — na raiz do projeto rode: pip install -r python/requirements.txt"; FALTA+=("pip-deps")
fi

azul "4. LibreOffice (conversão para PDF)"
if command -v soffice >/dev/null 2>&1 || command -v libreoffice >/dev/null 2>&1; then
  verde "LibreOffice disponível ($(command -v soffice || command -v libreoffice))"
else
  verm "LibreOffice não encontrado — sudo apt install libreoffice-writer fonts-crosextra-carlito"; FALTA+=("libreoffice")
fi

azul "5. Fonte Carlito (métrica da Calibri, usada no modelo)"
if fc-list 2>/dev/null | grep -qi carlito; then
  verde "Carlito instalada"
else
  verm "Carlito ausente — sudo apt install fonts-crosextra-carlito (sem ela o PDF desalinha)"; FALTA+=("fonte")
fi

azul "6. Arquivos do projeto"
[ -f python/gerar_folhas.py ]   && verde "python/gerar_folhas.py"   || { verm "python/gerar_folhas.py ausente"; FALTA+=("script"); }
[ -f python/template_folha.docx ] && verde "python/template_folha.docx" || { verm "python/template_folha.docx ausente"; FALTA+=("template"); }

echo
if [ ${#FALTA[@]} -eq 0 ]; then
  printf "\033[32mAMBIENTE PRONTO. Para publicar:\033[0m npm install && npm run build && npm start\n"
else
  printf "\033[31mFaltam %d item(ns): %s\033[0m\n" "${#FALTA[@]}" "${FALTA[*]}"
  exit 1
fi
