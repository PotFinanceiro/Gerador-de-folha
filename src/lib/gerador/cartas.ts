import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import JSZip from "jszip";
import { promises as fs } from "fs";
import path from "path";
import { MESES_EXT, sanitizarWinAnsi } from "./folhas";

export interface BeneficiarioCarta {
  nome: string;
  benef: string;
  agencia: string;
  nome_ag: string;
  endereco: string;
}

export interface BeneficiarioPulado {
  nome: string;
  motivo: string;
}

export interface ResultadoGeracaoCartas {
  zipBuffer: Buffer;
  previewBuffer: Buffer;
  previewNome: string;
  resumo: {
    ok: boolean;
    data: string;
    total: number;
    pulados: BeneficiarioPulado[];
    assinatura: "digital" | "modelo";
    zip: string;
    preview: string;
    primeiro: string;
  };
}

function semAcento(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function limpa(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    return String(v);
  }
  const s = String(v).trim();
  if (["#N/A", "#REF!", "#VALUE!", "None", "nan"].includes(s)) return "";
  return s;
}

function chaveAg(v: unknown): string {
  return limpa(v).replace(/\s+/g, "").toUpperCase();
}

export function dataPorExtenso(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error("Data inválida.");
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const mesExt = MESES_EXT[mes];
  if (!mesExt || dia < 1 || dia > 31) throw new Error("Data inválida.");
  return `São Paulo, ${dia} de ${mesExt} de ${ano}`;
}

export function lerPlanilhaCartas(buffer: Buffer): {
  beneficiarios: BeneficiarioCarta[];
  pulados: BeneficiarioPulado[];
} {
  const wb = XLSX.read(buffer, { type: "buffer" });
  let wsDados: XLSX.WorkSheet | null = null;
  let wsAg: XLSX.WorkSheet | null = null;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
    if (rows.length === 0) continue;
    const cab = (rows[0] || []).slice(0, 10).map((c) => semAcento(limpa(c)));
    if (cab.includes("nome") && cab.some((c) => c.includes("benef") || c.includes("agenc"))) {
      if (!wsDados) wsDados = ws;
    }
    if (cab.some((c) => c.includes("prefixo")) && cab.some((c) => c.includes("depend"))) {
      wsAg = ws;
    }
  }

  if (!wsDados) {
    wsDados = wb.Sheets[wb.SheetNames[0]];
  }

  // Mapa de agências (aba LISTA DE AGENCIAS): prefixo -> [nome_agencia, endereco]
  const agencias: Record<string, [string, string]> = {};
  if (wsAg) {
    const agRows = XLSX.utils.sheet_to_json<unknown[]>(wsAg, { header: 1, defval: null });
    for (let r = 1; r < agRows.length; r++) {
      const row = agRows[r];
      if (!row || !row[0]) continue;
      agencias[chaveAg(row[0])] = [limpa(row[1]), limpa(row[4])];
    }
  }

  const dadosRows = XLSX.utils.sheet_to_json<unknown[]>(wsDados, { header: 1, defval: null });
  if (dadosRows.length === 0) {
    throw new Error("Planilha vazia.");
  }

  const cab = (dadosRows[0] || []).map((c) => semAcento(limpa(c)));
  const col = (...termos: string[]): number | null => {
    for (const t of termos) {
      for (let i = 0; i < cab.length; i++) {
        if (cab[i].includes(t)) return i;
      }
    }
    return null;
  };

  const cNome = col("nome");
  const cBenef = col("benef", "matricula", "cart");
  const cAg = col("agenc", "prefixo");
  const cNomeAg =
    cab.findIndex((h, i) => i !== cAg && i !== cNome && h.includes("nome") && h.includes("ag")) >= 0
      ? cab.findIndex((h, i) => i !== cAg && i !== cNome && h.includes("nome") && h.includes("ag"))
      : col("depend");
  const cEnd = col("endere");

  if (cNome === null || cBenef === null || cAg === null) {
    throw new Error(
      "Não encontrei na planilha as colunas obrigatórias: Nome, Número do Benefício e Agência."
    );
  }

  const beneficiarios: BeneficiarioCarta[] = [];
  const pulados: BeneficiarioPulado[] = [];

  for (let r = 1; r < dadosRows.length; r++) {
    const row = dadosRows[r];
    if (!row) continue;
    const pega = (idx: number | null) => (idx !== null && idx >= 0 && idx < row.length ? limpa(row[idx]) : "");

    const nome = pega(cNome);
    if (!nome) continue;

    const benef = pega(cBenef);
    const ag = pega(cAg);
    let nomeAg = pega(cNomeAg);
    let endereco = pega(cEnd);

    if ((!nomeAg || !endereco) && chaveAg(ag) in agencias) {
      const [na, en] = agencias[chaveAg(ag)];
      if (!nomeAg) nomeAg = na;
      if (!endereco) endereco = en;
    }

    const faltando: string[] = [];
    if (!benef) faltando.push("Número do Benefício");
    if (!ag) faltando.push("Agência");
    if (!nomeAg) faltando.push("Nome da Agência");
    if (!endereco) faltando.push("Endereço da Agência");

    if (faltando.length > 0) {
      pulados.push({ nome, motivo: `Sem dado: ${faltando.join(", ")}` });
      continue;
    }

    beneficiarios.push({
      nome,
      benef,
      agencia: ag,
      nome_ag: nomeAg,
      endereco,
    });
  }

  return { beneficiarios, pulados };
}

