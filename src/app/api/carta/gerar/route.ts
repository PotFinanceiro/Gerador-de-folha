import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { criarClienteServidor } from "@/lib/supabase/server";
import { gerarCartasBancoTS } from "@/lib/gerador/cartas";
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
    const data = String(form.get("data") || "");
    const assinatura = form.get("assinatura") as File | null;

    if (!file || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return NextResponse.json(
        { ok: false, erro: "Envie a planilha e informe a data da carta." },
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
    if (assinatura && assinatura.type && !assinatura.type.startsWith("image/png")) {
      return NextResponse.json(
        { ok: false, erro: "A assinatura precisa ser uma imagem PNG." },
        { status: 400 }
      );
    }

    const jobId = crypto.randomUUID();
    const arquivoBuffer = Buffer.from(await file.arrayBuffer());
    const assinaturaBuffer =
      assinatura && assinatura.size > 0 ? Buffer.from(await assinatura.arrayBuffer()) : null;

    // 2. Processamento 100% Nativo em TypeScript (Serverless / Vercel)
    const { zipBuffer, previewBuffer, previewNome, resumo } = await gerarCartasBancoTS({
      arquivoBuffer,
      dataIso: data,
      assinaturaBuffer,
    });

    // 3. Salva ZIP e Prévia no Supabase Storage (bucket documentos-gerados)
    await salvarArquivosJob(jobId, [
      { nome: "cartas_banco.zip", buffer: zipBuffer, contentType: "application/zip" },
      { nome: previewNome, buffer: previewBuffer, contentType: "image/svg+xml" },
    ]);

    // 4. Registra o job na tabela public.jobs do Supabase
    try {
      await supabase.from("jobs").insert({
        id: jobId,
        usuario_id: user.id,
        tipo: "CARTA_BANCO",
        status: "CONCLUIDO",
        data_carta: data,
        arquivo_entrada_path: nome,
        arquivo_zip_path: `${jobId}/cartas_banco.zip`,
        arquivo_preview_path: `${jobId}/${previewNome}`,
        total_beneficiarios: resumo.total || 0,
        resumo,
        finalizado_em: new Date().toISOString(),
      });
    } catch {}

    return NextResponse.json({ ...resumo, jobId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro inesperado ao gerar as cartas.";
    return NextResponse.json({ ok: false, erro: msg }, { status: 500 });
  }
}
