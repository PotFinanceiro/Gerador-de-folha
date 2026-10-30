#!/usr/bin/env python3
"""Testa: extrair xlsm embutido do docx, modificar agenda, reincrustar e converter p/ PDF."""
import zipfile, shutil, os, io, openpyxl

BASE = "/home/z/my-project"
DOCX = f"{BASE}/upload/Base folha de ponto_Zeladoria_Liberdade.docx"
OUT = f"{BASE}/scripts/teste"
os.makedirs(OUT, exist_ok=True)

# 1) Extrair xlsm embutido e inspecionar
z = zipfile.ZipFile(DOCX)
emb = z.read('word/embeddings/Microsoft_Excel_Macro-Enabled_Worksheet.xlsm')
emb_path = f"{OUT}/embutido.xlsm"
open(emb_path, 'wb').write(emb)

wb = openpyxl.load_workbook(emb_path)
print("Sheets embutidas:", wb.sheetnames)
for ws in wb.worksheets:
    print(f"\nSheet {ws.title}: dims={ws.dimensions} max={ws.max_row}x{ws.max_column}")
    print("  merged:", [str(m) for m in ws.merged_cells.ranges])
    widths = {k: round(v.width, 1) for k, v in ws.column_dimensions.items() if v.width}
    print("  col widths:", widths)
    for row in ws.iter_rows(min_row=1, max_row=min(ws.max_row, 34), max_col=min(ws.max_column, 6)):
        vals = []
        for c in row:
            if c.value is not None:
                fill = None
                try:
                    if c.fill and c.fill.fill_type == 'solid':
                        fill = c.fill.start_color.rgb
                except Exception:
                    pass
                fs = f"[{fill}]" if fill and str(fill) != '00000000' else ""
                ft = ""
                try:
                    if c.font and c.font.color and c.font.color.rgb:
                        ft = f"(font:{c.font.color.rgb},b={c.font.bold},{c.font.size}pt)"
                except Exception:
                    pass
                vals.append(f"{c.coordinate}={str(c.value)[:40]!r}{fs}{ft}")
        if vals:
            print("   " + " | ".join(vals))

# 2) Modificar: mudar mes para 12/2026 e marcar cursos nas quintas
ws = wb.worksheets[0]
mes, ano = 12, 2026
import calendar, datetime
DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
FOLGAS = {'Seg', 'Ter'}
CURSO = 'Qui'
ultimo = calendar.monthrange(ano, mes)[1]
# limpar
for r in range(2, 33):
    for col in (1, 2, 3):
        ws.cell(row=r, column=col).value = None
        ws.cell(row=r, column=col).fill = openpyxl.styles.PatternFill(fill_type=None)
for i in range(1, ultimo + 1):
    r = i + 1
    d = datetime.date(ano, mes, i)
    dn = DIAS[d.weekday() + 1 if d.weekday() < 6 else 0]
    ws.cell(row=r, column=1).value = i
    ws.cell(row=r, column=2).value = dn
    if dn in FOLGAS:
        ws.cell(row=r, column=3).value = 'Folga'
        cinza = openpyxl.styles.PatternFill('solid', start_color='FFBFBFBF')
        for col in (1, 2, 3):
            ws.cell(row=r, column=col).fill = cinza
    elif dn == CURSO:
        ws.cell(row=r, column=3).value = 'Curso'
mod_path = f"{OUT}/embutido_mod.xlsm"
wb.save(mod_path)

# 3) Recriar docx com o xlsm modificado
novo = f"{OUT}/modelo_modificado.docx"
zin = zipfile.ZipFile(DOCX)
with zipfile.ZipFile(novo, 'w', zipfile.ZIP_DEFLATED) as zout:
    for item in zin.namelist():
        data = zin.read(item)
        if item == 'word/embeddings/Microsoft_Excel_Macro-Enabled_Worksheet.xlsm':
            data = open(mod_path, 'rb').read()
        zout.writestr(item, data)
print("\ndocx modificado criado:", novo)
