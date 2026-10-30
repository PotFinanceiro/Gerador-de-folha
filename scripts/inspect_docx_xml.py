#!/usr/bin/env python3
"""Análise profunda do XML do docx: caixas de texto, objetos embutidos, tabelas."""
import zipfile, re, os

path = "/home/z/my-project/upload/Base folha de ponto_Zeladoria_Liberdade.docx"
z = zipfile.ZipFile(path)

print("== TODOS OS ARQUIVOS DO PACOTE ==")
for n in z.namelist():
    print(f"  {n} ({z.getinfo(n).file_size})")

xml = z.read('word/document.xml').decode('utf-8')

print("\n== CONTAGENS ==")
print("  w:tbl (tabelas):", xml.count('<w:tbl>'))
print("  w:txbxContent (caixa de texto):", xml.count('<w:txbxContent>'))
print("  o:OLEObject:", xml.count('OLEObject'))
print("  w:object:", xml.count('<w:object'))
print("  mc:AlternateContent:", xml.count('<mc:AlternateContent>'))
print("  w:drawing:", xml.count('<w:drawing>'))
print("  w:pict:", xml.count('<w:pict>'))

# embeddings
for n in z.namelist():
    if 'embed' in n.lower():
        print("\n  EMBEDDING:", n, z.getinfo(n).file_size)

# Extrair caixas de texto e ver conteúdo
print("\n== CONTEUDO DAS CAIXAS DE TEXTO (resumo) ==")
for i, m in enumerate(re.finditer(r'<w:txbxContent>(.*?)</w:txbxContent>', xml, re.DOTALL)):
    c = m.group(1)
    texts = re.findall(r'<w:t[^>]*>([^<]*)</w:t>', c)
    ntbl = c.count('<w:tbl>')
    ndraw = c.count('<w:drawing>')
    print(f"  Txbx{i}: tabelas={ntbl} drawings={ndraw} textos={texts[:12]}")

# Estrutura do primeiro drawing anchor (Caixa de Texto 6)
print("\n== PRIMEIRO ANCHOR (estrutura) ==")
a = re.search(r'<wp:anchor.*?</wp:anchor>', xml, re.DOTALL)
if a:
    axml = a.group(0)
    print("  contém txbx:", '<w:txbxContent>' in axml)
    print("  contém pic:pic:", '<pic:pic' in axml)
    # docPr
    dp = re.search(r'<wp:docPr id="(\d+)" name="([^"]*)"', axml)
    if dp: print("  docPr:", dp.groups())
    # position detalhada
    for m in re.finditer(r'<wp:position([HV]) relativeFrom="(\w+)"\s*>\s*<wp:posOffset>(-?\d+)</wp:posOffset>', axml):
        axis, rel, off = m.groups()
        print(f"  pos{axis}: rel={rel} offset={int(off)/360000:.3f}cm")
    for m in re.finditer(r'<wp:align>(\w+)</wp:align>', axml):
        print("  align:", m.group(1))
    ext = re.search(r'<wp:extent cx="(\d+)" cy="(\d+)"', axml)
    if ext:
        print(f"  extent: {int(ext.group(1))/360000:.3f} x {int(ext.group(2))/360000:.3f} cm")
    # se tem texto dentro
    txbx = re.search(r'<w:txbxContent>(.*?)</w:txbxContent>', axml, re.DOTALL)
    if txbx:
        texts = re.findall(r'<w:t[^>]*>([^<]*)</w:t>', txbx.group(1))
        print("  textos dentro da caixa:", texts)
        print("  imagens dentro da caixa:", axml.count('<pic:pic'))

# desenho inline (logos)
print("\n== INLINE DRAWINGS ==")
for i, m in enumerate(re.finditer(r'<wp:inline.*?</wp:inline>', xml, re.DOTALL)):
    d = m.group(0)
    ext = re.search(r'<wp:extent cx="(\d+)" cy="(\d+)"', d)
    blip = re.search(r'r:embed="([^"]+)"', d)
    dp = re.search(r'<wp:docPr id="(\d+)" name="([^"]*)"', d)
    ctx = xml[max(0, m.start()-400):m.start()]
    print(f"  Inline{i}: size={int(ext.group(1))/360000:.2f}x{int(ext.group(2))/360000:.2f}cm embed={blip.group(1) if blip else '?'} docPr={dp.groups() if dp else '?'}")

# rels
print("\n== RELS ==")
rels = z.read('word/_rels/document.xml.rels').decode('utf-8')
for m in re.finditer(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels):
    print(f"  {m.group(1)} -> {m.group(2)}")
