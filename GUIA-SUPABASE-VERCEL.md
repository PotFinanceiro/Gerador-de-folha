# Guia de Implantação: Vercel + Supabase (100% Serverless & Gratuito)

Este projeto foi reestruturado para funcionar **exclusivamente com Vercel e Supabase**, sem necessidade de servidores externos, containers ou cadastro de cartão de crédito.

Toda a leitura de planilhas (`.xlsx` / `.xlsm`), geração de PDFs individuais (Folhas de Ponto e Cartas de Banco), criação de prévias visuais e compactação `.zip` rodam **nativamente em TypeScript/Node.js** dentro das funções Serverless da Vercel, com armazenamento seguro no **Supabase Storage**.

---

## Arquitetura Final

1. **Vercel (Frontend Next.js + API Serverless em TypeScript):**
   - Interface do usuário (Folhas de Ponto, Emitir Carta e Painel de Usuários).
   - Processamento nativo de planilhas (`xlsx`), geração de PDFs (`pdf-lib`) e pacotes `.zip` (`jszip`).
2. **Supabase (Autenticação + Banco PostgreSQL + Storage):**
   - **Supabase Auth:** Login seguro com e-mail e senha.
   - **PostgreSQL (`public.perfis` e `public.jobs`):** Controle de acesso (`ADMIN` / `USUARIO`) com Row Level Security (RLS) e histórico de lotes gerados.
   - **Supabase Storage (`documentos-gerados`):** Armazena os pacotes `.zip` e prévias geradas.

---

## Como Publicar na Vercel (Passo a Passo)

1. Acesse [https://vercel.com](https://vercel.com) e entre com sua conta do **GitHub**.
2. Clique em **Add New... > Project** e importe o repositório **`PotFinanceiro/Gerador-de-folha`**.
3. Na seção **Environment Variables**, adicione exatamente estas **3 variáveis**:

   | Nome da Variável | Valor |
   | :--- | :--- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://ssssnijlwudfhdvssjpz.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_ovsyd_aVjosGR5Ihm98Nkg_c6N2LNA1` |
   | `SUPABASE_SERVICE_ROLE_KEY` | `<sua-chave-secreta-do-supabase-ou-veja-o-arquivo-.env.local>` |

4. Clique em **Deploy**.
5. Assim que o deploy terminar (cerca de 1 a 2 minutos), acesse a URL gerada pela Vercel e faça login com o e-mail `potfinanceiro.adm@gmail.com` e a senha que você cadastrou no Supabase!
