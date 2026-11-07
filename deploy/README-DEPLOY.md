# Publicando o sistema de Folhas de Ponto

Este guia explica como colocar o sistema para funcionar **fora do ambiente de
desenvolvimento** — no seu computador, no servidor da Prefeitura ou em qualquer
máquina Linux/Windows.

## Por que ele "só funciona no meu terminal"?

O sistema não é apenas um site: para gerar os PDFs ele usa **três programas
instalados no servidor**:

| Componente | Função |
|---|---|
| Node.js 20+ | Servidor web (Next.js) |
| Python 3 + `openpyxl` + `pypdf` | Lê a planilha e monta cada folha em DOCX |
| LibreOffice Writer | Converte o DOCX em PDF com o layout exato do modelo |
| Fonte **Carlito** | Tem as mesmas medidas da Calibri usada no modelo (garante o alinhamento) |

O ambiente em que o sistema foi desenvolvido já tinha tudo isso instalado. Em
qualquer outro servidor é preciso garantir os mesmos componentes — o aplicativo
agora também **diagnostica sozinho** o que estiver faltando e mostra a mensagem
de correção na tela, em português.

---

## Opção A — Docker (recomendada)

Instala tudo automaticamente, isolado, em um único comando. É a forma mais
simples de publicar na rede da Prefeitura.

Pré-requisito: Docker instalado (`sudo apt install docker.io docker-compose-v2`).

```bash
# dentro da pasta do projeto
docker compose -f deploy/docker-compose.yml up -d --build
```

Pronto: o sistema sobe em **http://localhost:3000** (ou `http://IP-DO-SERVIDOR:3000`
para acessar de outros computadores da rede).

- Os arquivos gerados ficam no volume `folha-data` (persistente entre reinícios).
- Para atualizar após receber uma nova versão do código: repita o mesmo comando.
- Para ver os logs: `docker logs -f folha-ponto`.

---

## Opção B — Servidor Linux (Ubuntu/Debian), sem Docker

### 1. Instalar os componentes de sistema

```bash
sudo apt update
sudo apt install -y nodejs npm python3 python3-venv \
    libreoffice-writer fonts-crosextra-carlito
```

> Node 18 já atende; se o repositório tiver versão muito antiga, instale o
> Node 20 LTS pelo site oficial (https://nodejs.org).

### 2. Copiar o projeto e instalar dependências

```bash
cd /opt          # ou outra pasta de sua preferência
# copie a pasta do projeto para cá (ex.: /opt/folha-ponto)
cd folha-ponto

# dependências Python em ambiente isolado
python3 -m venv .venv
. .venv/bin/activate
pip install -r python/requirements.txt

# dependências Node + build de produção
npm install
npm run build
```

### 3. Rodar

```bash
. .venv/bin/activate
PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

Acesse `http://IP-DO-SERVIDOR:3000`.

**Para deixar rodando permanente (inicia sozinho e reinicia se cair):**

```bash
sudo apt install -y pm2
pm2 start "node .next/standalone/server.js" --name folha-ponto --env production
pm2 save && pm2 startup   # segue as instruções impressas na tela
```

Antes de publicar, rode `bash deploy/verificar_ambiente.sh` — ele confere item
por item (Node, Python, pacotes, LibreOffice, fonte e arquivos) e diz exatamente
o que falta.

---

## Opção C — Windows (no seu PC de trabalho)

1. Instale: **Node.js LTS** (nodejs.org), **Python 3** (python.org — marque
   "Add to PATH") e **LibreOffice** (libreoffice.org).
2. No Prompt/PowerShell, dentro da pasta do projeto:

```powershell
pip install -r python\requirements.txt
npm install
npm run build
set PYTHON_BIN=python
node .next\standalone\server.js
```

> No Windows, o LibreOffice normalmente fica em
> `C:\Program Files\LibreOffice\program\soffice.exe`. Se a geração reclamar do
> LibreOffice, adicione essa pasta ao PATH ou defina
> `set SOFFICE_BIN="C:\Program Files\LibreOffice\program\soffice.exe"`.

---

## Modo offline (sem servidor web, só Python)

Para gerar as folhas **sem abrir o navegador** — útil para rodar pontualmente
em qualquer máquina com Python e LibreOffice:

```bash
python3 python/gerar_folhas.py \
    --entrada Base_mala_Liberdade_2026.xlsm \
    --saida ./saida \
    --mes 12 --ano 2026 \
    --folgas 0,1          # índices dos dias da semana: Dom=0, Seg=1, Ter=2, ... Sab=6
    --extra 2026-12-25    # datas extras de folga (opcional, formato AAAA-MM-DD)
```

Saída em `./saida`: `folhas_ponto.zip` (1 PDF por beneficiário),
`preview_folha_1.png` (conferência) e `resumo.json`.

---

## Variáveis de ambiente (opcionais)

| Variável | Padrão | Para quê serve |
|---|---|---|
| `FOLHA_ROOT` | pasta de inicialização | Raiz do projeto (onde ficam `python/` e `data/`) |
| `PYTHON_BIN` | `python3` | Caminho do executável Python (Windows: `python`) |
| `SOFFICE_BIN` | `soffice` | Caminho do LibreOffice, se não estiver no PATH |

## Perguntas rápidas

**Onde ficam os PDFs gerados?** Em `data/gerados/<id>/` dentro da pasta do
projeto. No Docker, ficam no volume `folha-data` (use
`docker volume inspect folha-data` para localizar).

**Posso acessar de outros computadores?** Sim — use o IP do servidor na porta
3000 (ex.: `http://10.0.5.30:3000`). Peça ao TI para liberar a porta na rede.

**A fonte do PDF sai diferente do modelo?** Verifique se a fonte **Carlito**
está instalada (`fc-list | grep -i carlito`). Ela é a equivalência métrica da
Calibri e mantém o layout idêntico ao modelo oficial.

**Preciso de internet?** Não. Depois de instalado, tudo roda na rede local —
nenhum dado da planilha sai do servidor.
