/**
 * Cabeçalho e rodapé padrão das ferramentas — identidade visual do sistema.
 */
export function CabecalhoSistema({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <header className="border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 py-5 flex items-center gap-3">
        <img
          src="/waycode-logo.png"
          alt="WayCode — Soluções Tecnológicas"
          className="h-11 w-11 rounded-lg object-contain ring-1 ring-zinc-200 shrink-0"
        />
        <div>
          <h1 className="text-lg sm:text-xl font-semibold leading-tight">{titulo}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{subtitulo}</p>
        </div>
      </div>
    </header>
  );
}

export function RodapeSistema() {
  return (
    <footer className="mt-auto border-t bg-white">
      <div className="max-w-6xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
        Automações do Programa Operação Trabalho — Rede Cidadã · By WayCode
      </div>
    </footer>
  );
}
