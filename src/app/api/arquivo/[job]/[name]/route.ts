import { NextRequest, NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";
import { lerArquivoJob } from "@/lib/gerador/storage";

export const runtime = "nodejs";

const TIPOS: Record<string, { ct: string; disp: string }> = {
  zip: { ct: "application/zip", disp: "attachment" },
  png: { ct: "image/png", disp: "inline" },
  svg: { ct: "image/svg+xml", disp: "inline" },
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

  // 2. Busca o arquivo no Supabase Storage (ou fallback em disco local)
  const buffer = await lerArquivoJob(job, name);
  if (!buffer) {
    return new NextResponse("Arquivo não encontrado", { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": tipo.ct,
      "Content-Disposition": `${tipo.disp}; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
