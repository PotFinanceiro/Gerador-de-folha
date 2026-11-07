-- ==============================================================================
--  SCHEMA DE BANCO DE DADOS & STORAGE PARA SUPABASE
--  Programa Operação Trabalho / Rede Cidadã · By WayCode
--
--  Instruções:
--  1. Acesse o painel do seu projeto no Supabase (https://supabase.com).
--  2. Abra a aba "SQL Editor" no menu lateral.
--  3. Cole este script completo e clique em "Run".
-- ==============================================================================

-- 1. HABILITAR EXTENSÕES ESSENCIAIS
create extension if not exists "uuid-ossp";

-- ==============================================================================
-- 2. TABELA DE PERFIS DE USUÁRIO (public.perfis)
-- Espelha os usuários criados no Supabase Auth e gerencia permissões (ADMIN / USUARIO).
-- ==============================================================================
create table if not exists public.perfis (
  id uuid references auth.users(id) on delete cascade primary key,
  nome text not null,
  email text not null,
  perfil text not null default 'USUARIO' check (perfil in ('ADMIN', 'USUARIO')),
  ativo boolean not null default true,
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativar Row Level Security (RLS) na tabela de perfis
alter table public.perfis enable row level security;

-- Políticas de acesso para perfis:
-- a) Usuários autenticados podem ver o próprio perfil
create policy "Usuários podem visualizar o próprio perfil"
  on public.perfis for select
  using (auth.uid() = id);

-- b) Administradores podem visualizar todos os perfis
create policy "Admins podem visualizar todos os perfis"
  on public.perfis for select
  using (
    exists (
      select 1 from public.perfis
      where id = auth.uid() and perfil = 'ADMIN'
    )
  );

-- c) Administradores podem atualizar perfis (ativar/desativar, mudar perfil)
create policy "Admins podem atualizar perfis"
  on public.perfis for update
  using (
    exists (
      select 1 from public.perfis
      where id = auth.uid() and perfil = 'ADMIN'
    )
  );

-- ==============================================================================
-- 3. TRIGGER AUTOMÁTICO: CRIAR PERFIL AO REGISTRAR NO AUTH
-- Toda vez que um usuário for criado no Supabase Auth, cria a linha em public.perfis.
-- ==============================================================================
create or replace function public.tratar_novo_usuario()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  primeiro_usuario boolean;
begin
  -- O primeiro usuário cadastrado no sistema torna-se ADMIN automaticamente
  select not exists (select 1 from public.perfis) into primeiro_usuario;

  insert into public.perfis (id, nome, email, perfil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    case when primeiro_usuario then 'ADMIN' else coalesce(new.raw_user_meta_data->>'perfil', 'USUARIO') end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.tratar_novo_usuario();

-- ==============================================================================
-- 4. TABELA DE PROCESSAMENTO DE LOTES (public.jobs)
-- Registra as solicitações de geração de Folhas de Ponto e Cartas.
-- ==============================================================================
create table if not exists public.jobs (
  id uuid default gen_random_uuid() primary key,
  usuario_id uuid references auth.users(id) on delete set null,
  tipo text not null check (tipo in ('FOLHA_PONTO', 'CARTA_BANCO')),
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'PROCESSANDO', 'CONCLUIDO', 'ERRO')),
  
  -- Parâmetros do lote
  mes integer check (mes >= 1 and mes <= 12),
  ano integer,
  folgas text default '1,2',
  extra text default '',
  data_carta date,
  
  -- Caminhos no Supabase Storage
  arquivo_entrada_path text not null,
  arquivo_saida_zip_path text,
  preview_imagem_path text,
  
  -- Informações de resultado
  total_beneficiarios integer default 0,
  resumo jsonb default '{}'::jsonb,
  mensagem_erro text,
  
  -- Auditoria de tempo
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null,
  atualizado_em timestamp with time zone default timezone('utc'::text, now()) not null,
  finalizado_em timestamp with time zone
);

-- Ativar Row Level Security (RLS) na tabela de jobs
alter table public.jobs enable row level security;

-- Políticas de acesso para jobs:
-- a) Usuários podem ver apenas os seus próprios jobs gerados
create policy "Usuários podem ver seus próprios jobs"
  on public.jobs for select
  using (auth.uid() = usuario_id);

-- b) Usuários autenticados podem criar jobs
create policy "Usuários podem criar jobs"
  on public.jobs for insert
  with check (auth.uid() = usuario_id);

-- c) Administradores podem visualizar todos os jobs
create policy "Admins podem ver todos os jobs"
  on public.jobs for select
  using (
    exists (
      select 1 from public.perfis
      where id = auth.uid() and perfil = 'ADMIN'
    )
  );

-- d) Service Role (Worker) e o próprio usuário podem atualizar o status do job
create policy "Service Role ou criador pode atualizar jobs"
  on public.jobs for update
  using (auth.uid() = usuario_id or auth.role() = 'service_role');

-- Trigger para atualizar a coluna atualizado_em
create or replace function public.atualizar_timestamp_job()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = timezone('utc'::text, now());
  return new;
end;
$$;

create trigger trigger_atualizar_timestamp_job
  before update on public.jobs
  for each row execute procedure public.atualizar_timestamp_job();

-- ==============================================================================
-- 5. REALTIME: NOTIFICAÇÃO EM TEMPO REAL
-- Permite que o frontend Vercel escute alterações na tabela jobs via WebSocket.
-- ==============================================================================
alter publication supabase_realtime add table public.jobs;

-- ==============================================================================
-- 6. CONFIGURAÇÃO DOS BUCKETS DO SUPABASE STORAGE
-- Cria os buckets privados 'planilhas' e 'documentos-gerados'.
-- ==============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values 
  ('planilhas', 'planilhas', false, 52428800, array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel.sheet.macroEnabled.12', 'application/vnd.ms-excel']),
  ('documentos-gerados', 'documentos-gerados', false, 104857600, array['application/zip', 'image/png', 'application/pdf'])
on conflict (id) do nothing;

-- Políticas de Storage:
-- a) Permitir upload de planilhas por usuários autenticados
create policy "Usuários autenticados podem enviar planilhas"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'planilhas');

-- b) Permitir leitura/download da própria planilha e dos documentos gerados
create policy "Acesso a arquivos no storage"
  on storage.objects for select
  to authenticated
  using (bucket_id in ('planilhas', 'documentos-gerados'));

-- c) Permitir exclusão de arquivos pelos usuários autenticados ou service role
create policy "Exclusão de arquivos no storage"
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('planilhas', 'documentos-gerados'));

