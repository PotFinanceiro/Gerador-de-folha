"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSpreadsheet, Landmark, ChevronLeft, ChevronRight, X, ShieldCheck, LogOut } from "lucide-react";

/**
 * Barra lateral retrátil.
 *
 * — Desktop (md+): fixa à esquerda; recolhe para uma trilha só de ícones.
 *   O estado (aberta/recolhida) fica salvo no navegador.
 * — Celular: fica oculta; abre como gaveta sobre a tela pelo botão flutuante.
 */
const ITENS = [
  {
    href: "/folhas-de-ponto",
    rotulo: "Folhas de Ponto",
    descricao: "Gerador de folhas",
    icone: FileSpreadsheet,
  },
  {
    href: "/emitir-carta",
    rotulo: "Emitir Carta",
    descricao: "Carta de banco",
    icone: Landmark,
  },
];

const CHAVE = "folha-sidebar-aberta";

export function Sidebar({
  perfil,
  nome,
}: {
  perfil?: "ADMIN" | "USUARIO";
  nome?: string;
}) {
  const pathname = usePathname();
  const [aberta, setAberta] = useState(true); // desktop: expandida por padrão
  const [pronto, setPronto] = useState(false);
  const [gaveta, setGaveta] = useState(false); // mobile

  // restaura preferência salva (após montar, para não divergir do servidor)
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE);
      if (salvo !== null) setAberta(salvo === "1");
    } catch {}
    setPronto(true);
  }, []);

  const alternar = () => {
    setAberta((v) => {
      try {
        localStorage.setItem(CHAVE, v ? "0" : "1");
      } catch {}
      return !v;
    });
  };

  // fecha a gaveta ao navegar
  useEffect(() => {
    setGaveta(false);
  }, [pathname]);

  const ativo = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const largura = aberta ? "md:w-60" : "md:w-[68px]";

  // item de usuários aparece só para administradores
  const itens =
    perfil === "ADMIN"
      ? [...ITENS, { href: "/usuarios", rotulo: "Usuários", descricao: "Cadastrar acessos", icone: ShieldCheck }]
      : ITENS;

  const sair = async () => {
    await fetch("/api/logout", { method: "POST" });
    location.href = "/login";
  };

  // comRotulos: false → trilha só de ícones (desktop recolhido); a gaveta do celular sempre tem rótulos
  const itensNav = (comRotulos: boolean) =>
    itens.map(({ href, rotulo, descricao, icone: Icone }) => {
      const ligado = ativo(href);
      return (
        <Link
          key={href}
          href={href}
          title={comRotulos ? undefined : `${rotulo} — ${descricao}`}
          aria-current={ligado ? "page" : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
            ligado
              ? "bg-zinc-900 text-white font-medium"
              : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
          } ${comRotulos ? "" : "md:justify-center md:px-2"}`}
        >
          <Icone className="h-5 w-5 shrink-0" aria-hidden />
          {comRotulos && (
            <span className="min-w-0">
              <span className="block leading-tight">{rotulo}</span>
              <span
                className={`block text-xs leading-tight ${
                  ligado ? "text-zinc-300" : "text-muted-foreground"
                }`}
              >
                {descricao}
              </span>
            </span>
          )}
        </Link>
      );
    });

  const marca = (comRotulos: boolean) => (
    <div className={`flex items-center gap-2 ${comRotulos ? "" : "md:justify-center"}`}>
      <img
        src="/waycode-logo.png"
        alt="WayCode"
        className="h-9 w-9 rounded-lg object-contain ring-1 ring-zinc-200 shrink-0"
      />
      {comRotulos && (
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-semibold truncate">WayCode</p>
          <p className="text-[10px] text-muted-foreground truncate">Soluções Tecnológicas</p>
        </div>
      )}
    </div>
  );

  const blocoUsuario = (comRotulos: boolean) => (
    <div className={`border-t pt-3 space-y-1 ${comRotulos ? "" : "md:flex md:justify-center md:px-2"}`}>
      {comRotulos && nome && (
        <p className="px-3 pb-1 text-xs text-muted-foreground truncate" title={nome}>
          {nome}
        </p>
      )}
      <button
        type="button"
        onClick={sair}
        title="Sair da conta"
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 w-full ${
          comRotulos ? "" : "md:justify-center md:px-2"
        }`}
      >
        <LogOut className="h-5 w-5 shrink-0" aria-hidden />
        {comRotulos && <span>Sair</span>}
      </button>
    </div>
  );

  const alternarBtn = (
    <button
      type="button"
      onClick={alternar}
      aria-label={aberta ? "Recolher menu lateral" : "Expandir menu lateral"}
      className={`hidden md:flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 w-full ${
        aberta ? "" : "md:justify-center md:px-2"
      }`}
    >
      {aberta ? (
        <>
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          <span>Recolher</span>
        </>
      ) : (
        <ChevronRight className="h-4 w-4" aria-hidden />
      )}
    </button>
  );

  return (
    <>
      {/* ===== Desktop ===== */}
      <aside
        className={`hidden md:flex sticky top-0 h-screen shrink-0 flex-col gap-4 border-r bg-white px-3 py-4 transition-[width] duration-200 ${
          pronto ? largura : "md:w-[68px]"
        }`}
        aria-label="Menu principal"
      >
        {marca(aberta)}
        <nav className="flex-1 space-y-1">{itensNav(aberta)}</nav>
        {alternarBtn}
        {blocoUsuario(aberta)}
      </aside>

      {/* ===== Celular: botão flutuante ===== */}
      {!gaveta && (
        <button
          type="button"
          onClick={() => setGaveta(true)}
          aria-label="Abrir menu"
          className="md:hidden fixed top-3 right-3 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg"
        >
          <span className="sr-only">Abrir menu</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      )}

      {/* ===== Celular: gaveta ===== */}
      {gaveta && (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setGaveta(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl flex flex-col gap-4 px-3 py-4">
            <div className="flex items-center justify-between pr-1">
              {marca(true)}
              <button
                type="button"
                onClick={() => setGaveta(false)}
                aria-label="Fechar menu"
                className="p-1.5 rounded-lg hover:bg-zinc-100"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <nav className="flex-1 space-y-1">{itensNav(true)}</nav>
            {blocoUsuario(true)}
            <p className="text-[10px] text-muted-foreground text-center">
              Programa Operação Trabalho — Rede Cidadã
            </p>
          </div>
        </div>
      )}
    </>
  );
}
