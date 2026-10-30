#!/usr/bin/env python3
"""Inspeciona os arquivos enviados: 1 docx (modelo) + 2 xlsm (dados)."""
import os, zipfile, re

UPLOAD = "/home/z/my-project/upload"

def hr(title):
    print("\n" + "=" * 90)
    print(title)
    print("=" * 90)

# ---------------- DOCX ----------------
from docx import Document
doc_path = os.path.join(UPLOAD, "Base folha de ponto_Zeladoria_Liberdade.docx")
doc = Document(doc_path)

hr("DOCX: SECOES / MARGENS")
for i, sec in enumerate(doc.sections):
    print(f"Section {i}: page {sec.page_width.cm:.2f} x {sec.page_height.cm:.2f} cm, "
          f"margins T={sec.top_margin.cm:.2f} B={sec.bottom_margin.cm:.2f} "
          f"L={sec.left_margin.cm:.2f} R={sec.right_margin.cm:.2f}, "
          f"headerDist={sec.header_distance.cm:.2f}, footerDist={sec.footer_distance.cm:.2f}")

hr("DOCX: PARGRAFOS DO CORPO")
for i, p in enumerate(doc.paragraphs):
    has_draw = 'w:drawing' in p._p.xml or 'w:pict' in p._p.xml
    print(f"[P{i}] style={p.style.name!r} align={p.alignment} has_drawing={has_draw} text={p.text!r}")
    for j, r in enumerate(p.runs):
        f = r.font
        info = f"    run{j}: text={r.text!r} bold={f.bold} font={f.name} size={f.size.pt if f.size else None}"
        draw = 'w:drawing' in r._r.xml or 'w:pict' in r._r.xml
        print(info + ("   <<<< CONTEM IMAGEM" if draw else ""))

hr("DOCX: TABELAS")
for ti, t in enumerate(doc.tables):
    print(f"\nTable {ti}: {len(t.rows)}r x {len(t.columns)}c, style={t.style.name if t.style else None}")
    for ri, row in enumerate(t.rows):
        try:
            cells = [c.text.replace('\n', ' / ') for c in row.cells]
        except Exception as e:
            cells = [f"<err {e}>"]
        print(f"  R{ri}: {cells}")

hr("DOCX: MIDIAS E IMAGENS (posicionamento)")
with zipfile.ZipFile(doc_path) as z:
    for n in z.namelist():
        if 'media' in n.lower():
            print(f"  {n} ({z.getinfo(n).file_size} bytes)")
    docxml = z.read('word/document.xml').decode('utf-8')
    anchors = re.findall(r'<wp:anchor.*?</wp:anchor>', docxml, re.DOTALL)
    inlines = re.findall(r'<wp:inline.*?</wp:inline>', docxml, re.DOTALL)
    print(f"  float(anchors)={len(anchors)}  inline={len(inlines)}")
    for a in anchors:
        ext = re.search(r'<wp:extent cx="(\d+)" cy="(\d+)"', a)
        if ext:
            print(f"    anchor tam: {int(ext.group(1))/360000:.2f} x {int(ext.group(2))/360000:.2f} cm")
        ph = re.search(r'<wp:positionH relativeFrom="(\w+)">(.*?)</wp:positionH>', a, re.DOTALL)
        pv = re.search(r'<wp:positionV relativeFrom="(\w+)">(.*?)</wp:positionV>', a, re.DOTALL)
        for tag, m in (("posH", ph), ("posV", pv)):
            if m:
                val = re.search(r'<wp:posOffset>(-?\d+)</wp:posOffset>', m.group(2))
                algn = re.search(r'<wp:align>(\w+)</wp:align>', m.group(2))
                v = f"{int(val.group(1))/360000:.3f}cm" if val else (algn.group(1) if algn else "?")
                print(f"    {tag}: relativeFrom={m.group(1)} val={v}")
        bd = re.search(r'behindDoc="(\d)"', a)
        print(f"    behindDoc={bd.group(1) if bd else '?'}")
    for a in inlines:
        ext = re.search(r'<wp:extent cx="(\d+)" cy="(\d+)"', a)
        if ext:
            print(f"    inline tam: {int(ext.group(1))/360000:.2f} x {int(ext.group(2))/360000:.2f} cm")
    print("  nomes de shapes:", re.findall(r'<wp:docPr id="\d+" name="([^"]*)"', docxml))

hr("DOCX: CABECALHO / RODAPE")
for i, sec in enumerate(doc.sections):
    for p in sec.header.paragraphs:
        if p.text.strip() or 'drawing' in p._p.xml:
            print(f"  HEADER: {p.text!r} drawing={'w:drawing' in p._p.xml}")
    for t in sec.header.tables:
        print(f"  HEADER table {len(t.rows)}x{len(t.columns)}")
    for p in sec.footer.paragraphs:
        if p.text.strip() or 'drawing' in p._p.xml:
            print(f"  FOOTER: {p.text!r} drawing={'w:drawing' in p._p.xml}")

hr("DOCX: XML CABECALHO/RODAPE (imagens?)")
with zipfile.ZipFile(doc_path) as z:
    for n in z.namelist():
        if re.match(r'word/(header|footer)\d*\.xml', n):
            x = z.read(n).decode('utf-8')
            print(f"  {n}: drawing={'w:drawing' in x} pict={'w:pict' in x} len={len(x)}")

# ---------------- XLSM ----------------
import openpyxl

def inspect_book(fname, max_sheet_rows=55):
    path = os.path.join(UPLOAD, fname)
    wb = openpyxl.load_workbook(path, data_only=False)
    hr(f"XLSM: {fname}")
    print("Sheets:", wb.sheetnames)
    for ws in wb.worksheets:
        hr(f"  SHEET: {ws.title}  dims={ws.dimensions} max_row={ws.max_row} max_col={ws.max_column}")
        mc = [str(m) for m in list(ws.merged_cells.ranges)[:80]]
        if mc:
            print("  merged:", mc)
        widths = {k: round(v.width, 1) for k, v in ws.column_dimensions.items() if v.width}
        print("  col widths:", widths)
        heights = {k: v.height for k, v in list(ws.row_dimensions.items())[:45] if v.height}
        print("  row heights:", heights)
        imgs = getattr(ws, '_images', [])
        print(f"  imagens na planilha: {len(imgs)}")
        for im in imgs:
            try:
                anc = im.anchor
                frm = getattr(anc, '_from', None)
                pos = f"({frm.col},{frm.row})" if frm else "?"
                print(f"    img anchor={type(anc).__name__} from={pos}")
            except Exception as e:
                print("    img err:", e)
        maxr = min(ws.max_row, max_sheet_rows)
        maxc = min(ws.max_column, 22)
        for row in ws.iter_rows(min_row=1, max_row=maxr, max_col=maxc):
            vals = []
            for c in row:
                if c.value is not None:
                    fill = None
                    try:
                        if c.fill and c.fill.fill_type == 'solid':
                            fill = c.fill.start_color.rgb
                    except Exception:
                        pass
                    fs = f" [fill={fill}]" if fill and str(fill) != '00000000' else ""
                    vals.append(f"{c.coordinate}={str(c.value)[:70]!r}{fs}")
            if vals:
                print("    " + " | ".join(vals))

inspect_book("Base_Folha_Liberdade.xlsm")
inspect_book("Base_mala_Liberdade_2026.xlsm")
print("\nFIM DA INSPECAO")
