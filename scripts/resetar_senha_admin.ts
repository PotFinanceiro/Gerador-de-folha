/**
 * Diagnóstico + reset da senha do admin.
 * 1. Testa candidatos ("Admin@123" e a documentada) contra os hashes Turso/local.
 * 2. Redefine a senha do admin para o valor documentado em db/turso.env
 *    (ADMIN_SENHA_INICIAL) em AMBOS os bancos — Turso e local.
 * Rodar: bun scripts/resetar_senha_admin.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { readFileSync } from "fs";
import { scryptSync, timingSafeEqual, randomBytes } from "crypto";
import { Database } from "bun:sqlite";

function carregarEnv(caminho: string) {
  return Object.fromEntries(
    readFileSync(caminho, "utf8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
}

const env = carregarEnv("db/turso.env");
const SENHA = env.ADMIN_SENHA_INICIAL ?? "Wayaa3f68919925@30";
const EMAIL = "wagnerlima378@gmail.com";

function conferir(senha: string, armazenada: string) {
  const [salt, hash] = armazenada.split(":");
  if (!salt || !hash) return false;
  const teste = scryptSync(senha, salt, 64);
  const origem = Buffer.from(hash, "hex");
  return origem.length === teste.length && timingSafeEqual(origem, teste);
}

function hashSenha(senha: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(senha, salt, 64).toString("hex")}`;
}

/* ---------- 1. Diagnóstico ---------- */
const dbTurso = new PrismaClient({
  adapter: new PrismaLibSQL({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN }),
});
const adminTurso = await dbTurso.usuario.findUnique({ where: { email: EMAIL } });
console.log("=== DIAGNÓSTICO ===");
if (adminTurso) {
  console.log(`Turso: hash=${adminTurso.senhaHash.slice(0, 12)}...`);
  console.log(`  "Admin@123"     → ${conferir("Admin@123", adminTurso.senhaHash) ? "✓ CONFERE (foi re-semeado com fallback!)" : "✗"}`);
  console.log(`  senha documentada → ${conferir(SENHA, adminTurso.senhaHash) ? "✓ CONFERE" : "✗"}`);
}
const dbLocal = new Database("db/custom.db", { readonly: true });
const adminLocal = dbLocal.query("SELECT email, senhaHash FROM Usuario WHERE email=?").get(EMAIL) as any;
if (adminLocal) {
  console.log(`Local: hash=${adminLocal.senhaHash.slice(0, 12)}...`);
  console.log(`  "Admin@123"     → ${conferir("Admin@123", adminLocal.senhaHash) ? "✓ CONFERE" : "✗"}`);
  console.log(`  senha documentada → ${conferir(SENHA, adminLocal.senhaHash) ? "✓ CONFERE" : "✗"}`);
}

/* ---------- 2. Reset para a senha documentada ---------- */
console.log("\n=== RESET ===");
const novoHash = hashSenha(SENHA);
await dbTurso.usuario.update({ where: { email: EMAIL }, data: { senhaHash: novoHash, ativo: true } });
console.log(`Turso: senha redefinida ✓ (hash ${novoHash.slice(0, 12)}...)`);

const dbW = new Database("db/custom.db");
dbW.query("UPDATE Usuario SET senhaHash=? WHERE email=?").run(novoHash, EMAIL);
dbW.close();
console.log(`Local: senha redefinida ✓ (mesmo hash)`);

/* ---------- 3. Confirmação ---------- */
const depois = await dbTurso.usuario.findUnique({ where: { email: EMAIL } });
console.log(`\nConfirmação Turso: ${conferir(SENHA, depois!.senhaHash) ? "✓ senha documentada CONFERE agora" : "✗ FALHOU"}`);
console.log(`Login será: ${EMAIL} / ${SENHA}`);
