/**
 * Verifica se a senha candidata confere com o hash do admin no Turso.
 * Rodar: bun scripts/verificar_senha_admin.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { readFileSync } from "fs";
import { scryptSync, timingSafeEqual } from "crypto";

function carregarEnv(caminho: string) {
  return Object.fromEntries(
    readFileSync(caminho, "utf8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
}

const env = carregarEnv("db/turso.env");
const db = new PrismaClient({
  adapter: new PrismaLibSQL({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  }),
});

function conferir(senha: string, armazenada: string) {
  const [salt, hash] = armazenada.split(":");
  if (!salt || !hash) return false;
  const teste = scryptSync(senha, salt, 64);
  const origem = Buffer.from(hash, "hex");
  return origem.length === teste.length && timingSafeEqual(origem, teste);
}

const admin = await db.usuario.findUnique({ where: { email: "wagnerlima378@gmail.com" } });
if (!admin) {
  console.log("ADMIN NÃO ENCONTRADO no Turso!");
  process.exit(1);
}

console.log(`Admin: ${admin.email} | perfil=${admin.perfil} | ativo=${admin.ativo}`);
console.log(`Hash começa com: ${admin.senhaHash.slice(0, 12)}...`);

const candidatos: Array<[string, string]> = [
  ["ADMIN_SENHA_INICIAL (db/turso.env)", env.ADMIN_SENHA_INICIAL ?? ""],
  ["Wayaa3f68919925@30", "Wayaa3f68919925@30"],
];

let algumaBateu = false;
for (const [nome, senha] of candidatos) {
  if (!senha) continue;
  const ok = conferir(senha, admin.senhaHash);
  console.log(`${ok ? "✓ CONFERE" : "✗ não confere"} — ${nome}`);
  if (ok) algumaBateu = true;
}

if (!algumaBateu) {
  console.log("\nNENHUMA candidata bateu → senha do admin no Turso é OUTRA (foi trocada pelo usuário no app).");
  console.log("Listando todos os usuários do Turso:");
  const todos = await db.usuario.findMany({ select: { email: true, perfil: true, ativo: true } });
  for (const u of todos) console.log(`  - ${u.email} (${u.perfil}, ativo=${u.ativo})`);
}
