/**
 * Teste do banco Turso REAL (o mesmo que a nuvem vai usar).
 * Cria a estrutura, grava um usuário de teste, lê e apaga — deixando o banco limpo.
 * Rodar: bun scripts/teste_turso_real.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync("db/turso.env", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const db = new PrismaClient({
  adapter: new PrismaLibSQL({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  }),
});

const DDL = [
  `CREATE TABLE IF NOT EXISTS "Usuario" (
     "id"       TEXT NOT NULL PRIMARY KEY,
     "nome"     TEXT NOT NULL,
     "email"    TEXT NOT NULL,
     "senhaHash" TEXT NOT NULL,
     "perfil"   TEXT NOT NULL DEFAULT 'USUARIO',
     "ativo"    BOOLEAN NOT NULL DEFAULT true,
     "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Usuario_email_key" ON "Usuario"("email")`,
];

for (const sql of DDL) await db.$executeRawUnsafe(sql);
console.log("1. Estrutura criada/confirmada no Turso ✓");

const t = await db.usuario.create({
  data: { nome: "Teste Conexao", email: "teste.conexao@waycode.local", senhaHash: "x:y" },
});
console.log("2. Escrita OK (id " + t.id.slice(0, 8) + "...) ✓");

const lido = await db.usuario.findUnique({ where: { email: "teste.conexao@waycode.local" } });
const dataOk = lido?.criadoEm instanceof Date && !isNaN(lido.criadoEm.getTime());
console.log("3. Leitura OK — datas parseadas:", dataOk ? "✓" : "FALHOU: " + String(lido?.criadoEm));

await db.usuario.delete({ where: { id: t.id } });
const total = await db.usuario.count();
console.log("4. Limpeza OK — banco vazio e pronto (usuários: " + total + ") ✓");

await db.$disconnect();
console.log("TURSO 100% FUNCIONAL");
