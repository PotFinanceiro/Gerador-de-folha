# Hospedagem gratuita (sem cartão de crédito) — plano "até sair a verba"

Este guia descreve como colocar o sistema **Programa Operação Trabalho — Rede
Cidadã · By WayCode** no ar **de graça, sem cartão de crédito**, usando:

| Peça | Serviço | Plano gratuito | Por quê |
| --- | --- | --- | --- |
| Aplicação (Next.js + Python + LibreOffice) | **Hugging Face Spaces** (contêiner Docker) | 2 vCPU, 16 GB RAM | Um dos poucos lugares que rodam LibreOffice de graça, com folga de memória |
| Banco de dados (usuários/login) | **Turso** (libSQL) | 9 GB, 1 bilhão de leituras/mês | Compatível com o SQLite atual, gratuito, sem cartão, não hiberna |

Quando a verba sair, a migração para um VPS é só rodar o `deploy/docker-compose.yml`
que já existe — nada do sistema precisa ser refeito.

---

## Parte 1 — Criar o banco no Turso (5 minutos, sem cartão)

1. Acesse **https://turso.tech** e clique em *Get Started*.
2. Crie a conta: pode entrar com GitHub ou e-mail. **Não pede cartão.**
3. No painel, clique em **Create Database**:
   - Name: `operacao-trabalho` (ou outro nome simples)
   - Location: escolha **São Paulo (sao)** se aparecer; senão qualquer um serve.
4. Depois de criado, na página do banco copie:
   - **Database URL** → começa com `libsql://...`
   - Em *Tokens* (ou botão "Generate Token"): gere um token e copie o
     **database token**.

> Guarde esses dois valores — serão usados como segredos na Parte 3.

## Parte 2 — Criar a conta no Hugging Face (5 minutos, sem cartão)

1. Acesse **https://huggingface.co/join** e crie a conta (e-mail + confirmação).
2. Crie o Space que vai hospedar o sistema:
   - Canto superior direito: **New → Space**
   - Space name: `operacao-trabalho`
   - SDK: **Docker** → template *Blank*
   - Visibilidade: **Public** (o código fica visível, mas não há nenhum segredo
     ou dado pessoal dentro dele; quem usa o sistema passa pelo nosso login. Um
     Space *Private* bloquearia o acesso da equipe, pois exigiria login do HF
     para cada pessoa.)
3. Crie um token de acesso para eu poder publicar o código:
   - Perfil (foto) → **Settings → Access Tokens → Create new token**
   - Tipo: **Write**
   - Copie o token (começa com `hf_...`).

## Parte 3 — Publicação (feita por mim, com os dados acima)

Com o **URL + token do Turso** e o **token de escrita do HF**, eu faço:

1. `git push` do código para o Space (o HF constrói a imagem sozinho, uns
   8–12 minutos na primeira vez).
2. Configuro os segredos no Space (**Settings → Variables and secrets**):

   | Nome | Valor | Para quê |
   | --- | --- | --- |
   | `TURSO_DATABASE_URL` | `libsql://...` | endereço do banco |
   | `TURSO_AUTH_TOKEN` | token do Turso | acesso ao banco |
   | `SESSAO_SEGREDO` | chave aleatória longa | assina os cookies de login |
   | `ADMIN_SENHA_INICIAL` | senha forte à sua escolha | senha do 1º acesso do admin |

3. Testo o sistema no endereço `https://SEU-USUARIO-operacao-trabalho.hf.space`.

## Primeiro acesso

1. Entre em `/login` com `wagnerlima378@gmail.com` e a senha de
   `ADMIN_SENHA_INICIAL`.
2. Vá em **Usuários** e cadastre a equipe.
3. Troque a senha do admin no painel (recomendado).

## Limitações do plano gratuito (importantes)

- **Hibernação**: se ninguém usar por 48 horas, o Space "dorme". O próximo
  acesso demora 1–2 minutos para acordar. Os dados **não se perdem** (ficam no
  Turso); só a espera inicial.
- **Arquivos temporários**: planilhas enviadas e PDFs gerados ficam em pasta
  temporária e são apagados a cada reinício. Não há problema: a geração é
  feita na hora e baixada na hora.
- **Espaço público**: o código-fonte fica visível. Nenhum segredo fica no
  código — tudo está nos segredos do Space. Os templates Word ficam visíveis,
  o que é aceitável; se um dia não for, migramos para o plano pago.

## Quando a verba sair (migração em ~30 minutos)

1. Contratar um VPS pequeno (ex.: 1 vCPU / 2 GB, R$ 20–40/mês).
2. Instalar Docker e clonar o projeto.
3. `docker compose -f deploy/docker-compose.yml up -d --build`
4. Apontar o domínio. Banco: pode manter o Turso ou voltar ao SQLite local
   (o compose já suporta os dois).

---

*Documento gerado em 30/10/2026 · By WayCode*
