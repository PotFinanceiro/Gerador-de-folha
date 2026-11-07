import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

/**
 * Banco de dados do sistema.
 *
 * Dois modos, escolhidos automaticamente:
 *
 * 1. LOCAL / SERVIDOR PRÓPRIO (padrão): SQLite em arquivo, definido em
 *    DATABASE_URL (arquivo .env). Comportamento de sempre.
 *
 * 2. NUVEM (hospedagem gratuita): se a variável TURSO_DATABASE_URL estiver
 *    definida, usa o Turso (banco libSQL gratuito na internet, sem cartão).
 *    Nesse modo a estrutura da tabela é criada automaticamente na primeira
 *    execução, e os dados ficam guardados fora do servidor — sobrevivem a
 *    reinícios, reconstruções e hibernação da hospedagem.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  bancoPronto?: Promise<void>;
};

/* Estrutura equivalente ao modelo Usuario do prisma/schema.prisma. */
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

function criarDb(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL;

  // Modo 1: SQLite em arquivo (comportamento atual, nada muda).
  if (!url) return new PrismaClient({ log: ["query"] });

  // Modo 2: Turso (libSQL) na nuvem, via adaptador de driver do Prisma.
  const cliente = new PrismaClient({
    adapter: new PrismaLibSQL({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    }),
  });

  // Garante a estrutura mínima no banco novo (executa uma vez por processo).
  globalForPrisma.bancoPronto = (async () => {
    for (const sql of DDL) await cliente.$executeRawUnsafe(sql);
  })();

  return cliente;
}

export const db = globalForPrisma.prisma ?? criarDb();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/**
 * Aguarda a preparação do banco (criação de estrutura no Turso).
 * Chamado antes do primeiro acesso (login). Em modo local é imediato.
 */
export async function bancoPronto(): Promise<void> {
  const p = globalForPrisma.bancoPronto;
  if (p) await p;
}
