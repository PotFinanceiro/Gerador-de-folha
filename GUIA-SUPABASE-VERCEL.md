# Guia de Configuração: Supabase, Vercel e Worker

Este guia contém as instruções passo a passo para conectar o sistema quando você for criar o banco de dados no **Supabase** e publicar o frontend na **Vercel**.

---

## 1. Configurando o Supabase

1. Crie uma conta ou acesse [supabase.com](https://supabase.com).
2. Clique em **"New Project"** e escolha um nome e senha forte para o banco de dados.
3. No menu lateral esquerdo, vá em **SQL Editor**.
4. Abra o arquivo [`supabase/schema.sql`](./supabase/schema.sql) deste projeto, copie todo o conteúdo, cole no SQL Editor do Supabase e clique em **"Run"**.
   * *Isso criará as tabelas `perfis` e `jobs`, as regras de RLS, as triggers automáticas e os buckets de storage.*
5. No menu lateral, acesse **Project Settings** (ícone de engrenagem) > **API**:
   * Copie o **Project URL** (`https://xxxxxxxx.supabase.co`).
   * Copie o **anon public key** (`eyJhbGci...`).
   * Copie o **service_role secret key** (`eyJhbGci...` — nunca compartilhe publicamente).

---

## 2. Publicando o Worker Python (Motor de Documentos)

Como a Vercel não possui LibreOffice/Python, o motor de documentos roda de forma isolada através do container que preparamos:

* **Onde hospedar:**
  * **Google Cloud Run (Recomendado / Custo zero quando ocioso):**
    * Suba a imagem Docker usando [`deploy/Dockerfile.worker`](./deploy/Dockerfile.worker).
    * Defina a porta como `8000`.
  * **Railway ou Render:**
    * Crie um novo serviço do tipo Docker apontando para o arquivo `deploy/Dockerfile.worker`.
* Após a publicação, você receberá a URL do worker (ex.: `https://worker-folha-xyz.run.app`).

---

## 3. Publicando o Frontend na Vercel

1. Acesse [vercel.com](https://vercel.com) e conecte o repositório GitHub do projeto.
2. Na tela de configuração do projeto na Vercel, abra a seção **Environment Variables** e adicione as 4 variáveis:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | A URL do seu projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | A chave anônima pública do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | A chave secreta `service_role` do Supabase |
| `WORKER_URL` | A URL do seu Worker Python publicado |

3. Clique em **Deploy**.

---

## 4. Primeiro Acesso

1. Acesse a URL gerada pela Vercel.
2. Como o banco de dados estará novo, o **primeiro usuário que fizer cadastro/login no Supabase Auth se tornará automaticamente `ADMIN`** (através da trigger configurada em `schema.sql`).
3. Uma vez logado como `ADMIN`, você terá acesso ao menu **Usuários** para cadastrar novos operadores, trocar senhas e definir permissões.

