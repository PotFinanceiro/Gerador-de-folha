# Gerador de Folhas de Ponto & Cartas de Banco

> **Programa Operação Trabalho — Rede Cidadã · By WayCode**  
> Sistema automatizado para geração em lote de Folhas de Ponto e Cartas de Autorização Bancária com fidelidade visual absoluta (OpenXML + LibreOffice).

---

## 🏛️ Visão Geral

O sistema recebe planilhas Excel (`.xlsx` ou `.xlsm`) com listas de beneficiários e automatiza processos administrativos:

1. **Folhas de Ponto Mensais:**
   * Cálculo automático de dias do mês, folgas da equipe e dias de curso.
   * Diagramação milimétrica idêntica ao modelo oficial da Prefeitura via OpenXML.
   * Geração de PDFs individuais e empacotamento em arquivo ZIP.
   * Pré-visualização instantânea da 1ª folha para conferência antes do download.

2. **Cartas de Banco:**
   * Preenchimento automático de dados de agência, endereço e dados do beneficiário.
   * Inserção e carimbo de assinatura digitalizada (`.png`).
   * Geração de PDFs individuais e arquivo ZIP compilado.

3. **Gestão de Usuários e Segurança:**
   * Autenticação moderna via **Supabase Auth**.
   * Controle de acesso por papéis (`ADMIN` e `USUARIO`) com Row Level Security (RLS).
   * Middleware de proteção de rotas no Next.js.

---

## 🏗️ Arquitetura do Sistema

O sistema é construído em uma **arquitetura desacoplada e escalável**:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. FRONTEND & ORQUESTRAÇÃO (Next.js 16 · Vercel)            │
│    - Interface moderna com Tailwind CSS e Shadcn UI         │
│    - Middleware de sessão JWT via @supabase/ssr             │
│    - Upload de planilhas e escuta de eventos em tempo real  │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│ 2. SUPABASE                  │ │ 3. WORKER DE DOCUMENTOS    │
│    - Supabase Auth (Sessões) │ │    - Microserviço FastAPI  │
│    - PostgreSQL (Tabela jobs)│ │    - LibreOffice Headless  │
│    - Storage (Planilhas/PDFs)│ │    - Manipulação OpenXML   │
│    - Realtime (WebSocket)    │ │    - Limpeza automática    │
└──────────────────────────────┘ └────────────────────────────┘
```

---

## 📁 Estrutura do Repositório

```text
├── src/
│   ├── app/
│   │   ├── (sistema)/
│   │   │   ├── folhas-de-ponto/    # Interface do gerador de folhas de ponto
│   │   │   ├── emitir-carta/       # Interface de emissão de cartas bancárias
│   │   │   └── usuarios/           # Painel administrativo de usuários
│   │   ├── api/                    # Rotas de orquestração e download
│   │   └── login/                  # Tela de autenticação
│   ├── components/                 # Componentes UI (Shadcn UI, Sidebar, etc.)
│   └── lib/
│       └── supabase/               # Clientes Supabase (Browser, Server, Admin)
├── python/                         # Motor de processamento de documentos
│   ├── server.py                   # API FastAPI do Worker
│   ├── gerar_folhas.py             # Motor OpenXML das folhas
│   ├── gerar_cartas.py             # Motor OpenXML das cartas
│   ├── template_folha.docx         # Modelo base calibrado da folha
│   └── template_carta.docx         # Modelo base calibrado da carta
├── deploy/
│   ├── Dockerfile.worker           # Container Docker leve para o Worker Python
│   └── docker-compose.yml          # Configuração para execução local/VPS
├── supabase/
│   └── schema.sql                  # Script SQL com tabelas, RLS e Storage
├── GUIA-SUPABASE-VERCEL.md         # Passo a passo de configuração para nuvem
└── README.md
```

---

## 🚀 Como Configurar e Publicar

Consulte o documento completo:
👉 **[Guia de Configuração: Supabase, Vercel e Worker](./GUIA-SUPABASE-VERCEL.md)**

Para detalhes do container do motor de documentos:
👉 **[Documentação do Worker Python](./python/README-WORKER.md)**

---

## 🔒 Variáveis de Ambiente

Crie um arquivo `.env` baseado no [`.env.example`](./.env.example):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-publica
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role-secreta

# Worker de Processamento
WORKER_URL=http://localhost:8000
```
