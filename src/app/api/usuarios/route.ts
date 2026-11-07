import { NextRequest, NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ erro: "Faça login para continuar." }, { status: 401 });
  }

  // Verifica se o solicitante é ADMIN
  const { data: meuPerfil } = await supabase
    .from("perfis")
    .select("perfil")
    .eq("id", user.id)
    .single();

  if (meuPerfil?.perfil !== "ADMIN") {
    return NextResponse.json(
      { erro: "Apenas administradores podem acessar a lista de usuários." },
      { status: 403 }
    );
  }

  // Busca todos os perfis
  const { data: usuarios, error } = await supabase
    .from("perfis")
    .select("id, nome, email, perfil, ativo, criado_em")
    .order("ativo", { ascending: false })
    .order("nome", { ascending: true });

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  // Compatibilidade com o formato esperado pelo painel
  const listaFormatada = (usuarios || []).map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil,
    ativo: u.ativo,
    criadoEm: u.criado_em,
  }));

  return NextResponse.json({ usuarios: listaFormatada, eu: user.id });
}

export async function POST(req: NextRequest) {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ erro: "Faça login para continuar." }, { status: 401 });
  }

  const { data: meuPerfil } = await supabase
    .from("perfis")
    .select("perfil")
    .eq("id", user.id)
    .single();

  if (meuPerfil?.perfil !== "ADMIN") {
    return NextResponse.json(
      { erro: "Apenas administradores podem cadastrar novos usuários." },
      { status: 403 }
    );
  }

  const { nome, email, senha, perfil } = await req.json().catch(() => ({}));
  if (!nome?.trim() || !email?.trim() || !senha) {
    return NextResponse.json({ erro: "Preencha nome, email e senha." }, { status: 400 });
  }

  if (String(senha).length < 6) {
    return NextResponse.json({ erro: "A senha deve ter ao menos 6 caracteres." }, { status: 400 });
  }

  const papel = perfil === "ADMIN" ? "ADMIN" : "USUARIO";
  const emailLimpo = String(email).trim().toLowerCase();
  const nomeLimpo = String(nome).trim();

  try {
    const admin = criarClienteAdmin();

    // 1. Cria o usuário no Supabase Auth
    const { data: novoUser, error: authError } = await admin.auth.admin.createUser({
      email: emailLimpo,
      password: String(senha),
      email_confirm: true,
      user_metadata: {
        nome: nomeLimpo,
        perfil: papel,
      },
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        return NextResponse.json({ erro: "Já existe um usuário com este email." }, { status: 409 });
      }
      return NextResponse.json({ erro: authError.message }, { status: 400 });
    }

    if (!novoUser.user) {
      return NextResponse.json({ erro: "Não foi possível criar o usuário." }, { status: 500 });
    }

    // 2. Garante o registro na tabela pública de perfis
    const { data: perfilCriado, error: perfilError } = await admin
      .from("perfis")
      .upsert({
        id: novoUser.user.id,
        nome: nomeLimpo,
        email: emailLimpo,
        perfil: papel,
        ativo: true,
      })
      .select("id, nome, email, perfil, ativo, criado_em")
      .single();

    if (perfilError) {
      return NextResponse.json({ erro: perfilError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      usuario: {
        id: perfilCriado.id,
        nome: perfilCriado.nome,
        email: perfilCriado.email,
        perfil: perfilCriado.perfil,
        ativo: perfilCriado.ativo,
        criadoEm: perfilCriado.criado_em,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno no servidor.";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
