import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "./types";

/**
 * Cliente Supabase para o lado do Servidor (Server Components, Server Actions e Route Handlers).
 *
 * Lê e persiste a sessão automaticamente usando cookies HTTP-only do Next.js.
 */
export async function criarClienteServidor() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // O método `setAll` pode ser chamado a partir de um Server Component
          // onde a gravação de cookies é restrita. O middleware cuida da renovação real.
        }
      },
    },
  });
}

