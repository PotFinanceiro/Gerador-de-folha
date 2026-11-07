import { createBrowserClient } from "@supabase/ssr";
import { Database } from "./types";

/**
 * Cliente Supabase para uso no Navegador (Client Components).
 *
 * Utiliza as variáveis públicas de ambiente:
 * NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
export function criarClienteNavegador() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createBrowserClient<Database>(url, anonKey);
}

