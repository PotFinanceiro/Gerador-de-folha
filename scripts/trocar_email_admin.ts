// Troca o email do administrador inicial no banco atual
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const u = await db.usuario.update({
  where: { email: "admin@waycode.com" },
  data: { email: "wagnerlima378@gmail.com" },
  select: { nome: true, email: true, perfil: true, ativo: true },
});
console.log("Admin atualizado:", u);
await db.$disconnect();
