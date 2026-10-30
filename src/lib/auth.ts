import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";
import { db, bancoPronto } from "@/lib/db";

export type Perfil = "ADMIN" | "USUARIO";
export type Sessao = { id: string; nome: string; email: string; perfil: Perfil };

const COOKIE = "sessao";
const MAXIMO = 7 * 24 * 60 * 60; // 7 dias

/* ---------- senhas ---------- */

export function hashSenha(senha: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(senha, salt, 64).toString("hex")}`;
}

export function conferirSenha(senha: string, armazenada: string) {
  const [salt, hash] = armazenada.split(":");
  if (!salt || !hash) return false;
  const teste = scryptSync(senha, salt, 64);
  const origem = Buffer.from(hash, "hex");
  return origem.length === teste.length && timingSafeEqual(origem, teste);
}

/* ---------- segredo da sessão (criado uma vez em db/segredo.key) ---------- */

let SEGREDO: string | null = null;

function segredo() {
  if (SEGREDO) return SEGREDO;
  if (process.env.SESSAO_SEGREDO) return (SEGREDO = process.env.SESSAO_SEGREDO);
  const arq = path.join(process.cwd(), "db", "segredo.key");
  try {
    SEGREDO = fs.readFileSync(arq, "utf8").trim();
  } catch {}
  if (!SEGREDO) {
    SEGREDO = randomBytes(32).toString("hex");
    fs.mkdirSync(path.dirname(arq), { recursive: true });
    fs.writeFileSync(arq, SEGREDO);
  }
  return SEGREDO;
}

const assinar = (valor: string) =>
  createHmac("sha256", segredo()).update(valor).digest("base64url");

/* ---------- sessão em cookie httpOnly assinado ---------- */

export async function criarSessao(u: Sessao) {
  const corpo = Buffer.from(JSON.stringify(u)).toString("base64url");
  (await cookies()).set(COOKIE, `${corpo}.${assinar(corpo)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAXIMO,
  });
}

export async function lerSessao(): Promise<Sessao | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [corpo, mac] = token.split(".");
  if (!corpo || !mac) return null;
  const esperado = Buffer.from(assinar(corpo));
  const recebido = Buffer.from(mac);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  try {
    return JSON.parse(Buffer.from(corpo, "base64url").toString());
  } catch {
    return null;
  }
}

export async function apagarSessao() {
  (await cookies()).delete(COOKIE);
}

/* ---------- guardas para rotas de API ---------- */

const negar = (msg: string, status: number) =>
  ({ s: null, negado: NextResponse.json({ erro: msg }, { status }) });

export async function exigirSessao() {
  const s = await lerSessao();
  return s ? { s, negado: null } : negar("Faça login para continuar.", 401);
}

export async function exigirAdmin() {
  const r = await exigirSessao();
  if (r.negado) return r;
  return r.s.perfil === "ADMIN" ? r : negar("Apenas o administrador pode fazer isto.", 403);
}

/* ---------- admin inicial (só quando o banco está vazio) ---------- */

export async function garantirAdminInicial() {
  await bancoPronto(); // garante a estrutura do banco (necessário no Turso)
  if ((await db.usuario.count()) === 0) {
    await db.usuario.create({
      data: {
        nome: "Administrador",
        email: "wagnerlima378@gmail.com",
        // Em produção na nuvem, defina ADMIN_SENHA_INICIAL como segredo.
        senhaHash: hashSenha(process.env.ADMIN_SENHA_INICIAL || "Admin@123"),
        perfil: "ADMIN",
      },
    });
  }
}
