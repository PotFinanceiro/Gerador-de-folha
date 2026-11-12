import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import JSZip from "jszip";
import { promises as fs } from "fs";
import path from "path";

export const MESES_EXT: Record<number, string> = {
  1: "janeiro",
  2: "fevereiro",
  3: "março",
  4: "abril",
  5: "maio",
  6: "junho",
  7: "julho",
  8: "agosto",
  9: "setembro",
  10: "outubro",
  11: "novembro",
  12: "dezembro",
};

// No nosso sistema TS/UI: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
const DIAS_ABREV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const DIAS_COMPLETO = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

export interface BeneficiarioFolha {
  ordem: string;
  projeto: string;
  cartao: string;
  nome: string;
  agencia: string;
  rg: string;
  cpf: string;
  sub: string;
  tcr: string;
  frente: string;
  periodo: string;
  curso_idx: number | null;
  curso_txt: string;
}

export interface ResultadoGeracaoFolhas {
  zipBuffer: Buffer;
  previewBuffer: Buffer;
  previewNome: string;
  resumo: {
    ok: boolean;
    mes: number;
    ano: number;
    mes_vigente: string;
    total: number;
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

function texto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    return String(v);
  }
  return String(v).trim();
}

export function sanitizarWinAnsi(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function normCpf(v: unknown): string {
  const s = texto(v);
  const dig = s.replace(/\D/g, "");
  if (dig && !/[a-zA-Z]/.test(s) && dig.length <= 11) {
    const d = dig.padStart(11, "0");
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return s;
}

function normPeriodo(v: unknown): string {
  const s = texto(v);
  const k = semAcento(s);
  if (k === "manha") return "Manhã";
  if (k === "tarde") return "Tarde";
  if (k === "noite") return "Noite";
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function normSubpref(v: unknown): string {
  const s = texto(v);
  if (semAcento(s) === "se") return "Sé";
  return s;
}

function normCursoIdx(v: unknown): number | null {
  const k = semAcento(texto(v));
  const mapa: Record<string, number> = {
    dom: 0,
    domingo: 0,
    seg: 1,
    segunda: 1,
    "segunda-feira": 1,
    ter: 2,
    terca: 2,
    "terca-feira": 2,
    qua: 3,
    quarta: 3,
    "quarta-feira": 3,
    qui: 4,
    quinta: 4,
    "quinta-feira": 4,
    sex: 5,
    sexta: 5,
    "sexta-feira": 5,
    sab: 6,
    sabado: 6,
  };
  if (k in mapa) return mapa[k];
  for (const [ch, idx] of Object.entries(mapa)) {
    if (k.startsWith(ch)) return idx;
  }
  return null;
}

function normTcr(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const d = String(v.getUTCDate()).padStart(2, "0");
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const y = v.getUTCFullYear();
    return `${d}/${m}/${y}`;
  }
  const s = texto(v);
  const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (mIso) {
    return `${mIso[3]}/${mIso[2]}/${mIso[1]}`;
  }
  return s;
}

export function lerPlanilhaFolhas(buffer: Buffer): BeneficiarioFolha[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  let wsEscolhida: XLSX.WorkSheet | null = null;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
    if (rows.length > 0) {
      const cab = (rows[0] || []).slice(0, 13).map((c) => semAcento(texto(c)));
      if (cab.includes("nome") && cab.some((c) => c.includes("cart"))) {
        wsEscolhida = ws;
        break;
      }
    }
  }
  if (!wsEscolhida) {
    wsEscolhida = wb.Sheets[wb.SheetNames[0]];
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(wsEscolhida, { header: 1, defval: null });
  if (rows.length < 2) return [];

  const cab = (rows[0] || []).map((c) => semAcento(texto(c)));
  const col = (...nomes: string[]): number => {
    for (const n of nomes) {
      const nNorm = semAcento(n);
      for (let i = 0; i < cab.length; i++) {
        if (cab[i] && (cab[i] === nNorm || cab[i].startsWith(nNorm))) {
          return i;
        }
      }
    }
    return -1;
  };

  const idx = {
    ordem: col("ordem"),
    projeto: col("projeto"),
    cartao: col("num_cartao", "cartao", "nº cartao", "numero cartao"),
    nome: col("nome"),
    agencia: col("agencia"),
    rg: col("rg"),
    cpf: col("cpf"),
    sub: col("subprefeitura"),
    tcr: col("tcr", "data do tcr"),
    frente: col("frente de trabalho", "frente"),
    periodo: col("periodo"),
    curso: col("curso dia", "curso"),
  };

  const get = (row: unknown[], k: keyof typeof idx): unknown => {
    const i = idx[k];
    return i >= 0 && i < row.length ? row[i] : null;
  };

  const registros: BeneficiarioFolha[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const nome = texto(get(row, "nome"));
    if (!nome) continue;

    const cIdx = normCursoIdx(get(row, "curso"));
    const cTxt = cIdx !== null ? DIAS_COMPLETO[cIdx] : texto(get(row, "curso"));

    registros.push({
      ordem: texto(get(row, "ordem")),
      projeto: texto(get(row, "projeto")) || "Zeladoria",
      cartao: texto(get(row, "cartao")),
      nome,
      agencia: texto(get(row, "agencia")),
      rg: texto(get(row, "rg")),
      cpf: normCpf(get(row, "cpf")),
      sub: normSubpref(get(row, "sub")),
      tcr: normTcr(get(row, "tcr")),
      frente: texto(get(row, "frente")),
      periodo: normPeriodo(get(row, "periodo")),
      curso_idx: cIdx,
      curso_txt: cTxt,
    });
  }

  return registros;
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

function blocosAssinatura(ano: number, mes: number, ultimoDia: number): [number, number][] {
  const blocos: [number, number][] = [];
  let ini = 1;
  for (let d = 1; d <= ultimoDia; d++) {
    const wd = new Date(ano, mes - 1, d).getDay(); // 0 = Domingo
    if (wd === 0) {
      blocos.push([ini, d]);
      ini = d + 1;
    }
  }
  if (ini <= 31) {
    blocos.push([ini, 31]);
  } else if (blocos.length > 0) {
    blocos[blocos.length - 1] = [blocos[blocos.length - 1][0], 31];
  }
  return blocos;
}

const cmToPt = (cm: number) => cm * 28.3464567;

async function carregarBrasaoFolha(): Promise<Buffer | null> {
  const candidatos = [
    path.join(process.cwd(), "public", "templates", "brasao_carta.png"),
    path.join(process.cwd(), "public", "templates", "brasao_folha.png"),
  ];
  for (const p of candidatos) {
    try {
      return await fs.readFile(p);
    } catch {}
  }
  return null;
}

async function gerarPdfFolhaIndividual(
  b: BeneficiarioFolha,
  mes: number,
  ano: number,
  folgasWeekdays: Set<number>,
  extraDates: Set<string>,
  brasaoBytes: Buffer | null
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 Portrait
  const { height } = page.getSize();

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0, 0, 0);
  const white = rgb(1, 1, 1);
  const grayFill = rgb(191 / 255, 191 / 255, 191 / 255); // #BFBFBF
  const lightGrayBorder = rgb(191 / 255, 191 / 255, 191 / 255);

  // 1. Brasão no canto superior direito
  if (brasaoBytes) {
    try {
      const img = await doc.embedPng(brasaoBytes);
      const imgW = cmToPt(1.9);
      const imgH = cmToPt(2.0);
      const imgX = cmToPt(16.95);
      const imgY = height - cmToPt(1.1) - imgH;
      page.drawImage(img, { x: imgX, y: imgY, width: imgW, height: imgH });

      const t1 = "PREFEITURA DE";
      const t2 = "SAO PAULO";
      const w1 = fontBold.widthOfTextAtSize(t1, 6.5);
      const w2 = fontBold.widthOfTextAtSize("SÃO PAULO", 8);
      page.drawText(t1, {
        x: imgX + (imgW - w1) / 2,
        y: imgY - 8,
        size: 6.5,
        font: fontBold,
        color: black,
      });
      page.drawText(sanitizarWinAnsi("SÃO PAULO"), {
        x: imgX + (imgW - w2) / 2,
        y: imgY - 17,
        size: 8,
        font: fontBold,
        color: black,
      });
    } catch {}
  }

  // 2. Título Centralizado
  const titulo = sanitizarWinAnsi("PREFEITURA DO MUNICIPIO DE SÃO PAULO");
  const tituloW = fontBold.widthOfTextAtSize(titulo, 12);
  page.drawText(titulo, {
    x: (595.28 - tituloW) / 2 - cmToPt(0.8),
    y: height - cmToPt(2.15),
    size: 12,
    font: fontBold,
    color: black,
  });

  // Helper para desenhar par de Rótulo + Valor na mesma linha
  const drawField = (xCm: number, yTopCm: number, label: string, value: string, size = 10) => {
    const x = cmToPt(xCm);
    const y = height - cmToPt(yTopCm);
    const lbl = sanitizarWinAnsi(label);
    const val = sanitizarWinAnsi(value);
    page.drawText(lbl, { x, y, size, font: fontRegular, color: black });
    const lblW = fontRegular.widthOfTextAtSize(lbl, size);
    page.drawText(val, { x: x + lblW + 4, y, size, font: fontRegular, color: black });
  };

  const mesExt = MESES_EXT[mes] || String(mes);

  // 3. Campos do cabeçalho do beneficiário (idênticos ao modelo oficial)
  drawField(1.25, 4.15, "Nome do beneficiário:  ", b.nome);
  drawField(1.25, 4.72, "Programa Operação Trabalho:  ", b.projeto);
  drawField(8.75, 4.72, "Período:   ", b.periodo);
  drawField(1.25, 5.29, "Frente de trabalho: ", b.frente);
  drawField(7.75, 5.29, "Dia do Curso: ", b.curso_txt);
  drawField(1.25, 5.86, "Subprefeitura:  ", b.sub);
  drawField(1.25, 6.43, "Mês Vigente:   ", `${mesExt}/ ${ano}`);
  drawField(8.95, 6.43, "RG:   ", b.rg);
  drawField(13.85, 6.43, "CPF:   ", b.cpf);
  drawField(1.25, 7.00, "Nº cartão: ", b.cartao);
  drawField(5.25, 7.00, "Agência: ", b.agencia);
  drawField(9.55, 7.00, "Data do TCR: ", b.tcr);

  // 4. Tabela de Frequência (31 dias)
  const xStart = cmToPt(1.253);
  const colWidths = [cmToPt(1.88), cmToPt(3.268), cmToPt(2.972), cmToPt(10.117)];
  const totalTableW = colWidths.reduce((a, c) => a + c, 0);
  const colX = [
    xStart,
    xStart + colWidths[0],
    xStart + colWidths[0] + colWidths[1],
    xStart + colWidths[0] + colWidths[1] + colWidths[2],
    xStart + totalTableW,
  ];

  const headerTopY = height - cmToPt(7.65);
  const headerH = cmToPt(0.45);
  const rowH = cmToPt(0.5326);

  // Cabeçalho preto
  page.drawRectangle({
    x: xStart,
    y: headerTopY - headerH,
    width: totalTableW,
    height: headerH,
    color: black,
    borderColor: black,
    borderWidth: 0.75,
  });

  const headers = ["DIA", "DIA DA SEMANA", "APONTAMENTO", "ASSINATURA"];
  for (let c = 0; c < 4; c++) {
    const txt = headers[c];
    const tw = fontBold.widthOfTextAtSize(txt, 8.5);
    const cx = colX[c] + (colWidths[c] - tw) / 2;
    const cy = headerTopY - headerH + (headerH - 8.5) / 2 + 1.5;
    page.drawText(txt, { x: cx, y: cy, size: 8.5, font: fontBold, color: white });
  }

  const ultimoDia = ultimoDiaDoMes(ano, mes);

  // Linhas 1..31 (colunas 1, 2, 3)
  for (let d = 1; d <= 31; d++) {
    const rTop = headerTopY - headerH - (d - 1) * rowH;
    const rBot = rTop - rowH;

    let txtDia = "";
    let txtSem = "";
    let txtApont = "";
    let isFolga = false;

    if (d <= ultimoDia) {
      const dt = new Date(ano, mes - 1, d);
      const wd = dt.getDay(); // 0=Dom..6=Sab
      const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      isFolga = folgasWeekdays.has(wd) || extraDates.has(iso);
      txtDia = String(d);
      txtSem = DIAS_ABREV[wd];
      if (isFolga) {
        txtApont = "Folga";
      } else if (b.curso_idx !== null && wd === b.curso_idx) {
        txtApont = "Curso";
      }
    }

    // Fundo cinza nas 3 primeiras colunas se for Folga
    if (isFolga) {
      page.drawRectangle({
        x: colX[0],
        y: rBot,
        width: colWidths[0] + colWidths[1] + colWidths[2],
        height: rowH,
        color: grayFill,
      });
    }

    // Bordas das células 0, 1, 2
    for (let c = 0; c < 3; c++) {
      page.drawRectangle({
        x: colX[c],
        y: rBot,
        width: colWidths[c],
        height: rowH,
        borderColor: black,
        borderWidth: 0.6,
      });
    }

    // Textos centralizados nas colunas 0, 1, 2
    const vals = [txtDia, txtSem, txtApont];
    for (let c = 0; c < 3; c++) {
      const v = sanitizarWinAnsi(vals[c]);
      if (!v) continue;
      const tw = fontRegular.widthOfTextAtSize(v, 9);
      const cx = colX[c] + (colWidths[c] - tw) / 2;
      const cy = rBot + (rowH - 9) / 2 + 1.5;
      page.drawText(v, { x: cx, y: cy, size: 9, font: fontRegular, color: black });
    }
  }

  // Coluna 4 (ASSINATURA): mesclada por semana (terminando aos domingos), idêntica ao template oficial
  const blocos = blocosAssinatura(ano, mes, ultimoDia);
  for (const [dIni, dFim] of blocos) {
    const bTop = headerTopY - headerH - (dIni - 1) * rowH;
    const bH = (dFim - dIni + 1) * rowH;
    page.drawRectangle({
      x: colX[3],
      y: bTop - bH,
      width: colWidths[3],
      height: bH,
      borderColor: black,
      borderWidth: 0.6,
    });
  }

  // Linha artefato inferior do template (altura 0.91cm, borda cinza clara)
  const bodyBotY = headerTopY - headerH - 31 * rowH;
  const artH = cmToPt(0.91);
  for (let c = 0; c < 4; c++) {
    page.drawRectangle({
      x: colX[c],
      y: bodyBotY - artH,
      width: colWidths[c],
      height: artH,
      borderColor: lightGrayBorder,
      borderWidth: 0.5,
    });
  }

  // 5. Rodapé: Recebido por / Entregue por
  const lineY = height - cmToPt(27.05);
  const leftLineX1 = cmToPt(2.38);
  const leftLineX2 = cmToPt(8.18);
  const rightLineX1 = cmToPt(12.22);
  const rightLineX2 = cmToPt(18.02);

  page.drawLine({
    start: { x: leftLineX1, y: lineY },
    end: { x: leftLineX2, y: lineY },
    thickness: 0.75,
    color: black,
  });
  page.drawLine({
    start: { x: rightLineX1, y: lineY },
    end: { x: rightLineX2, y: lineY },
    thickness: 0.75,
    color: black,
  });

  const recTxt = "Recebido por:";
  const entTxt = "Entregue por:";
  const recW = fontRegular.widthOfTextAtSize(recTxt, 9.5);
  const entW = fontRegular.widthOfTextAtSize(entTxt, 9.5);

  page.drawText(recTxt, {
    x: leftLineX1 + (leftLineX2 - leftLineX1 - recW) / 2,
    y: lineY - 13,
    size: 9.5,
    font: fontRegular,
    color: black,
  });
  page.drawText(entTxt, {
    x: rightLineX1 + (rightLineX2 - rightLineX1 - entW) / 2,
    y: lineY - 13,
    size: 9.5,
    font: fontRegular,
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

function gerarSvgPreviewFolha(
  b: BeneficiarioFolha,
  mes: number,
  ano: number,
  folgasWeekdays: Set<number>,
  extraDates: Set<string>,
  brasaoBytes: Buffer | null
): string {
  const W = 794; // A4 @ 96dpi
  const H = 1123;
  const scale = W / 595.28;
  const pt = (cm: number) => cm * 28.3464567 * scale;

  const mesExt = MESES_EXT[mes] || String(mes);
  const ultimoDia = ultimoDiaDoMes(ano, mes);

  const brasaoDataUri = brasaoBytes
    ? `data:image/png;base64,${brasaoBytes.toString("base64")}`
    : "";

  const xStart = pt(1.253);
  const colW = [pt(1.88), pt(3.268), pt(2.972), pt(10.117)];
  const totalW = colW.reduce((a, c) => a + c, 0);
  const colX = [
    xStart,
    xStart + colW[0],
    xStart + colW[0] + colW[1],
    xStart + colW[0] + colW[1] + colW[2],
  ];

  const headerTopY = pt(7.4);
  const headerH = pt(0.45);
  const rowH = pt(0.5326);

  let rowsSvg = "";
  for (let d = 1; d <= 31; d++) {
    const ry = headerTopY + headerH + (d - 1) * rowH;
    let txtDia = "";
    let txtSem = "";
    let txtApont = "";
    let isFolga = false;

    if (d <= ultimoDia) {
      const dt = new Date(ano, mes - 1, d);
      const wd = dt.getDay();
      const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      isFolga = folgasWeekdays.has(wd) || extraDates.has(iso);
      txtDia = String(d);
      txtSem = DIAS_ABREV[wd];
      if (isFolga) txtApont = "Folga";
      else if (b.curso_idx !== null && wd === b.curso_idx) txtApont = "Curso";
    }

    if (isFolga) {
      rowsSvg += `<rect x="${colX[0]}" y="${ry}" width="${colW[0] + colW[1] + colW[2]}" height="${rowH}" fill="#BFBFBF" />`;
    }

    for (let c = 0; c < 3; c++) {
      rowsSvg += `<rect x="${colX[c]}" y="${ry}" width="${colW[c]}" height="${rowH}" fill="none" stroke="#000" stroke-width="0.8" />`;
    }

    const vals = [txtDia, txtSem, txtApont];
    for (let c = 0; c < 3; c++) {
      if (vals[c]) {
        rowsSvg += `<text x="${colX[c] + colW[c] / 2}" y="${ry + rowH * 0.68}" font-family="Arial, Helvetica, sans-serif" font-size="11.5" text-anchor="middle" fill="#000">${escapeXml(vals[c])}</text>`;
      }
    }
  }

  const blocos = blocosAssinatura(ano, mes, ultimoDia);
  for (const [dIni, dFim] of blocos) {
    const by = headerTopY + headerH + (dIni - 1) * rowH;
    const bh = (dFim - dIni + 1) * rowH;
    rowsSvg += `<rect x="${colX[3]}" y="${by}" width="${colW[3]}" height="${bh}" fill="none" stroke="#000" stroke-width="0.8" />`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="100%" height="100%" fill="#FFFFFF" />
  ${
    brasaoDataUri
      ? `<image href="${brasaoDataUri}" x="${pt(16.95)}" y="${pt(1.1)}" width="${pt(1.9)}" height="${pt(2.0)}" />
         <text x="${pt(17.9)}" y="${pt(3.35)}" font-family="Arial, Helvetica, sans-serif" font-size="8.5" font-weight="bold" text-anchor="middle" fill="#000">PREFEITURA DE</text>
         <text x="${pt(17.9)}" y="${pt(3.65)}" font-family="Arial, Helvetica, sans-serif" font-size="10.5" font-weight="bold" text-anchor="middle" fill="#000">SÃO PAULO</text>`
      : ""
  }
  <text x="${W / 2 - pt(0.8)}" y="${pt(2.15)}" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#000">PREFEITURA DO MUNICIPIO DE SÃO PAULO</text>

  <g font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#000">
    <text x="${pt(1.25)}" y="${pt(4.15)}">Nome do beneficiário:  ${escapeXml(b.nome)}</text>
    <text x="${pt(1.25)}" y="${pt(4.72)}">Programa Operação Trabalho:  ${escapeXml(b.projeto)}</text>
    <text x="${pt(8.75)}" y="${pt(4.72)}">Período:   ${escapeXml(b.periodo)}</text>
    <text x="${pt(1.25)}" y="${pt(5.29)}">Frente de trabalho: ${escapeXml(b.frente)}</text>
    <text x="${pt(7.75)}" y="${pt(5.29)}">Dia do Curso: ${escapeXml(b.curso_txt)}</text>
    <text x="${pt(1.25)}" y="${pt(5.86)}">Subprefeitura:  ${escapeXml(b.sub)}</text>
    <text x="${pt(1.25)}" y="${pt(6.43)}">Mês Vigente:   ${escapeXml(mesExt)}/ ${ano}</text>
    <text x="${pt(8.95)}" y="${pt(6.43)}">RG:   ${escapeXml(b.rg)}</text>
    <text x="${pt(13.85)}" y="${pt(6.43)}">CPF:   ${escapeXml(b.cpf)}</text>
    <text x="${pt(1.25)}" y="${pt(7.00)}">Nº cartão: ${escapeXml(b.cartao)}</text>
    <text x="${pt(5.25)}" y="${pt(7.00)}">Agência: ${escapeXml(b.agencia)}</text>
    <text x="${pt(9.55)}" y="${pt(7.00)}">Data do TCR: ${escapeXml(b.tcr)}</text>
  </g>

  <!-- Cabeçalho da Tabela -->
  <rect x="${xStart}" y="${headerTopY}" width="${totalW}" height="${headerH}" fill="#000000" />
  <g font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF" text-anchor="middle">
    <text x="${colX[0] + colW[0] / 2}" y="${headerTopY + headerH * 0.72}">DIA</text>
    <text x="${colX[1] + colW[1] / 2}" y="${headerTopY + headerH * 0.72}">DIA DA SEMANA</text>
    <text x="${colX[2] + colW[2] / 2}" y="${headerTopY + headerH * 0.72}">APONTAMENTO</text>
    <text x="${colX[3] + colW[3] / 2}" y="${headerTopY + headerH * 0.72}">ASSINATURA</text>
  </g>

  ${rowsSvg}

  <!-- Rodapé -->
  <line x1="${pt(2.38)}" y1="${pt(27.05)}" x2="${pt(8.18)}" y2="${pt(27.05)}" stroke="#000" stroke-width="1" />
  <line x1="${pt(12.22)}" y1="${pt(27.05)}" x2="${pt(18.02)}" y2="${pt(27.05)}" stroke="#000" stroke-width="1" />
  <text x="${pt(5.28)}" y="${pt(27.55)}" font-family="Arial, Helvetica, sans-serif" font-size="12.5" text-anchor="middle" fill="#000">Recebido por:</text>
  <text x="${pt(15.12)}" y="${pt(27.55)}" font-family="Arial, Helvetica, sans-serif" font-size="12.5" text-anchor="middle" fill="#000">Entregue por:</text>
</svg>`;
}

export async function gerarFolhasPontoTS(params: {
  arquivoBuffer: Buffer;
  mes: number;
  ano: number;
  folgasStr: string;
  extraStr: string;
}): Promise<ResultadoGeracaoFolhas> {
  const { arquivoBuffer, mes, ano, folgasStr, extraStr } = params;
  const beneficiarios = lerPlanilhaFolhas(arquivoBuffer);

  if (beneficiarios.length === 0) {
    throw new Error("Nenhum beneficiário encontrado na planilha.");
  }

  // No frontend: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
  const folgasWeekdays = new Set<number>(
    folgasStr
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s))
      .map((s) => Number(s))
  );

  const extraDates = new Set<string>(
    extraStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  const brasaoBytes = await carregarBrasaoFolha();
  const zip = new JSZip();

  for (let idx = 0; idx < beneficiarios.length; idx++) {
    const b = beneficiarios[idx];
    const pdfBytes = await gerarPdfFolhaIndividual(
      b,
      mes,
      ano,
      folgasWeekdays,
      extraDates,
      brasaoBytes
    );
    const nomeArq = b.nome.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
    const prefix = b.cartao || String(idx + 1).padStart(3, "0");
    zip.file(`${prefix}_${nomeArq}.pdf`, pdfBytes);
  }

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const svgStr = gerarSvgPreviewFolha(
    beneficiarios[0],
    mes,
    ano,
    folgasWeekdays,
    extraDates,
    brasaoBytes
  );
  const previewBuffer = Buffer.from(svgStr, "utf-8");
  const previewNome = "preview_folha_1.svg";

  const resumo = {
    ok: true,
    mes,
    ano,
    mes_vigente: `${MESES_EXT[mes]}/ ${ano}`,
    total: beneficiarios.length,
    zip: "folhas_ponto.zip",
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
