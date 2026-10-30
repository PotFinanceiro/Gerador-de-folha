import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exigirAdmin, hashSenha, Perfil } from "@/lib/auth";

export const runtime = "nodejs";

const CAMPOS = { id: true, nome: true, email: true, perfil: true, ativo: true, criadoEm: true };

export async function GET() {
  const { s, negado } = await exigirAdmin();
  if (negado) return negado;
  const usuarios = await db.usuario.findMany({
    select: CAMPOS,
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });
  return NextResponse.json({ usuarios, eu: s!.id });
}

export async function POST(req: NextRequest) {
  const { negado } = await exigirAdmin();
  if (negado) return negado;

  const { nome, email, senha, perfil } = await req.json().catch(() => ({}));
  if (!nome?.trim() || !email || !senha)
    return NextResponse.json({ erro: "Preencha nome, email e senha." }, { status: 400 });
  if (String(senha).length < 6)
    return NextResponse.json({ erro: "A senha deve ter ao menos 6 caracteres." }, { status: 400 });
  const p = perfil === "ADMIN" ? "ADMIN" : "USUARIO";

  try {
    const u = await db.usuario.create({
      data: {
        nome: String(nome).trim(),
        email: String(email).trim().toLowerCase(),
        senhaHash: hashSenha(String(senha)),
        perfil: p,
      },
      select: CAMPOS,
    });
    return NextResponse.json({ ok: true, usuario: u });
  } catch (e: unknown) {
    const codigo = (e as { code?: string }).code;
    if (codigo === "P2002")
      return NextResponse.json({ erro: "Já existe um usuário com este email." }, { status: 409 });
    throw e;
  }
}
