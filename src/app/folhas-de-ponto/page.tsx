"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CabecalhoSistema, RodapeSistema } from "@/components/marca";
import {
  AlertTriangle,
  CheckCircle2,
  Coffee,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const DIAS_SEMANA = [
  { idx: 0, nome: "Domingo", abrev: "Dom" },
  { idx: 1, nome: "Segunda", abrev: "Seg" },
  { idx: 2, nome: "Terça", abrev: "Ter" },
  { idx: 3, nome: "Quarta", abrev: "Qua" },
  { idx: 4, nome: "Quinta", abrev: "Qui" },
  { idx: 5, nome: "Sexta", abrev: "Sex" },
  { idx: 6, nome: "Sábado", abrev: "Sab" },
];

const ETAPAS = [
  "Lendo a planilha de beneficiários...",
  "Preenchendo os campos de cada folha...",
  "Lançando folgas e dias de curso na agenda...",
  "Convertendo as folhas para PDF...",
  "Compactando os arquivos...",
];

type Resumo = {
  ok: boolean;
  jobId: string;
  mes: number;
  ano: number;
  mes_vigente: string;
  total: number;
  zip: string;
  preview: string;
  primeiro: string;
};

export default function GeradorFolhas() {
  const agora = useMemo(() => new Date(), []);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [dragAtivo, setDragAtivo] = useState(false);
  const [mes, setMes] = useState<string>(String(agora.getMonth() + 1));
  const [ano, setAno] = useState<string>(String(agora.getFullYear()));
  const [folgas, setFolgas] = useState<Set<number>>(new Set([1, 2]));
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [novaData, setNovaData] = useState("");
  const [processando, setProcessando] = useState(false);
  const [etapa, setEtapa] = useState(0);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const resultadoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!processando) return;
    const t = setInterval(() => setEtapa((e) => (e + 1) % ETAPAS.length), 5000);
    return () => clearInterval(t);
  }, [processando]);

  const escolherArquivo = (f: File | null) => {
    if (!f) return;
    if (!/\.(xlsm|xlsx|xls)$/i.test(f.name)) {
      setErro("Formato inválido. Envie a planilha-base (mala) em .xlsm ou .xlsx.");
      return;
    }
    setErro(null);
    setResumo(null);
    setArquivo(f);
  };

  const alternarFolga = (idx: number) => {
    setFolgas((prev) => {
      const novo = new Set(prev);
      if (novo.has(idx)) novo.delete(idx);
      else novo.add(idx);
      return novo;
    });
  };

  const adicionarData = () => {
    if (!novaData) return;
    if (extraDates.includes(novaData)) {
      setNovaData("");
      return;
    }
    setExtraDates((prev) => [...prev, novaData].sort());
    setNovaData("");
  };

  const gerar = useCallback(async () => {
    if (!arquivo) return;
    setProcessando(true);
    setEtapa(0);
    setErro(null);
    setResumo(null);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      fd.append("mes", mes);
      fd.append("ano", ano);
      fd.append("folgas", Array.from(folgas).sort().join(","));
      fd.append("extra", extraDates.join(","));
      const resp = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data.erro || "Falha ao gerar as folhas.");
      }
      setResumo(data);
      setTimeout(() => resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro inesperado ao gerar as folhas.");
    } finally {
      setProcessando(false);
    }
  }, [arquivo, mes, ano, folgas, extraDates]);

  const podeGerar = !!arquivo && !processando && !!mes && !!ano;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <CabecalhoSistema
        titulo="Gerador de Folhas de Ponto · Rede Cidadã"
        subtitulo="Programa Operação Trabalho — Rede Cidadã · By WayCode"
      />

      {/* Conteúdo */}
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
                  Envie a planilha-base (mala) com os beneficiários. Cada linha gera uma folha individual.
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

            {/* 2. Configuração */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="h-6 w-6 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">2</span>
                  Configuração da folha
                </CardTitle>
                <CardDescription>
                  Mês vigente, dias de folga da equipe e datas avulsas (feriados).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Mês / Ano */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="mes">Mês vigente</Label>
                    <Select value={mes} onValueChange={setMes} disabled={processando}>
                      <SelectTrigger id="mes" aria-label="Mês vigente">
                        <SelectValue placeholder="Mês" />
                      </SelectTrigger>
                      <SelectContent>
                        {MESES.map((m, i) => (
                          <SelectItem key={m} value={String(i + 1)}>
                            {m.charAt(0).toUpperCase() + m.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ano">Ano</Label>
                    <Input
                      id="ano"
                      type="number"
                      min={2020}
                      max={2040}
                      value={ano}
                      disabled={processando}
                      onChange={(e) => setAno(e.target.value)}
                    />
                  </div>
                </div>

                {/* Folgas por dia da semana */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Coffee className="h-4 w-4 text-emerald-700" aria-hidden />
                    Dias da semana com folga
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {DIAS_SEMANA.map((d) => (
                      <label
                        key={d.idx}
                        className={`flex items-center gap-2 rounded-lg border p-2.5 text-sm cursor-pointer transition-colors ${
                          folgas.has(d.idx) ? "border-emerald-600 bg-emerald-50 font-medium" : "bg-white hover:bg-zinc-50"
                        }`}
                      >
                        <Checkbox
                          checked={folgas.has(d.idx)}
                          onCheckedChange={() => !processando && alternarFolga(d.idx)}
                          disabled={processando}
                          aria-label={`Folga na ${d.nome}`}
                        />
                        {d.nome}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Os dias marcados ficam cinza com &quot;Folga&quot;, como na macro AtualizarAgenda.
                  </p>
                </div>

                {/* Datas avulsas */}
                <div className="space-y-2">
                  <Label>Datas avulsas de folga (feriados e pontuais)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={novaData}
                      disabled={processando}
                      onChange={(e) => setNovaData(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && adicionarData()}
                      aria-label="Data avulsa de folga"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={adicionarData}
                      disabled={processando || !novaData}
                    >
                      <Plus className="h-4 w-4 mr-1" aria-hidden /> Adicionar
                    </Button>
                  </div>
                  {extraDates.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {extraDates.map((d) => {
                        const dt = new Date(d + "T12:00:00");
                        const fora = dt.getMonth() + 1 !== Number(mes) || dt.getFullYear() !== Number(ano);
                        return (
                          <Badge
                            key={d}
                            variant={fora ? "outline" : "secondary"}
                            className="gap-1 py-1 pl-2.5 pr-1"
                          >
                            {dt.toLocaleDateString("pt-BR")}
                            {fora && <span className="text-[10px] text-amber-700">(fora do mês)</span>}
                            {!processando && (
                              <button
                                type="button"
                                aria-label={`Remover ${d}`}
                                className="rounded-full hover:bg-zinc-200 p-0.5"
                                onClick={() => setExtraDates((prev) => prev.filter((x) => x !== d))}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </Badge>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Opcional — ex.: feriados do mês. Datas dentro do mês vigente entram como folga.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 3. Gerar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="h-6 w-6 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">3</span>
                  Gerar as folhas
                </CardTitle>
                <CardDescription>
                  Os dias de curso são lançados automaticamente pela coluna &quot;Curso dia&quot; da planilha.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full h-12 text-base font-semibold"
                  onClick={gerar}
                  disabled={!podeGerar}
                >
                  {processando ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" aria-hidden />
                      Gerando folhas...
                    </>
                  ) : (
                    <>
                      <FileText className="h-5 w-5 mr-2" aria-hidden />
                      Gerar folhas de ponto
                    </>
                  )}
                </Button>
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
                      Uma página por beneficiário — esse processo pode levar até 1 minuto.
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
                    {resumo.total} folha{resumo.total > 1 ? "s" : ""} gerada{resumo.total > 1 ? "s" : ""} para{" "}
                    <span className="font-medium">{resumo.mes_vigente}.</span>
                  </AlertDescription>
                </Alert>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Conferência da 1ª folha</CardTitle>
                    <CardDescription>
                      Prévia do primeiro beneficiário da planilha:{" "}
                      <span className="font-medium text-foreground">{resumo.primeiro}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border bg-white p-2 shadow-sm">
                      <img
                        src={`/api/arquivo/${resumo.jobId}/${resumo.preview}`}
                        alt={`Prévia da folha de ponto de ${resumo.primeiro}`}
                        className="w-full h-auto rounded"
                      />
                    </div>
                    <Separator />
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button asChild className="flex-1 h-12 text-base font-semibold">
                        <a href={`/api/arquivo/${resumo.jobId}/${resumo.zip}`} download>
                          <Download className="h-5 w-5 mr-2" aria-hidden />
                          Baixar todas as folhas (.zip)
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
                      <span className="font-mono">NºCartão_Nome.pdf</span>.
                    </p>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-base">Resultado</CardTitle>
                  <CardDescription>
                    Após gerar, o aviso aparecerá aqui e você poderá conferir a primeira folha antes de
                    baixar o ZIP com todas as folhas.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-zinc-100/60 border p-8 text-center">
                    <FileText className="h-10 w-10 text-zinc-300" aria-hidden />
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Nenhuma folha gerada ainda. Envie a planilha, ajuste o mês e os dias de folga e
                      clique em <span className="font-medium text-foreground">Gerar folhas de ponto</span>.
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
