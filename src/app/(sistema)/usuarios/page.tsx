import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import { PainelUsuarios } from "./PainelUsuarios";

export const metadata = { title: "Usuários — Rede Cidadã · By WayCode" };

export default async function PaginaUsuarios() {
  const sessao = await lerSessao();
  if (!sessao || sessao.perfil !== "ADMIN") redirect("/folhas-de-ponto");
  return <PainelUsuarios euId={sessao.id} />;
}
