import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { GERADOS_ROOT } from "@/lib/ambiente";
import { criarClienteServidor } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TIPOS: Record<string, { ct: string; disp: string }> = {
  zip: { ct: "application/zip", disp: "attachment" },
  png: { ct: "image/png", disp: "inline" },
  pdf: { ct: "application/pdf", disp: "inline" },
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ job: string; name: string }> }
) {
  // 1. Validação de Sessão via Supabase
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ erro: "Faça login para continuar." }, { status: 401 });
  }

  const { job, name } = await ctx.params;
  if (!/^[a-f0-9-]{10,64}$/i.test(job) || /[\\/]/.test(name)) {
    return new NextResponse("Requisição inválida", { status: 400 });
  }

  const ext = name.split(".").pop()?.toLowerCase() || "";
  const tipo = TIPOS[ext];
  if (!tipo) {
    return new NextResponse("Tipo de arquivo não permitido", { status: 400 });
  }

  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");

  // =========================================================================
  // MODO 1: PROXIA DO WORKER REMOTO (Quando rodando na Vercel / Desacoplado)
  // =========================================================================
  if (workerUrl) {
    try {
      const respWorker = await fetch(`${workerUrl}/jobs/${job}/download/${name}`);
      if (respWorker.ok) {
        const arrayBuffer = await respWorker.arrayBuffer();
        return new NextResponse(new Uint8Array(arrayBuffer), {
          headers: {
            "Content-Type": tipo.ct,
            "Content-Disposition": `${tipo.disp}; filename*=UTF-8''${encodeURIComponent(name)}`,
            "Cache-Control": "private, max-age=3600",
          },
        });
      }
    } catch {
      // Se falhar no worker, tenta verificar se o arquivo existe localmente
    }
  }

  // =========================================================================
  // MODO 2: ARQUIVO NO DISCO LOCAL (Fallback)
  // =========================================================================
  const arquivoLocal = path.join(GERADOS_ROOT, job, name);
  try {
    const data = await fs.readFile(arquivoLocal);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": tipo.ct,
        "Content-Disposition": `${tipo.disp}; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Arquivo não encontrado", { status: 404 });
  }
}
