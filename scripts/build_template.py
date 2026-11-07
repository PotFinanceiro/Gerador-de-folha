#!/usr/bin/env python3
"""
Cirurgia no template: substitui o objeto OLE (tabela Excel embutida) por uma
tabela Word nativa com aparência idêntica, gerando template_folha.docx.
Métricas medidas do render original @150dpi:
  - tabela: x de 1.253 a 19.490cm (largura 18.237cm), indent -567 twips
  - header: 8.043 -> 8.467cm (0.424cm = 240 twips)
  - corpo: 31 linhas de 0.5326cm (15.12pt = 302 twips)
  - colunas: 1.880 / 3.268 / 2.972 / 10.117 cm
  - header preto (000000) texto branco; folgas cinza (BFBFBF)
"""
import zipfile, re, os, shutil

BASE = "/home/z/my-project"
SRC = f"{BASE}/upload/Base folha de ponto_Zeladoria_Liberdade.docx"
OUT = f"{BASE}/python/template_folha.docx"
os.makedirs(f"{BASE}/python", exist_ok=True)

CM2TW = 567.0  # twips por cm (aprox: 1440 twips/inch / 2.54)

def tw(cm):
    return str(int(round(cm * CM2TW)))

# ---------- dados de calibracao (outubro/2026 igual ao original) ----------
import calendar, datetime
DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
FOLGAS = {1, 2}  # Seg, Ter
MES, ANO = 10, 2026
CURSO_IDX = 4  # quinta-feira
ultimo = calendar.monthrange(ANO, MES)[1]

rows_data = []  # (dia, diase semana, apontamento, folga_bool)
for i in range(1, ultimo + 1):
    d = datetime.date(ANO, MES, i)
    dn = DIAS[(d.weekday() + 1) % 7]
    folga = dn[:3] in {DIAS[f] for f in FOLGAS}
    rows_data.append((str(i), dn, 'Folga' if folga else ('Curso' if (d.weekday() + 1) % 7 == CURSO_IDX else ''), folga))
# completar ate 31 linhas com vazias (como no original)
while len(rows_data) < 31:
    rows_data.append(('', '', '', False))

# mesclagens semanais da coluna ASSINATURA (terminam nos domingos)
merges = []  # (start_row, end_row) 1-based dentro das linhas de dia
start = 1
for i in range(1, 32):
    dia_idx = i
    if dia_idx <= ultimo:
        d = datetime.date(ANO, MES, dia_idx)
        is_sun = d.weekday() == 6
    else:
        is_sun = False
    if is_sun and dia_idx != 31:
        merges.append((start, dia_idx))
        start = dia_idx + 1
merges.append((start, 31))
print("Blocos de assinatura (dias):", merges)

# ---------- construir XML da tabela ----------
COLW = [1.880, 3.268, 2.972, 10.117]
BORDER = '<w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/>' \
         '<w:left w:val="single" w:sz="6" w:space="0" w:color="000000"/>' \
         '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>' \
         '<w:right w:val="single" w:sz="6" w:space="0" w:color="000000"/>' \
         '<w:insideH w:val="single" w:sz="6" w:space="0" w:color="000000"/>' \
         '<w:insideV w:val="single" w:sz="6" w:space="0" w:color="000000"/>'

def cell(text, width_cm, *, shd=None, color='000000', size=20, bold=False, vmerge=None, valign='center'):
    """vmerge: None | 'restart' | 'continue'"""
    tcpr = [f'<w:tcW w:w="{tw(width_cm)}" w:type="dxa"/>']
    if vmerge == 'restart':
        tcpr.append('<w:vMerge w:val="restart"/>')
    elif vmerge == 'continue':
        tcpr.append('<w:vMerge/>')
    if shd:
        tcpr.append(f'<w:shd w:val="clear" w:color="auto" w:fill="{shd}"/>')
    tcpr.append(f'<w:vAlign w:val="{valign}"/>')
    rpr = f'<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="{color}"/>' \
          f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/></w:rPr>'
    if bold:
        rpr = rpr.replace('<w:color', '<w:b/><w:color')
    txt = f'<w:t xml:space="preserve">{text}</w:t>' if text else ''
    p = f'<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>' \
        f'<w:jc w:val="center"/>{rpr}</w:pPr>' \
        + (f'<w:r>{rpr}{txt}</w:r>' if text else '') + '</w:p>'
    tc = f'<w:tc><w:tcPr>{"".join(tcpr)}</w:tcPr>{p}</w:tc>'
    return tc

xml_rows = []
# header
hdr = ['DIA', 'DIA DA SEMANA', 'APONTAMENTO', 'ASSINATURA']
cells = ''.join(cell(t, COLW[i], shd='000000', color='FFFFFF', size=18) for i, t in enumerate(hdr))
xml_rows.append(f'<w:tr><w:trPr><w:trHeight w:val="240" w:hRule="exact"/></w:trPr>{cells}</w:tr>')

