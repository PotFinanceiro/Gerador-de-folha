import { criarClienteAdmin } from "@/lib/supabase/admin";
import { promises as fs } from "fs";
import path from "path";
import { GERADOS_ROOT } from "@/lib/ambiente";

const BUCKET = "documentos-gerados";
let bucketConfigurado = false;

export async function salvarArquivosJob(
  jobId: string,
  arquivos: { nome: string; buffer: Buffer; contentType: string }[]
): Promise<void> {
  // 1. Tenta salvar no Supabase Storage (persistente na Vercel)
  try {
    const admin = criarClienteAdmin();

    if (!bucketConfigurado) {
      await admin.storage
        .updateBucket(BUCKET, {
          public: false,
          allowedMimeTypes: [
            "application/zip",
            "image/png",
            "image/svg+xml",
            "application/pdf",
          ],
        })
        .catch(() => {});
      bucketConfigurado = true;
    }

    for (const arq of arquivos) {
      const storagePath = `${jobId}/${arq.nome}`;
      const { error } = await admin.storage.from(BUCKET).upload(storagePath, arq.buffer, {
        contentType: arq.contentType,
        upsert: true,
      });
      if (error) {
        console.error(`Erro ao enviar ${storagePath} ao Supabase Storage:`, error.message);
      }
    }
  } catch (err) {
    console.error("Falha ao acessar Supabase Storage:", err);
  }

  // 2. Também salva localmente (útil em dev local ou cache de instância)
  try {
    const outDir = path.join(GERADOS_ROOT, jobId);
    await fs.mkdir(outDir, { recursive: true });
    for (const arq of arquivos) {
      await fs.writeFile(path.join(outDir, arq.nome), arq.buffer);
    }
  } catch {}
}

export async function lerArquivoJob(jobId: string, nome: string): Promise<Buffer | null> {
  // 1. Tenta ler do Supabase Storage primeiro
  try {
    const admin = criarClienteAdmin();
    const { data, error } = await admin.storage.from(BUCKET).download(`${jobId}/${nome}`);
    if (!error && data) {
      const ab = await data.arrayBuffer();
      return Buffer.from(ab);
    }
  } catch {}

  // 2. Fallback para disco local /tmp
  try {
    const arquivoLocal = path.join(GERADOS_ROOT, jobId, nome);
    return await fs.readFile(arquivoLocal);
  } catch {
    return null;
  }
}
