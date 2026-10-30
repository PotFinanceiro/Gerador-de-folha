import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { GERADOS_ROOT } from "@/lib/ambiente";

export const runtime = "nodejs";

const GERADOS = GERADOS_ROOT;

const TIPOS: Record<string, { ct: string; disp: string }> = {
  zip: { ct: "application/zip", disp: "attachment" },
  png: { ct: "image/png", disp: "inline" },
  pdf: { ct: "application/pdf", disp: "inline" },
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ job: string; name: string }> }
) {
  const { job, name } = await ctx.params;
  if (!/^[a-f0-9-]{10,64}$/i.test(job) || /[\\/]/.test(name)) {
    return new NextResponse("Requisição inválida", { status: 400 });
  }
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const tipo = TIPOS[ext];
  if (!tipo) {
    return new NextResponse("Tipo não permitido", { status: 400 });
  }
  const arquivo = path.join(GERADOS, job, name);
  try {
    const data = await fs.readFile(arquivo);
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
