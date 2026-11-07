#!/usr/bin/env python3
"""Inspeciona CARTA DE BANCO.docx e Base_carta.xlsm."""
import re
import zipfile
from openpyxl import load_workbook

UP = "/home/z/my-project/upload"

# ---------- DOCX ----------
doc = f"{UP}/CARTA DE BANCO.docx"
z = zipfile.ZipFile(doc)
print("== ARQUIVOS INTERNOS DOCX ==")
for n in z.namelist():
    print("  ", n)

xml = z.read("word/document.xml").decode("utf-8")
paras = re.findall(r"<w:p\b.*?</w:p>", xml, re.S)
print(f"\n== PARAGRAFOS ({len(paras)}) ==")
for i, p in enumerate(paras):
    txt = "".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", p, re.S))
    img = " [IMG]" if ("<a:blip" in p or "<pic:" in p) else ""
    print(f"[{i:02d}]{img} {txt!r}")

# seções / tamanho de página
sect = re.search(r"<w:sectPr.*?</w:sectPr>", xml, re.S)
if sect:
    mg = re.findall(r'<w:pgMar[^/]*/>', sect.group(0))
    print("\n== PAGINA/MARGENS ==")
    print(" ", mg)

# ---------- XLSM ----------
xl = f"{UP}/Base_carta.xlsm"
wb = load_workbook(xl, data_only=True)
print("\n== ABAS XLSM ==")
for ws in wb.worksheets:
    print(f"\n-- aba {ws.title!r}: {ws.max_row} linhas x {ws.max_column} colunas --")
    for r, row in enumerate(ws.iter_rows(min_row=1, max_row=min(ws.max_row, 6), values_only=True), 1):
        print(f"  L{r}: {row}")
