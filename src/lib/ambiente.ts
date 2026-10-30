import { spawnSync } from "child_process";
import path from "path";

/**
 * Configuração portável do ambiente.
 *
 * O sistema funciona em qualquer servidor que tenha:
 *   - Node.js 20+ (para rodar o Next.js)
 *   - Python 3 com openpyxl e pypdf (para gerar o .docx)
 *   - LibreOffice Writer (para converter .docx -> PDF)
 *   - Fonte Carlito (métrica da Calibri; sudo apt install fonts-crosextra-carlito)
 *
 * Variáveis de ambiente opcionais:
 *   FOLHA_ROOT   — pasta raiz do projeto (padrão: pasta onde o servidor foi iniciado)
 *   PYTHON_BIN   — executável do Python (se definido, tem prioridade máxima)
 *   SOFFICE_BIN  — executável do LibreOffice (padrão: "soffice")
 */
export const PROJECT_ROOT = process.env.FOLHA_ROOT
  ? path.resolve(process.env.FOLHA_ROOT)
  : process.cwd();

export const DATA_ROOT = path.join(PROJECT_ROOT, "data");
export const GERADOS_ROOT = path.join(DATA_ROOT, "gerados");
export const PY_SCRIPT = path.join(PROJECT_ROOT, "python", "gerar_folhas.py");
export const TEMPLATE = path.join(PROJECT_ROOT, "python", "template_folha.docx");
export const CARTA_SCRIPT = path.join(PROJECT_ROOT, "python", "gerar_cartas.py");
export const CARTA_TEMPLATE = path.join(PROJECT_ROOT, "python", "template_carta.docx");

export type ChequeAmbiente = { ok: boolean; erro?: string };

let cachePython: { bin: string } | null = null;
let cacheOk: ChequeAmbiente | null = null;

/**
 * Resolução DETERMINÍSTICA do Python.
 *
 * Motivação: o processo do servidor web pode ter um PATH diferente do terminal
 * (ex.: venv do projeto não incluído), e "python3" do PATH pode ser um Python
 * sem as dependências. Então não confiamos no nome — PROVAMOS cada candidato
 * executando `import openpyxl, pypdf` e usamos o primeiro que funcionar.
 *
 * Ordem de candidatos:
 *   1. PYTHON_BIN (variável de ambiente, se definida)
 *   2. venv do projeto:  <raiz>/.venv/bin/python3
 *   3. venv do usuário:  ~/.venv/bin/python3
 *   4. "python3" e "python" resolvidos pelo PATH
 */
export function resolverPython(): { bin?: string; erro?: string; testado: string[] } {
  if (cachePython) return { bin: cachePython.bin, testado: [cachePython.bin] };

  const home = process.env.HOME || "";
  const candidatos = [
    process.env.PYTHON_BIN,
    path.join(PROJECT_ROOT, ".venv", "bin", "python3"),
    home ? path.join(home, ".venv", "bin", "python3") : "",
    "python3",
    "python",
  ]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i); // remove duplicados

  const testado: string[] = [];
  for (const bin of candidatos) {
    testado.push(bin);
    const t = spawnSync(bin, ["-c", "import openpyxl, pypdf"], { encoding: "utf8" });
    if (!t.error && t.status === 0) {
      cachePython = { bin };
      return { bin, testado };
    }
  }

  return {
    erro:
      `Nenhum Python com as dependências (openpyxl/pypdf) foi encontrado. ` +
      `Testei: ${testado.join(", ")}. Corrija com: ` +
      `pip install -r python/requirements.txt  (ou instale os pacotes no Python do sistema, ` +
      `ou defina PYTHON_BIN apontando para o executável correto).`,
    testado,
  };
}

/**
 * Verificação pré-voo: Python + dependências + LibreOffice + template.
 * Falhas NÃO são cacheadas (reavalia a cada geração — útil logo após instalar).
 * Sucessos são cacheados para não pagar o custo a cada requisição.
 */
export function verificarAmbiente(): ChequeAmbiente {
  if (cacheOk?.ok) return cacheOk;

  // 1) Python com openpyxl + pypdf (com prova real de importação)
  const py = resolverPython();
  if (!py.bin) {
    return { ok: false, erro: py.erro };
  }

  // 2) LibreOffice presente? (necessário para converter em PDF)
  let soffice = "";
  for (const bin of [process.env.SOFFICE_BIN || "", "soffice", "libreoffice"]) {
    if (!bin) continue;
    const t = spawnSync(bin, ["--version"], { encoding: "utf8" });
    if (!t.error && t.status === 0) {
      soffice = bin;
      break;
    }
  }
  if (!soffice) {
    return {
      ok: false,
      erro:
        `LibreOffice não foi encontrado no servidor — ele é necessário para converter as folhas em PDF. ` +
        `Instale com: sudo apt install libreoffice-writer fonts-crosextra-carlito  ` +
        `(no Windows/macOS instale o LibreOffice oficial e/ou defina SOFFICE_BIN).`,
    };
  }

  // 3) Template presente?
  const fs = require("fs");
  if (!fs.existsSync(TEMPLATE)) {
    return {
      ok: false,
      erro:
        `Template python/template_folha.docx não encontrado em ${TEMPLATE}. ` +
        `Certifique-se de que a pasta "python" do projeto foi copiada para o servidor.`,
    };
  }

  cacheOk = { ok: true };
  return cacheOk;
}
