import { NextRequest, NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
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
      { erro: "Apenas administradores podem alterar usuários." },
      { status: 403 }
    );
  }

  const { id } = await ctx.params;
  const { senha, perfil, ativo } = await req.json().catch(() => ({}));

  // Não permite revogar o próprio acesso de ADMIN ou se auto-desativar
  if (id === user.id && (ativo === false || (perfil && perfil !== "ADMIN"))) {
    return NextResponse.json(
      { erro: "Você não pode remover seu próprio acesso de administrador ou desativar sua conta." },
      { status: 400 }
    );
  }

  const admin = criarClienteAdmin();

  // Verifica se o alvo existe
  const { data: alvo } = await admin
    .from("perfis")
    .select("id, perfil, ativo")
    .eq("id", id)
    .single();

  if (!alvo) {
    return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });
  }

  // Se a alteração remover um administrador, garante que ainda reste pelo menos um ativo
  const perdeAdmin =
    alvo.perfil === "ADMIN" && ((perfil && perfil !== "ADMIN") || ativo === false);

  if (perdeAdmin) {
    const { count } = await admin
      .from("perfis")
      .select("id", { count: "exact", head: true })
      .eq("perfil", "ADMIN")
      .eq("ativo", true)
      .neq("id", id);

    if (!count || count === 0) {
      return NextResponse.json(
        { erro: "Deve existir pelo menos um administrador ativo no sistema." },
        { status: 400 }
      );
    }
  }

  // 1. Atualiza senha no Supabase Auth se fornecida
  if (senha) {
    if (String(senha).length < 6) {
      return NextResponse.json(
        { erro: "A senha deve ter ao menos 6 caracteres." },
        { status: 400 }
      );
    }
    const { error: senhaError } = await admin.auth.admin.updateUserById(id, {
      password: String(senha),
    });
    if (senhaError) {
      return NextResponse.json({ erro: senhaError.message }, { status: 500 });
    }
  }

  // 2. Atualiza dados na tabela de perfis
  const updates: Record<string, any> = {};
  if (perfil) updates.perfil = perfil === "ADMIN" ? "ADMIN" : "USUARIO";
  if (typeof ativo === "boolean") updates.ativo = ativo;

  if (Object.keys(updates).length > 0) {
    const { data: perfilAtualizado, error: updateError } = await admin
      .from("perfis")
      .update(updates)
      .eq("id", id)
      .select("id, nome, email, perfil, ativo, criado_em")
      .single();

    if (updateError) {
      return NextResponse.json({ erro: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      usuario: {
        id: perfilAtualizado.id,
        nome: perfilAtualizado.nome,
        email: perfilAtualizado.email,
        perfil: perfilAtualizado.perfil,
        ativo: perfilAtualizado.ativo,
        criadoEm: perfilAtualizado.criado_em,
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
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
      { erro: "Apenas administradores podem excluir usuários." },
      { status: 403 }
    );
  }

  const { id } = await ctx.params;
  if (id === user.id) {
    return NextResponse.json(
      { erro: "Você não pode excluir o seu próprio usuário." },
      { status: 400 }
    );
  }

  const admin = criarClienteAdmin();

  // Verifica se o alvo é ADMIN e se é o último
  const { data: alvo } = await admin
    .from("perfis")
    .select("perfil")
    .eq("id", id)
    .single();

  if (!alvo) {
    return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });
  }

  if (alvo.perfil === "ADMIN") {
    const { count } = await admin
      .from("perfis")
      .select("id", { count: "exact", head: true })
      .eq("perfil", "ADMIN")
      .eq("ativo", true)
      .neq("id", id);

    if (!count || count === 0) {
      return NextResponse.json(
        { erro: "Deve existir pelo menos um administrador ativo no sistema." },
        { status: 400 }
      );
    }
  }

  // Deleta o usuário do Supabase Auth (o CASCADE do Postgres remove da tabela perfis automaticamente)
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
