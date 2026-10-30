# =============================================================
#  Folha de Ponto — Operação Trabalho / Zeladoria (Subprefeitura Sé)
#  Imagem autocontida: Node.js (Next.js) + Python 3 + LibreOffice
#  Build (a partir da raiz do projeto):
#    docker build -f deploy/Dockerfile -t folha-ponto .
#  Run:
#    docker run -d -p 3000:3000 -v folha-data:/app/data --name folha folha-ponto
# =============================================================
FROM node:22-slim

# LibreOffice Writer converte DOCX -> PDF; Carlito tem as métricas da fonte Calibri
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-venv \
        libreoffice-writer \
        fonts-crosextra-carlito fonts-dejavu-core \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Ambiente Python isolado com as dependências do gerador
COPY python/requirements.txt /tmp/requirements.txt
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt \
    && ln -s /opt/venv/bin/python /usr/local/bin/python3

ENV NODE_ENV=production \
    PYTHON_BIN=/opt/venv/bin/python \
    SOFFICE_BIN=soffice \
    FOLHA_ROOT=/app \
    HOME=/lo-home \
    PORT=3000 \
    HOSTNAME=0.0.0.0

WORKDIR /app

# Dependências Node (npm; legacy-peer-deps evita conflitos de versões antigas)
COPY package.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Código
COPY next.config.ts tsconfig.json tailwind.config.ts postcss.config.mjs ./
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
COPY public ./public
COPY python ./python

# URL de banco usada apenas DURANTE o build — o Prisma exige uma definida
# quando o Next importa os módulos. Em execução o banco real é o Turso
# (variáveis TURSO_*) ou o SQLite do servidor, nunca este arquivo.
ENV DATABASE_URL="file:/tmp/folha-build.db"

# Build do Next.js (standalone) + ajustes de estáticos
RUN npm run build

# /app/data guarda planilhas e PDFs gerados (monte um volume aqui)
RUN mkdir -p /app/data/gerados /lo-home
VOLUME ["/app/data"]

EXPOSE 3000
CMD ["node", ".next/standalone/server.js"]
