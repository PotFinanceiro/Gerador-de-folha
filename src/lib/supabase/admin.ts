import { createClient } from "@supabase/supabase-js";
import { Database } from "./types";

/**
 * Cliente Supabase com permissões de Administrador (Service Role).
 *
 * ATENÇÃO: Nunca exponha este cliente ao navegador! Ele deve ser utilizado
 * apenas em rotas de API seguras no servidor ou webhooks internos.
 */
export function criarClienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "A variável SUPABASE_SERVICE_ROLE_KEY não foi configurada no ambiente."
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

