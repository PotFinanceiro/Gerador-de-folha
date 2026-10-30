import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";

export default async function LayoutSistema({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await lerSessao();
  if (!sessao) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar perfil={sessao.perfil} nome={sessao.nome} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
