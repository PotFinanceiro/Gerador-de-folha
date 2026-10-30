import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exigirAdmin, hashSenha, Perfil } from "@/lib/auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { s, negado } = await exigirAdmin();
  if (negado) return negado;

  const { id } = await ctx.params;
  const { senha, perfil, ativo } = await req.json().catch(() => ({}));

  if (id === s!.id && (ativo === false || (perfil && perfil !== "ADMIN")))
    return NextResponse.json(
      { erro: "Você não pode remover seu próprio acesso de administrador." },
      { status: 400 }
    );

  const alvo = await db.usuario.findUnique({ where: { id } });
  if (!alvo) return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });

  // mantém sempre um administrador ativo
  const perdeAdmin =
    alvo.perfil === "ADMIN" && ((perfil && perfil !== "ADMIN") || ativo === false);
  if (perdeAdmin) {
    const admins = await db.usuario.count({
      where: { perfil: "ADMIN", ativo: true, id: { not: id } },
    });
    if (admins === 0)
      return NextResponse.json(
        { erro: "Deve existir pelo menos um administrador ativo." },
        { status: 400 }
      );
  }

  const dados: { senhaHash?: string; perfil?: Perfil; ativo?: boolean } = {};
  if (senha) {
    if (String(senha).length < 6)
      return NextResponse.json({ erro: "A senha deve ter ao menos 6 caracteres." }, { status: 400 });
    dados.senhaHash = hashSenha(String(senha));
  }
  if (perfil) dados.perfil = perfil === "ADMIN" ? "ADMIN" : "USUARIO";
  if (typeof ativo === "boolean") dados.ativo = ativo;

  const u = await db.usuario.update({
    where: { id },
    data: dados,
    select: { id: true, nome: true, email: true, perfil: true, ativo: true, criadoEm: true },
  });
  return NextResponse.json({ ok: true, usuario: u });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { s, negado } = await exigirAdmin();
  if (negado) return negado;

  const { id } = await ctx.params;
  if (id === s!.id)
    return NextResponse.json({ erro: "Você não pode excluir o seu próprio usuário." }, { status: 400 });

  const alvo = await db.usuario.findUnique({ where: { id } });
  if (!alvo) return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });
  if (alvo.perfil === "ADMIN") {
    const admins = await db.usuario.count({
      where: { perfil: "ADMIN", ativo: true, id: { not: id } },
    });
    if (admins === 0)
      return NextResponse.json(
        { erro: "Deve existir pelo menos um administrador ativo." },
        { status: 400 }
      );
  }

  await db.usuario.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
