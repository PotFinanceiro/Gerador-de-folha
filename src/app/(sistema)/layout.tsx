import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";

export default async function LayoutSistema({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Busca o perfil e permissões do usuário
  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome, perfil, ativo")
    .eq("id", user.id)
    .single();

  // Se o usuário foi desativado, encerra a sessão
  if (perfil && !perfil.ativo) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  const nomeExibicao =
    perfil?.nome ||
    user.user_metadata?.nome ||
    user.email?.split("@")[0] ||
    "Usuário";

  const papel = (perfil?.perfil || user.user_metadata?.perfil || "USUARIO") as
    | "ADMIN"
    | "USUARIO";

  return (
    <div className="flex min-h-screen">
      <Sidebar perfil={papel} nome={nomeExibicao} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
