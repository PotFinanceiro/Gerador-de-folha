/**
 * Teste rápido de conexão com o Turso usando as credenciais de db/turso.env.
 * Uso: bun scripts/ping_turso.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { readFileSync } from "node:fs";

const env: Record<string, string> = {};
for (const linha of readFileSync("db/turso.env", "utf8").split("\n")) {
  const m = linha.match(/^([A-Z_]+)=(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}

if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
  console.error("ERRO: turso.env sem TURSO_DATABASE_URL ou TURSO_AUTH_TOKEN");
  process.exit(1);
}

const db = new PrismaClient({
  adapter: new PrismaLibSQL({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  }),
});

try {
  const usuarios = await db.usuario.findMany();
  console.log(`TURSO OK — ${usuarios.length} usuário(s) no banco:`);
  for (const u of usuarios) console.log(`  - ${u.email} (${u.perfil})`);
} catch (e) {
  console.error("TURSO ERRO:", (e as Error).message.slice(0, 200));
  process.exit(1);
} finally {
  await db.$disconnect();
}
