import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import {
  PROJECT_ROOT,
  DATA_ROOT,
  GERADOS_ROOT,
  CARTA_SCRIPT,
  CARTA_TEMPLATE,
  resolverPython,
  verificarAmbiente,
} from "@/lib/ambiente";

export const runtime = "nodejs";
export const maxDuration = 800;

export async function POST(req: NextRequest) {
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

    // Pré-voo: Python + dependências + LibreOffice + template da carta
    const ambiente = verificarAmbiente();
    if (!ambiente.ok) {
      return NextResponse.json({ ok: false, erro: ambiente.erro }, { status: 500 });
    }
    if (!(await fs.stat(CARTA_TEMPLATE).catch(() => null))) {
      return NextResponse.json(
        { ok: false, erro: `Template da carta não encontrado em ${CARTA_TEMPLATE}.` },
        { status: 500 }
      );
    }
    const python = resolverPython();
    if (!python.bin) {
      return NextResponse.json({ ok: false, erro: python.erro }, { status: 500 });
    }

    const jobId = crypto.randomUUID();
    const outDir = path.join(GERADOS_ROOT, jobId);
    await fs.mkdir(outDir, { recursive: true });
    const upPath = path.join(outDir, `entrada${path.extname(nome)}`);
    await fs.writeFile(upPath, Buffer.from(await file.arrayBuffer()));
    if (assinatura) {
      await fs.writeFile(path.join(outDir, "assinatura.png"), Buffer.from(await assinatura.arrayBuffer()));
    }

    const args = [
      CARTA_SCRIPT,
      "--entrada", upPath,
      "--saida", outDir,
      "--data", data,
      ...(assinatura ? ["--assinatura", path.join(outDir, "assinatura.png")] : []),
    ];

    // HOME gravável é necessário para o perfil do LibreOffice
    const home = process.env.HOME || path.join(DATA_ROOT, ".home");
    await fs.mkdir(home, { recursive: true }).catch(() => {});

    const proc = spawn(python.bin, args, {
      cwd: PROJECT_ROOT,
      env: { ...process.env, HOME: home, SOFFICE_BIN: process.env.SOFFICE_BIN || "soffice" },
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    const code = await new Promise<number>((resolve) => {
      proc.on("close", resolve);
      proc.on("error", (e) => {
        stderr += `\nFalha ao iniciar o processo Python: ${e.message}`;
        resolve(-1);
      });
    });

    try {
      await fs.writeFile(
        path.join(outDir, "log.txt"),
        `EXIT=${code}\n--- STDOUT ---\n${stdout}\n--- STDERR ---\n${stderr}`
      );
    } catch {}

    if (code !== 0) {
      const saida = `${stderr}\n${stdout}`;
      let msg: string;
      if (/ModuleNotFoundError: No module named '(\w+)'/.test(saida)) {
        const mod = saida.match(/ModuleNotFoundError: No module named '(\w+)'/)![1];
        msg = `Módulo Python "${mod}" ausente no servidor. Execute: pip install -r python/requirements.txt`;
      } else {
        const linhas = saida.trim().split("\n").filter(Boolean);
        msg =
          linhas.filter((l) => /(Error|error|ValueError|RuntimeError|Traceback|não encontrei|Nenhum|inválid)/.test(l)).pop() ||
          linhas[linhas.length - 1] ||
          "Falha ao processar a planilha.";
      }
      return NextResponse.json(
        { ok: false, erro: `Não foi possível gerar as cartas: ${msg}` },
        { status: 500 }
      );
    }

    const resumo = JSON.parse(await fs.readFile(path.join(outDir, "resumo.json"), "utf-8"));
    return NextResponse.json({ ...resumo, jobId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ ok: false, erro: msg }, { status: 500 });
  }
}
