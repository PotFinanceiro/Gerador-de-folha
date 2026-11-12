import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { criarClienteServidor } from "@/lib/supabase/server";
import { gerarFolhasPontoTS } from "@/lib/gerador/folhas";
import { salvarArquivosJob } from "@/lib/gerador/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // 1. Validação de Sessão via Supabase
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ erro: "Faça login para continuar." }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("arquivo") as File | null;
    const mes = Number(form.get("mes"));
    const ano = Number(form.get("ano"));
    const folgas = String(form.get("folgas") || "1,2");
    const extra = String(form.get("extra") || "");

    if (!file || !mes || !ano) {
      return NextResponse.json(
        { ok: false, erro: "Envie a planilha e informe mês e ano." },
        { status: 400 }
      );
    }
    const nome = file.name.toLowerCase();
    if (!/\.(xlsm|xlsx|xls)$/.test(nome)) {
      return NextResponse.json(
        { ok: false, erro: "Formato inválido. Envie um arquivo .xlsm ou .xlsx." },
        { status: 400 }
      );
    }

    const jobId = crypto.randomUUID();
    const arquivoBuffer = Buffer.from(await file.arrayBuffer());

    // 2. Processamento 100% Nativo em TypeScript (Serverless / Vercel)
    const { zipBuffer, previewBuffer, previewNome, resumo } = await gerarFolhasPontoTS({
      arquivoBuffer,
      mes,
      ano,
      folgasStr: folgas,
      extraStr: extra,
    });

    // 3. Salva ZIP e Prévia no Supabase Storage (bucket documentos-gerados)
    await salvarArquivosJob(jobId, [
      { nome: "folhas_ponto.zip", buffer: zipBuffer, contentType: "application/zip" },
      { nome: previewNome, buffer: previewBuffer, contentType: "image/svg+xml" },
    ]);

    // 4. Registra o job na tabela public.jobs do Supabase
    try {
      await supabase.from("jobs").insert({
        id: jobId,
        usuario_id: user.id,
        tipo: "FOLHA_PONTO",
        status: "CONCLUIDO",
        mes,
        ano,
        folgas,
        extra,
        arquivo_entrada_path: nome,
        arquivo_zip_path: `${jobId}/folhas_ponto.zip`,
        arquivo_preview_path: `${jobId}/${previewNome}`,
        total_beneficiarios: resumo.total || 0,
        resumo,
        finalizado_em: new Date().toISOString(),
      });
    } catch {}

    return NextResponse.json({ ...resumo, jobId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro inesperado ao gerar as folhas.";
    return NextResponse.json({ ok: false, erro: msg }, { status: 500 });
  }
}
