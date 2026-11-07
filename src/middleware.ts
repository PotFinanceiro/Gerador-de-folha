import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Se as variáveis do Supabase ainda não foram configuradas (ex: antes de rodar o setup),
  // permite a passagem sem travar o servidor
  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Atualiza a sessão do usuário (renova JWT se expirado)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Rotas protegidas do sistema
  const rotasProtegidas = ["/folhas-de-ponto", "/emitir-carta", "/usuarios"];
  const ehRotaProtegida = rotasProtegidas.some((r) => path.startsWith(r));

  // 1. Se tentar acessar rota protegida sem estar autenticado -> redireciona para /login
  if (ehRotaProtegida && !user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Se já estiver logado e tentar acessar /login -> redireciona para a home do sistema
  if (path === "/login" && user) {
    const homeUrl = new URL("/folhas-de-ponto", request.url);
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Aplica o middleware a todas as rotas exceto:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico, icon.png, logos e imagens estáticas
     * - rotas públicas de API (ex: /api/health)
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

