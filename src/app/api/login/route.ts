import { NextRequest, NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { email, senha } = await req.json().catch(() => ({}));
  if (!email || !senha) {
    return NextResponse.json({ erro: "Informe email e senha." }, { status: 400 });
  }

  try {
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email).trim().toLowerCase(),
      password: String(senha),
    });

    if (error || !data.user) {
      return NextResponse.json({ erro: "Email ou senha incorretos." }, { status: 401 });
    }

    // Verifica se o usuário está ativo
    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome, perfil, ativo")
      .eq("id", data.user.id)
      .single();

    if (perfil && !perfil.ativo) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { erro: "Este usuário foi desativado pelo administrador." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      nome: perfil?.nome || data.user.email?.split("@")[0] || "Usuário",
      perfil: perfil?.perfil || "USUARIO",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro inesperado ao autenticar.";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
