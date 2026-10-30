#!/usr/bin/env python3
"""Verificação detalhada: runs do template, imagens e consistência da base."""
import re
import zipfile
from openpyxl import load_workbook

UP = "/home/z/my-project/upload"

# ---------- 1. runs dos parágrafos-chave ----------
z = zipfile.ZipFile(f"{UP}/CARTA DE BANCO.docx")
xml = z.read("word/document.xml").decode("utf-8")
paras = re.findall(r"<w:p\b.*?</w:p>", xml, re.S)
for i in (11, 12, 13, 14, 23, 26):
    ts = re.findall(r"<w:t[^>]*>(.*?)</w:t>", paras[i], re.S)
    nruns = len(re.findall(r"<w:r\b", paras[i]))
    print(f"[{i:02d}] runs={nruns} ts={ts}")

# imagens: posição + tamanho
for i, p in enumerate(paras):
    if "<a:blip" in p:
        emb = re.findall(r'r:embed="([^"]+)"', p)
        ext = re.findall(r'<wp:extent cx="(\d+)" cy="(\d+)"', p)
        print(f"IMG no para [{i:02d}] embed={emb} extent={ext}")
rels = z.read("word/_rels/document.xml.rels").decode("utf-8")
print("RELS img:", re.findall(r'Id="([^"]+)"[^>]*Target="(media/[^"]+)"', rels))
for n in z.namelist():
    if "media" in n:
        with open("/tmp/" + n.split("/")[-1], "wb") as f:
            f.write(z.read(n))
mail = re.search(r"<w:mailMerge[^>]*>", z.read("word/settings.xml").decode("utf-8"))
print("mailMerge:", mail.group(0) if mail else "não")

# ---------- 2. consistência da base ----------
wb = load_workbook(f"{UP}/Base_carta.xlsm", data_only=True)
ws = wb["Consolidado_dados"]
rows = [r for r in ws.iter_rows(min_row=2, values_only=True) if r[1]]
print(f"\nConsolidado_dados: {len(rows)} beneficiários com nome")
sem_benef = [r[1] for r in rows if r[0] is None]
sem_ag = [r[1] for r in rows if r[3] is None]
sem_nome_ag = [r[1] for r in rows if r[4] is None]
sem_end = [r[1] for r in rows if r[5] is None]
print("sem benefício:", sem_benef, "| sem agência:", sem_ag,
      "| sem nome ag.:", len(sem_nome_ag), "| sem endereço:", len(sem_end))
print("exemplo L2:", rows[0])

ag = wb["LISTA DE AGENCIAS"]
mapa = {r[0]: r for r in ag.iter_rows(min_row=2, values_only=True) if r[0] is not None}
print(f"\nLISTA DE AGENCIAS: {len(mapa)} prefixos")
for prefixo in sorted({r[3] for r in rows if r[3] is not None}):
    m = mapa.get(prefixo)
    print(f"  agência {prefixo}: {'OK -> ' + str(m[1]) + ' | ' + str(m[4]) if m else 'NÃO ESTÁ NA LISTA'}")
