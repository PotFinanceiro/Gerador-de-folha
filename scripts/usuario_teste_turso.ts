/**
 * Usuário de teste que existe SÓ no Turso (não no SQLite local).
 * Serve para provar, ponta a ponta, que a aplicação está lendo o banco da nuvem.
 *
 *   bun scripts/usuario_teste_turso.ts            → cria o usuário de teste
 *   bun scripts/usuario_teste_turso.ts --limpar   → remove o usuário de teste
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { readFileSync } from "node:fs";
import { scryptSync, randomBytes } from "node:crypto";

const env: Record<string, string> = {};
for (const linha of readFileSync("db/turso.env", "utf8").split("\n")) {
  const m = linha.match(/^([A-Z_]+)=(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}

const db = new PrismaClient({
  adapter: new PrismaLibSQL({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  }),
});

const EMAIL = "teste-turso@waycode.local";

if (process.argv[2] === "--limpar") {
  await db.usuario.deleteMany({ where: { email: EMAIL } });
  console.log("OK: usuário de teste removido do Turso");
} else {
  const salt = randomBytes(16).toString("hex");
  const senhaHash = `${salt}:${scryptSync("TesteTurso@123", salt, 64).toString("hex")}`;
  await db.usuario.upsert({
    where: { email: EMAIL },
    update: { senhaHash, ativo: true },
    create: {
      id: `teste-${Date.now()}`,
      nome: "Teste Turso",
      email: EMAIL,
      senhaHash,
      perfil: "USUARIO",
      ativo: true,
    },
  });
  console.log("OK: usuário de teste criado SÓ no Turso");
}

await db.$disconnect();
