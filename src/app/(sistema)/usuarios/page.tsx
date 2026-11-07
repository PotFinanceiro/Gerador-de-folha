import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { PainelUsuarios } from "./PainelUsuarios";

export const metadata = { title: "Usuários — Rede Cidadã · By WayCode" };

export default async function PaginaUsuarios() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verifica se o usuário autenticado é realmente ADMIN
  const { data: perfil } = await supabase
    .from("perfis")
    .select("perfil")
    .eq("id", user.id)
    .single();

  if (perfil?.perfil !== "ADMIN") {
    redirect("/folhas-de-ponto");
  }

  return <PainelUsuarios euId={user.id} />;
}
