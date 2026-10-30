import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conferirSenha, criarSessao, garantirAdminInicial, Perfil } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { email, senha } = await req.json().catch(() => ({}));
  if (!email || !senha)
    return NextResponse.json({ erro: "Informe email e senha." }, { status: 400 });

  await garantirAdminInicial();
  const u = await db.usuario.findUnique({
    where: { email: String(email).trim().toLowerCase() },
  });
  if (!u || !u.ativo || !conferirSenha(String(senha), u.senhaHash))
    return NextResponse.json({ erro: "Email ou senha incorretos." }, { status: 401 });

  await criarSessao({
    id: u.id,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil as Perfil,
  });
  return NextResponse.json({ ok: true, nome: u.nome, perfil: u.perfil });
}
