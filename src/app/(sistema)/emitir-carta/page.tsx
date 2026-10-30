"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Assinatura, AssinaturaHandle } from "@/components/Assinatura";
import { CabecalhoSistema, RodapeSistema } from "@/components/marca";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  PenLine,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";

const ETAPAS = [
  "Lendo a planilha de beneficiários...",
  "Confirmando agências e endereços...",
  "Preenchendo os campos de cada carta...",
  "Aplicando a assinatura digital...",
  "Convertendo para PDF e compactando...",
];

type Resumo = {
  ok: boolean;
  jobId: string;
  data: string;
  total: number;
  pulados: { nome: string; motivo: string }[];
  assinatura: string;
  zip: string;
  preview: string;
  primeiro: string;
};

export default function EmitirCarta() {
  const hoje = useMemo(() => new Date(), []);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [dragAtivo, setDragAtivo] = useState(false);
  const [data, setData] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`
  );
  const [assPreenchida, setAssPreenchida] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [etapa, setEtapa] = useState(0);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const assRef = useRef<AssinaturaHandle>(null);
  const resultadoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!processando) return;
    const t = setInterval(() => setEtapa((e) => (e + 1) % ETAPAS.length), 4000);
    return () => clearInterval(t);
  }, [processando]);

  const escolherArquivo = (f: File | null) => {
    if (!f) return;
    if (!/\.(xlsm|xlsx|xls)$/i.test(f.name)) {
      setErro("Formato inválido. Envie a planilha-base em .xlsm ou .xlsx.");
      return;
    }
    setErro(null);
    setResumo(null);
    setArquivo(f);
  };

  const gerar = useCallback(async () => {
    if (!arquivo) return;
    setProcessando(true);
    setEtapa(0);
    setErro(null);
    setResumo(null);
    try {
      const png = await assRef.current?.exportar();
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      fd.append("data", data);
      if (png) fd.append("assinatura", png, "assinatura.png");
      const resp = await fetch("/api/carta/gerar", { method: "POST", body: fd });
      const dados = await resp.json();
      if (!resp.ok || !dados.ok) {
        throw new Error(dados.erro || "Falha ao gerar as cartas.");
      }
      setResumo(dados);
      setTimeout(() => resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro inesperado ao gerar as cartas.");
    } finally {
      setProcessando(false);
    }
  }, [arquivo, data]);

  const podeGerar = !!arquivo && !processando && /^\d{4}-\d{2}-\d{2}$/.test(data);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <CabecalhoSistema
        titulo="Emitir Carta de Banco · Rede Cidadã"
        subtitulo="Programa Operação Trabalho — Rede Cidadã · By WayCode"
      />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-2 items-start">
          {/* Coluna esquerda: configuração */}
          <div className="space-y-6">
            {/* 1. Planilha */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="h-6 w-6 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">1</span>
                  Planilha de beneficiários
                </CardTitle>
                <CardDescription>
                  Base com Nome, Número do Benefício e Agência. O nome e o endereço da agência são
                  conferidos automaticamente pela aba &quot;Lista de Agências&quot;.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  ref={inputArquivo}
                  type="file"
                  accept=".xlsm,.xlsx,.xls"
                  className="hidden"
                  aria-label="Selecionar planilha"
                  onChange={(e) => escolherArquivo(e.target.files?.[0] ?? null)}
                />
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Área para enviar a planilha"
                  onClick={() => !processando && inputArquivo.current?.click()}
                  onKeyDown={(e) => e.key === "Enter" && !processando && inputArquivo.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragAtivo(true); }}
                  onDragLeave={() => setDragAtivo(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragAtivo(false);
                    if (!processando) escolherArquivo(e.dataTransfer.files?.[0] ?? null);
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                    dragAtivo ? "border-emerald-600 bg-emerald-50" : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50"
                  } ${processando ? "opacity-60 pointer-events-none" : ""}`}
                >
                  <Upload className="h-8 w-8 text-zinc-400" aria-hidden />
                  <p className="text-sm font-medium">
                    Clique para selecionar ou arraste a planilha aqui
                  </p>
                  <p className="text-xs text-muted-foreground">Formatos aceitos: .xlsm, .xlsx</p>
                </div>
                {arquivo && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border bg-white p-3">
                    <FileSpreadsheet className="h-5 w-5 text-emerald-700 shrink-0" aria-hidden />
                    <span className="text-sm font-medium truncate flex-1">{arquivo.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(arquivo.size / 1024).toFixed(0)} KB
                    </span>
                    {!processando && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Remover planilha"
                        onClick={() => { setArquivo(null); setResumo(null); }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 2. Data e assinatura */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="h-6 w-6 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">2</span>
                  Data da carta e assinatura
                </CardTitle>
                <CardDescription>
                  A assinatura desenhada aqui entra no campo &quot;(assinatura próprio punho)&quot; do
                  modelo — com o mesmo tamanho e posição.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="data-carta" className="flex items-center gap-1.5">
                    <PenLine className="h-4 w-4 text-emerald-700" aria-hidden />
                    Data da carta
                  </Label>
                  <Input
                    id="data-carta"
                    type="date"
                    value={data}
                    disabled={processando}
                    onChange={(e) => setData(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Aparece na linha &quot;São Paulo, …&quot; de todas as cartas.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Assinatura digital (obrigatória)</Label>
                  <Assinatura ref={assRef} onMudanca={setAssPreenchida} />
                </div>
              </CardContent>
            </Card>

            {/* 3. Gerar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="h-6 w-6 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">3</span>
                  Gerar as cartas
                </CardTitle>
                <CardDescription>
                  Uma carta por beneficiário, no modelo oficial — sem nenhuma alteração de layout.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full h-12 text-base font-semibold"
                  onClick={gerar}
                  disabled={!podeGerar || !assPreenchida}
                >
                  {processando ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" aria-hidden />
                      Gerando cartas...
                    </>
                  ) : (
                    <>
                      <FileText className="h-5 w-5 mr-2" aria-hidden />
                      Emitir cartas de banco
                    </>
                  )}
                </Button>
                {!assPreenchida && (
                  <p className="text-xs text-muted-foreground">
                    Desenhe a assinatura no campo acima para liberar a emissão.
                  </p>
                )}
                {processando && (
                  <div className="rounded-lg border bg-white p-3 space-y-2" aria-live="polite">
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-700" aria-hidden />
                      <span>{ETAPAS[etapa]}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full w-1/3 rounded-full bg-emerald-600 animate-pulse" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Uma carta por beneficiário — esse processo pode levar até 1 minuto.
                    </p>
                  </div>
                )}
                {erro && (
                  <Alert variant="destructive" role="alert">
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                    <AlertTitle>Não foi possível gerar</AlertTitle>
                    <AlertDescription>{erro}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Coluna direita: resultado */}
          <div ref={resultadoRef} className="space-y-4 lg:sticky lg:top-6">
            {resumo ? (
              <>
                <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900" role="status">
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden />
                  <AlertTitle className="text-emerald-900 font-semibold">
                    Tudo pronto! Você já pode baixar os PDFs.
                  </AlertTitle>
                  <AlertDescription className="text-emerald-800">
                    {resumo.total} carta{resumo.total > 1 ? "s" : ""} gerada{resumo.total > 1 ? "s" : ""} com data de{" "}
                    <span className="font-medium">{resumo.data}</span> e assinatura{" "}
                    {resumo.assinatura === "digital" ? "digital" : "do modelo"}.
                  </AlertDescription>
                </Alert>

                {resumo.pulados.length > 0 && (
                  <Alert className="border-amber-300 bg-amber-50 text-amber-900" role="status">
                    <AlertTriangle className="h-5 w-5 text-amber-700" aria-hidden />
                    <AlertTitle className="text-amber-900 font-semibold">
                      {resumo.pulados.length} beneficiário{resumo.pulados.length > 1 ? "s" : ""} não entrou{resumo.pulados.length > 1 ? "ram" : ""}
                    </AlertTitle>
                    <AlertDescription className="text-amber-800">
                      <ul className="list-disc pl-4 space-y-0.5">
                        {resumo.pulados.map((p) => (
                          <li key={p.nome}>
                            <span className="font-medium">{p.nome}</span> — {p.motivo}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Conferência da 1ª carta</CardTitle>
                    <CardDescription>
                      Prévia do primeiro beneficiário da planilha:{" "}
                      <span className="font-medium text-foreground">{resumo.primeiro}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border bg-white p-2 shadow-sm">
                      <img
                        src={`/api/arquivo/${resumo.jobId}/${resumo.preview}`}
                        alt={`Prévia da carta de ${resumo.primeiro}`}
                        className="w-full h-auto rounded"
                      />
                    </div>
                    <Separator />
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button asChild className="flex-1 h-12 text-base font-semibold">
                        <a href={`/api/arquivo/${resumo.jobId}/${resumo.zip}`} download>
                          <Download className="h-5 w-5 mr-2" aria-hidden />
                          Baixar todas as cartas (.zip)
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-12"
                        onClick={gerar}
                        disabled={processando}
                        title="Gerar novamente com as configurações atuais"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" aria-hidden />
                        Gerar novamente
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O ZIP contém um PDF por beneficiário, nomeado{" "}
                      <span className="font-mono">Carta_NºBenefício_Nome.pdf</span>.
                    </p>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-base">Resultado</CardTitle>
                  <CardDescription>
                    Após emitir, a prévia da primeira carta aparece aqui para conferência antes de
                    baixar o ZIP com todas as cartas.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-zinc-100/60 border p-8 text-center">
                    <FileText className="h-10 w-10 text-zinc-300" aria-hidden />
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Nenhuma carta emitida ainda. Envie a planilha, confira a data, assine no campo
                      digital e clique em <span className="font-medium text-foreground">Emitir cartas de banco</span>.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <RodapeSistema />
    </div>
  );
}
