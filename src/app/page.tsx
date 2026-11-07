import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Redirecionando…",
};

export default function Home() {
  // A home leva direto para a ferramenta principal; a navegação fica na sidebar.
  redirect("/folhas-de-ponto");
}
