// Troca a senha do administrador no banco atual (hash scrypt, mesmo formato do auth.ts)
import { randomBytes, scryptSync } from "crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const salt = randomBytes(16).toString("hex");
const senhaHash = `${salt}:${scryptSync("Waylian@102030", salt, 64).toString("hex")}`;

const u = await db.usuario.update({
  where: { email: "wagnerlima378@gmail.com" },
  data: { senhaHash },
  select: { nome: true, email: true },
});
console.log("Senha atualizada para:", u);
await db.$disconnect();
