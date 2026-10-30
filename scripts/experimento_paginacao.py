#!/usr/bin/env python3
"""Experimento de paginação: 3 formas de separar cartas no lote."""
import re, subprocess, zipfile, os
import sys
sys.path.insert(0, '/home/z/my-project/python')
from gerar_cartas import TEMPLATE, TITULO_CARTA
from pypdf import PdfReader

zin = zipfile.ZipFile(TEMPLATE)
xml = zin.read('word/document.xml').decode('utf-8')
m = re.search(r'(<w:body>)(.*)(<w:sectPr)', xml, re.DOTALL)
body, sect = m.group(2), xml[m.end(2):]
sectpr = '<w:sectPr' + sect[len('<w:sectPr'):] if sect.startswith('<w:sectPr') else sect

TINY = ('<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="14" w:lineRule="exact"/>'
        '<w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr>' + sectpr + '</w:pPr></w:p>')

def montar(nome, partes):
    novo = xml[:m.start(2)] + ''.join(partes) + xml[m.end(2):]
    with zipfile.ZipFile(f'/tmp/diag/{nome}.docx', 'w', zipfile.ZIP_DEFLATED) as z:
        for it in zin.namelist():
            z.writestr(it, novo.encode() if it == 'word/document.xml' else zin.read(it))

def paginar(nome):
    subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', '/tmp/diag',
                    f'/tmp/diag/{nome}.docx'], check=True, capture_output=True, timeout=300,
                   env={**os.environ, 'HOME': '/tmp'})
    r = PdfReader(f'/tmp/diag/{nome}.pdf')
    res = []
    for i, p in enumerate(r.pages, 1):
        t = (p.extract_text() or '').strip().replace('\n', ' ')
        res.append(f"p{i}: {'TÍTULO' if TITULO_CARTA in t else ('vazia' if not t else t[:28])}")
    print(f'{nome}: {len(r.pages)} págs | ' + ' | '.join(res))

# v1: sem quebra alguma
montar('v1_sem', [body, body])
# v2: quebra no último parágrafo (com_quebra atual)
def com_quebra(c):
    i = c.rfind('</w:p>')
    return c[:i] + '<w:r><w:br w:type="page"/></w:r>' + c[i:]
montar('v2_br', [com_quebra(body), body])
# v3: parágrafo minúsculo com sectPr (quebra de seção) substituindo o último parágrafo
def com_secao(c):
    i = c.rfind('<w:p ')
    if i == -1: i = c.rfind('<w:p>')
    return c[:i] + TINY
montar('v3_sect', [com_secao(body), body])

for v in ('v1_sem', 'v2_br', 'v3_sect'):
    paginar(v)