# corpo
for idx, (dia, ds, ap, folga) in enumerate(rows_data, start=1):
    fill = 'BFBFBF' if folga else None
    c1 = cell(dia, COLW[0], shd=fill, size=20)
    c2 = cell(ds, COLW[1], shd=fill, size=20)
    c3 = cell(ap, COLW[2], shd=fill, size=22)  # Folga 11pt
    # assinatura: mesclagem semanal
    vm = None
    for (a, b) in merges:
        if idx == a:
            vm = 'restart'
            break
        if a < idx <= b:
            vm = 'continue'
            break
    c4 = cell('', COLW[3], vmerge=vm)
    xml_rows.append(f'<w:tr><w:trPr><w:trHeight w:val="302" w:hRule="exact"/></w:trPr>{c1}{c2}{c3}{c4}</w:tr>')

tblpr = (f'<w:tblPr><w:tblW w:w="{tw(sum(COLW))}" w:type="dxa"/>'
         f'<w:tblInd w:w="-567" w:type="dxa"/>'
         f'<w:tblBorders>{BORDER}</w:tblBorders>'
         f'<w:tblLayout w:type="fixed"/>'
         f'<w:tblCellMar><w:left w:w="15" w:type="dxa"/><w:right w:w="15" w:type="dxa"/></w:tblCellMar>'
         f'</w:tblPr>')
grid = ''.join(f'<w:gridCol w:w="{tw(w)}"/>' for w in COLW)
tbl = f'<w:tbl>{tblpr}<w:tblGrid>{grid}</w:tblGrid>{"".join(xml_rows)}</w:tbl>'

# ---------- linha artefato (area vazia do OLE abaixo da tabela) ----------
# no original, o objeto OLE ia ate ~25.9cm; replica-se uma linha final mesclada
# com bordas sutis e altura exata, mais um espacador para posicionar as assinaturas
ARTEF_H = 0.91   # altura da linha artefato (cm)
ESPACO_P9 = 0.435  # espacador depois da tabela (cm) — ajustado por medicao
light = '<w:top w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>' \
        '<w:left w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>' \
        '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>' \
        '<w:right w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>'
art_row = (f'<w:tr><w:trPr><w:trHeight w:val="{tw(ARTEF_H)}" w:hRule="exact"/></w:trPr>'
           f'<w:tc><w:tcPr><w:tcW w:w="{tw(sum(COLW))}" w:type="dxa"/><w:gridSpan w:val="4"/>'
           f'<w:tcBorders>{light}</w:tcBorders><w:vAlign w:val="top"/></w:tcPr>'
           '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="14" w:lineRule="exact"/>'
           '<w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p></w:tc></w:tr>')
xml_rows.append(art_row)
spacer = (f'<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="{tw(ESPACO_P9)}" '
          'w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p>')
# reconstruir a tabela incluindo a linha artefato
tbl = f'<w:tbl>{tblpr}<w:tblGrid>{grid}</w:tblGrid>{"".join(xml_rows)}</w:tbl>' + spacer

# ---------- cirurgia no document.xml ----------
zin = zipfile.ZipFile(SRC)
xml = zin.read('word/document.xml').decode('utf-8')

i = xml.find('<w:object')
assert i > 0, 'objeto OLE nao encontrado'
pstart = max(xml.rfind('<w:p ', 0, i), xml.rfind('<w:p>', 0, i))
pend = xml.find('</w:p>', i) + len('</w:p>')
par = xml[pstart:pend]
assert '<w:object' in par and '<w:ind w:left="-567"/>' in par

# paragrafo minimizado (linha de 0.7pt) + tabela depois dele
mini_par = ('<w:p w14:paraId="75BCEB2F" w14:textId="4D8D793F" w:rsidR="00AE7653" w:rsidRPr="00853129" '
            'w:rsidRDefault="0088448F" w:rsidP="00786989"><w:pPr>'
            '<w:spacing w:before="0" w:after="0" w:line="14" w:lineRule="exact"/>'
            '<w:ind w:left="-567"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p>')

new_xml = xml[:pstart] + mini_par + tbl + xml[pend:]

# salvar novo docx
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as zout:
    for item in zin.namelist():
        data = zin.read(item)
        if item == 'word/document.xml':
            data = new_xml.encode('utf-8')
        zout.writestr(item, data)
print("Template criado:", OUT)

# validar com python-docx
from docx import Document
d = Document(OUT)
print("Paragrafos:", len(d.paragraphs), "| Tabelas:", len(d.tables))
t = d.tables[0]
print(f"Tabela: {len(t.rows)}x{len(t.columns)} | R0: {[c.text for c in t.rows[0].cells]}")
print(f"R1: {[c.text for c in t.rows[1].cells]} | R6 (dia5): {[c.text for c in t.rows[6].cells]}")