const cmToPt = (cm: number) => cm * 28.3464567;

async function carregarAssetsCarta(): Promise<{
  brasao: Buffer | null;
  assinaturaPadrao: Buffer | null;
}> {
  const dir = path.join(process.cwd(), "public", "templates");
  const brasao = await fs.readFile(path.join(dir, "brasao_carta.png")).catch(() => null);
  const assinaturaPadrao = await fs
    .readFile(path.join(dir, "assinatura_padrao.png"))
    .catch(() => null);
  return { brasao, assinaturaPadrao };
}

function quebrarLinhas(
  textoStr: string,
  maxWidth: number,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  fontSize: number
): string[] {
  const palavras = sanitizarWinAnsi(textoStr).split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = "";

  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (font.widthOfTextAtSize(teste, fontSize) <= maxWidth) {
      atual = teste;
    } else {
      if (atual) linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.length > 0 ? linhas : [""];
}

async function gerarPdfCartaIndividual(
  b: BeneficiarioCarta,
  dataTxt: string,
  brasaoBytes: Buffer | null,
  assinaturaBytes: Buffer | null
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 Portrait
  const { width, height } = page.getSize();

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fontBoldItalic = await doc.embedFont(StandardFonts.HelveticaBoldOblique);

  const black = rgb(0, 0, 0);

  // 1. Brasão centralizado no topo
  if (brasaoBytes) {
    try {
      const imgBrasao = await doc.embedPng(brasaoBytes);
      const bW = cmToPt(2.35);
      const bH = cmToPt(2.45);
      page.drawImage(imgBrasao, {
        x: (width - bW) / 2,
        y: height - cmToPt(1.35) - bH,
        width: bW,
        height: bH,
      });
    } catch {}
  }

  // Cabeçalho Institucional
  const cab1 = sanitizarWinAnsi("PREFEITURA DO MUNICÍPIO DE SÃO PAULO");
  const cab2 = sanitizarWinAnsi(
    "Secretaria Municipal do Desenvolvimento, Economico, Trabalho e Turismo- SMDET"
  );
  page.drawText(cab1, {
    x: (width - fontBold.widthOfTextAtSize(cab1, 12)) / 2,
    y: height - cmToPt(4.35),
    size: 12,
    font: fontBold,
    color: black,
  });
  page.drawText(cab2, {
    x: (width - fontBoldItalic.widthOfTextAtSize(cab2, 10.5)) / 2,
    y: height - cmToPt(4.9),
    size: 10.5,
    font: fontBoldItalic,
    color: black,
  });

  // Título Principal
  const marginX = cmToPt(2.5);
  const maxTextW = width - marginX * 2;

  const tPrincipal = sanitizarWinAnsi(
    "AUTORIZAÇÃO PARA RETIRADA DE CARTÃO MAGNÉTICO E CADASTRO DE SENHA:"
  );
  const linhasTit = quebrarLinhas(tPrincipal, maxTextW, fontBold, 11.5);
  let curY = height - cmToPt(6.5);
  for (const l of linhasTit) {
    page.drawText(l, { x: marginX, y: curY, size: 11.5, font: fontBold, color: black });
    curY -= 16;
  }

  // Subtítulo Centralizado
  curY -= 18;
  const subTit = sanitizarWinAnsi(
    "AUTORIZAMOS O CADASTRAMENTO DE SENHA E RETIRADA DO CARTÃO MAGNETICO DO PROGRAMA OPERAÇÃO TRABALHO (07) DO BENEFICIARIO (A) ABAIXO:"
  );
  const linhasSub = quebrarLinhas(subTit, maxTextW, fontBold, 11);
  for (const l of linhasSub) {
    const lw = fontBold.widthOfTextAtSize(l, 11);
    page.drawText(l, { x: (width - lw) / 2, y: curY, size: 11, font: fontBold, color: black });
    curY -= 16;
  }

  // Dados do Beneficiário
  curY -= 22;
  const campos = [
    `NOME: ${b.nome}`,
    `NÚMERO BENEFÍCIO: ${b.benef}`,
    `AGÊNCIA:  ${b.agencia}`,
    `NOME DA AGÊNCIA: ${b.nome_ag}`,
  ];
  for (const c of campos) {
    const txt = sanitizarWinAnsi(c);
    page.drawText(txt, { x: marginX, y: curY, size: 11, font: fontBold, color: black });
    curY -= 26;
  }

  // Cláusulas numeradas 1 a 4
  curY -= 10;
  const clausulas = [
    {
      num: "1.",
      partes: [
        { t: "O pagamento ocorrerá ", bold: false },
        { t: "A PARTIR DO DÉCIMO QUINTO ", bold: true },
        { t: "dia útil do mês.", bold: false },
      ],
    },
    {
      num: "2.",
      partes: [{ t: "O comparecimento ao Banco do Brasil deverá ser na data indicada.", bold: false }],
    },
    {
      num: "3.",
      partes: [{ t: "O Banco do Brasil não atenderá fora da data indicada.", bold: false }],
    },
    {
      num: "4.",
      partes: [
        {
          t: "O não comparecimento da data indicada, o Banco dará uma senha informando nova data.",
          bold: false,
        },
      ],
    },
  ];

  const indentNum = marginX + cmToPt(0.6);
  const indentTxt = marginX + cmToPt(1.25);

  for (const cl of clausulas) {
    page.drawText(cl.num, { x: indentNum, y: curY, size: 11, font: fontRegular, color: black });
    let cx = indentTxt;
    for (const p of cl.partes) {
      const f = p.bold ? fontBold : fontRegular;
      const s = sanitizarWinAnsi(p.t);
      page.drawText(s, { x: cx, y: curY, size: 11, font: f, color: black });
      cx += f.widthOfTextAtSize(s, 11);
    }
    curY -= 20;
  }

  // Data alinhada à direita
  curY -= 28;
  const dtStr = sanitizarWinAnsi(dataTxt);
  const dtW = fontRegular.widthOfTextAtSize(dtStr, 11);
  page.drawText(dtStr, {
    x: width - marginX - dtW,
    y: curY,
    size: 11,
    font: fontRegular,
    color: black,
  });

  // Assinatura
  const sigCenterY = curY - cmToPt(2.8);
  const sigCenterX = width / 2 + cmToPt(1.8);

  if (assinaturaBytes) {
    try {
      const imgSig = await doc.embedPng(assinaturaBytes);
      const maxW = cmToPt(6.5);
      const maxH = cmToPt(2.1);
      const dims = imgSig.scaleToFit(maxW, maxH);
      page.drawImage(imgSig, {
        x: sigCenterX - dims.width / 2,
        y: sigCenterY + 6,
        width: dims.width,
        height: dims.height,
      });
    } catch {}
  }

  // Linha de assinatura
  const lineHalfW = cmToPt(4.2);
  page.drawLine({
    start: { x: sigCenterX - lineHalfW, y: sigCenterY },
    end: { x: sigCenterX + lineHalfW, y: sigCenterY },
    thickness: 0.75,
    color: black,
  });

  const lblAss = sanitizarWinAnsi("(ASSINATURA PRÓPRIO PUNHO)");
  const lblAssW = fontRegular.widthOfTextAtSize(lblAss, 10);
  page.drawText(lblAss, {
    x: sigCenterX - lblAssW / 2,
    y: sigCenterY - 14,
    size: 10,
    font: fontRegular,
    color: black,
  });

  // Endereço da Agência no rodapé
  const endY = sigCenterY - cmToPt(2.6);
  const lblEnd = sanitizarWinAnsi("Endereço da Agencia: ");
  const valEnd = sanitizarWinAnsi(b.endereco);
  const lblEndW = fontBold.widthOfTextAtSize(lblEnd, 11);
  page.drawText(lblEnd, { x: marginX, y: endY, size: 11, font: fontBold, color: black });
  page.drawText(valEnd, {
    x: marginX + lblEndW,
    y: endY,
    size: 11,
    font: fontItalic,
    color: black,
  });

  return await doc.save();
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function gerarSvgPreviewCarta(
  b: BeneficiarioCarta,
  dataTxt: string,
  brasaoBytes: Buffer | null,
  assinaturaBytes: Buffer | null
): string {
  const W = 794;
  const H = 1123;
  const brasaoUri = brasaoBytes ? `data:image/png;base64,${brasaoBytes.toString("base64")}` : "";
  const sigUri = assinaturaBytes
    ? `data:image/png;base64,${assinaturaBytes.toString("base64")}`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="100%" height="100%" fill="#FFFFFF" />
  ${
    brasaoUri
      ? `<image href="${brasaoUri}" x="${(W - 90) / 2}" y="48" width="90" height="94" />`
      : ""
  }
  <text x="${W / 2}" y="165" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#000">PREFEITURA DO MUNICÍPIO DE SÃO PAULO</text>
  <text x="${W / 2}" y="186" font-family="Arial, Helvetica, sans-serif" font-size="13.5" font-weight="bold" font-style="italic" text-anchor="middle" fill="#000">Secretaria Municipal do Desenvolvimento, Economico, Trabalho e Turismo- SMDET</text>

  <text x="95" y="250" font-family="Arial, Helvetica, sans-serif" font-size="14.5" font-weight="bold" fill="#000">AUTORIZAÇÃO PARA RETIRADA DE CARTÃO MAGNÉTICO E CADASTRO DE SENHA:</text>

  <text x="${W / 2}" y="295" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#000">AUTORIZAMOS O CADASTRAMENTO DE SENHA E RETIRADA DO CARTÃO MAGNETICO DO</text>
  <text x="${W / 2}" y="315" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#000">PROGRAMA OPERAÇÃO TRABALHO (07) DO BENEFICIARIO (A) ABAIXO:</text>

  <g font-family="Arial, Helvetica, sans-serif" font-size="14.5" font-weight="bold" fill="#000">
    <text x="95" y="370">NOME: ${escapeXml(b.nome)}</text>
    <text x="95" y="405">NÚMERO BENEFÍCIO: ${escapeXml(b.benef)}</text>
    <text x="95" y="440">AGÊNCIA:  ${escapeXml(b.agencia)}</text>
    <text x="95" y="475">NOME DA AGÊNCIA: ${escapeXml(b.nome_ag)}</text>
  </g>

  <g font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#000">
    <text x="115" y="530">1.   O pagamento ocorrerá <tspan font-weight="bold">A PARTIR DO DÉCIMO QUINTO</tspan> dia útil do mês.</text>
    <text x="115" y="558">2.   O comparecimento ao Banco do Brasil deverá ser na data indicada.</text>
    <text x="115" y="586">3.   O Banco do Brasil não atenderá fora da data indicada.</text>
    <text x="115" y="614">4.   O não comparecimento da data indicada, o Banco dará uma senha informando nova data.</text>
  </g>

  <text x="${W - 95}" y="675" font-family="Arial, Helvetica, sans-serif" font-size="14.5" text-anchor="end" fill="#000">${escapeXml(dataTxt)}</text>

  ${
    sigUri
      ? `<image href="${sigUri}" x="${W / 2 + 65 - 120}" y="715" width="240" height="75" preserveAspectRatio="xMidYMid meet" />`
      : ""
  }
  <line x1="${W / 2 + 65 - 155}" y1="795" x2="${W / 2 + 65 + 155}" y2="795" stroke="#000" stroke-width="1" />
  <text x="${W / 2 + 65}" y="815" font-family="Arial, Helvetica, sans-serif" font-size="13" text-anchor="middle" fill="#000">(ASSINATURA PRÓPRIO PUNHO)</text>

  <text x="95" y="905" font-family="Arial, Helvetica, sans-serif" font-size="14.5" fill="#000">
    <tspan font-weight="bold">Endereço da Agencia: </tspan>
    <tspan font-style="italic">${escapeXml(b.endereco)}</tspan>
  </text>
</svg>`;
}

export async function gerarCartasBancoTS(params: {
  arquivoBuffer: Buffer;
  dataIso: string;
  assinaturaBuffer?: Buffer | null;
}): Promise<ResultadoGeracaoCartas> {
  const { arquivoBuffer, dataIso, assinaturaBuffer } = params;
  const dataTxt = dataPorExtenso(dataIso);
  const { beneficiarios, pulados } = lerPlanilhaCartas(arquivoBuffer);

  if (beneficiarios.length === 0) {
    throw new Error("Nenhum beneficiário com dados completos foi encontrado na planilha.");
  }

  const assets = await carregarAssetsCarta();
  const sigBytes =
    assinaturaBuffer && assinaturaBuffer.length > 0 ? assinaturaBuffer : assets.assinaturaPadrao;

  const zip = new JSZip();

  for (let idx = 0; idx < beneficiarios.length; idx++) {
    const b = beneficiarios[idx];
    const pdfBytes = await gerarPdfCartaIndividual(b, dataTxt, assets.brasao, sigBytes);
    const nomeArq = b.nome.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
    const prefix = b.benef || String(idx + 1).padStart(3, "0");
    zip.file(`Carta_${prefix}_${nomeArq}.pdf`, pdfBytes);
  }

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const svgStr = gerarSvgPreviewCarta(beneficiarios[0], dataTxt, assets.brasao, sigBytes);
  const previewBuffer = Buffer.from(svgStr, "utf-8");
  const previewNome = "preview_carta_1.svg";

  const resumo = {
    ok: true,
    data: dataTxt,
    total: beneficiarios.length,
    pulados,
    assinatura: (assinaturaBuffer && assinaturaBuffer.length > 0 ? "digital" : "modelo") as
      | "digital"
      | "modelo",
    zip: "cartas_banco.zip",
    preview: previewNome,
    primeiro: beneficiarios[0].nome,
  };

  return {
    zipBuffer,
    previewBuffer,
    previewNome,
    resumo,
  };
}
