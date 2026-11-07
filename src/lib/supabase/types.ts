/**
 * Tipagens do Banco de Dados Supabase (PostgreSQL)
 * Programa Operação Trabalho / Rede Cidadã · By WayCode
 */

export type PapelUsuario = "ADMIN" | "USUARIO";
export type TipoJob = "FOLHA_PONTO" | "CARTA_BANCO";
export type StatusJob = "PENDENTE" | "PROCESSANDO" | "CONCLUIDO" | "ERRO";

export interface Perfil {
  id: string; // uuid referente ao auth.users
  nome: string;
  email: string;
  perfil: PapelUsuario;
  ativo: boolean;
  criado_em: string;
}

export interface Job {
  id: string;
  usuario_id: string | null;
  tipo: TipoJob;
  status: StatusJob;
  mes: number | null;
  ano: number | null;
  folgas: string | null;
  extra: string | null;
  data_carta: string | null;
  arquivo_entrada_path: string;
  arquivo_saida_zip_path: string | null;
  preview_imagem_path: string | null;
  total_beneficiarios: number;
  resumo: Record<string, any>;
  mensagem_erro: string | null;
  criado_em: string;
  atualizado_em: string;
  finalizado_em: string | null;
}

export interface Database {
  public: {
    Tables: {
      perfis: {
        Row: Perfil;
        Insert: {
          id: string;
          nome: string;
          email: string;
          perfil?: PapelUsuario;
          ativo?: boolean;
          criado_em?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          email?: string;
          perfil?: PapelUsuario;
          ativo?: boolean;
          criado_em?: string;
        };
      };
      jobs: {
        Row: Job;
        Insert: {
          id?: string;
          usuario_id?: string | null;
          tipo: TipoJob;
          status?: StatusJob;
          mes?: number | null;
          ano?: number | null;
          folgas?: string | null;
          extra?: string | null;
          data_carta?: string | null;
          arquivo_entrada_path: string;
          arquivo_saida_zip_path?: string | null;
          preview_imagem_path?: string | null;
          total_beneficiarios?: number;
          resumo?: Record<string, any>;
          mensagem_erro?: string | null;
          criado_em?: string;
          atualizado_em?: string;
          finalizado_em?: string | null;
        };
        Update: {
          id?: string;
          usuario_id?: string | null;
          tipo?: TipoJob;
          status?: StatusJob;
          mes?: number | null;
          ano?: number | null;
          folgas?: string | null;
          extra?: string | null;
          data_carta?: string | null;
          arquivo_entrada_path?: string;
          arquivo_saida_zip_path?: string | null;
          preview_imagem_path?: string | null;
          total_beneficiarios?: number;
          resumo?: Record<string, any>;
          mensagem_erro?: string | null;
          criado_em?: string;
          atualizado_em?: string;
          finalizado_em?: string | null;
        };
      };
    };
  };
}

