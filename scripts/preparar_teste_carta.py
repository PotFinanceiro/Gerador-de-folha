#!/usr/bin/env python3
"""Prepara base de teste da carta (3 linhas: dup agência via LISTA, nome duplicado, incompleta) e assinatura PNG."""
from PIL import Image, ImageDraw
import openpyxl

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Consolidado_dados"
ws.append(('NÚMERO DO BENEFÍCIO', 'Nome', 'Distrito', 'AGÊNCIA', 'NOME DA AGENCIA', 'Endereço'))
ws.append((408527, 'Maria Aparecida Nascimento da Silva', None, 7036, None, None))          # nome/endereço via LISTA
ws.append((409013, 'Genicassia Ferreira dos Santos', None, 1205, '', ''))                   # idem, tipo str vazio
ws.append((409013, 'Genicassia Ferreira dos Santos', None, 4334, 'TESTE AG', 'R. TESTE, 10 -  - '))  # duplicado
ws.append((411111, 'Sem Dados Completos', None, None, None, None))                          # pulado
ws.append((None, 'Sem Beneficio', None, 7036, 'AG X', 'R. Y, 1 -  - '))                     # pulado
ag = wb.create_sheet("LISTA DE AGENCIAS")
ag.append(('Prefixo', 'Dependência', 'cidade', 'uf', 'endereco', 'cep', 'bairro'))
ag.append((7036, 'CIDADE DUTRA S PAULO', 'SAO PAULO', 'SP', 'AV.SEN.TEOTONIO VILELA,1054 -  - ', '04849120', 'PARELHEIROS'))
ag.append((1205, 'AVENIDA CURSINO SP', 'SAO PAULO', 'SP', 'AVENIDA DO CURSINO,1194 -  - PROXIMO AO FINAL DA AV BOSQUE', '04102000', 'VILA MARIANA'))
wb.save('/tmp/teste_carta.xlsx')

img = Image.new('RGBA', (800, 300), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.line([(60, 200), (280, 80), (420, 190), (620, 90), (740, 160)], fill=(10, 10, 20, 255), width=9, joint='curve')
d.ellipse([(520, 70), (700, 210)], outline=(10, 10, 20, 255), width=7)
img.save('/tmp/assinatura_teste.png')
print('base e assinatura de teste ok')
