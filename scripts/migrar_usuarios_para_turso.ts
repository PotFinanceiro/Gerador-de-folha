/**
 * Copia os usuários do SQLite local (definido em .env → DATABASE_URL)
 * para o banco Turso (valores em db/turso.env).
 *
 * Execução:  bun scripts/migrar_usuarios_para_turso.ts
 *
 * Usa exatamente o mesmo DDL de src/lib/db.ts, então o resultado é
 * idêntico ao que a aplicação cria na nuvem. A cópia é "upsert":
 * usuários que já existem no Turso (mesmo e-mail) são atualizados,
 * não duplicados.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { readFileSync } from "node:fs";

function lerEnv(caminho: string): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const linha of readFileSync(caminho, "utf8").split("\n")) {
    const m = linha.match(/^([A-Z_]+)=(.*)\s*$/);
    if (m) saida[m[1]] = m[2];
  }
  return saida;
}

const turso = lerEnv("db/turso.env");
if (!turso.TURSO_DATABASE_URL || !turso.TURSO_AUTH_TOKEN) {
  console.error("ERRO: db/turso.env sem TURSO_DATABASE_URL ou TURSO_AUTH_TOKEN");
  process.exit(1);
}

// Origem: SQLite local (DATABASE_URL do .env na raiz)
const origem = new PrismaClient();

// Destino: Turso na nuvem, mesmo adaptador usado pela aplicação
const destino = new PrismaClient({
  adapter: new PrismaLibSQL({
    url: turso.TURSO_DATABASE_URL,
    authToken: turso.TURSO_AUTH_TOKEN,
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

(async () => {
  for (const sql of DDL) await destino.$executeRawUnsafe(sql);

  const usuarios = await origem.usuario.findMany();
  console.log(`SQLite local tem ${usuarios.length} usuário(s).`);

  for (const u of usuarios) {
    await destino.usuario.upsert({
      where: { email: u.email },
      update: { nome: u.nome, senhaHash: u.senhaHash, perfil: u.perfil, ativo: u.ativo },
      create: {
        id: u.id,
        nome: u.nome,
        email: u.email,
        senhaHash: u.senhaHash,
        perfil: u.perfil,
        ativo: u.ativo,
        criadoEm: u.criadoEm,
      },
    });
    console.log(`→ ${u.email} (${u.perfil}) enviado ao Turso`);
  }

  const conferencia = await destino.usuario.findMany();
  console.log(`Turso agora tem ${conferencia.length} usuário(s):`);
  for (const u of conferencia) {
    console.log(`  - ${u.email} | ${u.perfil} | criado em ${u.criadoEm.toISOString().slice(0, 10)}`);
  }

  await origem.$disconnect();
  await destino.$disconnect();
  console.log("MIGRAÇÃO CONCLUÍDA");
})().catch((e) => {
  console.error("ERRO NA MIGRAÇÃO:", e);
  process.exit(1);
});
