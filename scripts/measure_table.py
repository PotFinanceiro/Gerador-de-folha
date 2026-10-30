#!/usr/bin/env python3
"""Mede com precisão a tabela no render do modelo original (150 dpi)."""
import subprocess, os
from PIL import Image

BASE = "/home/z/my-project"
PDF = f"{BASE}/scripts/preview/modelo.pdf"
OUT = f"{BASE}/scripts/measure"
os.makedirs(OUT, exist_ok=True)

# render 150 dpi
subprocess.run(['pdftoppm', '-png', '-r', '150', '-singlefile', PDF, f"{OUT}/m150"], check=True)
im = Image.open(f"{OUT}/m150.png").convert('RGB')
W, H = im.size
px = im.load()
DPI = 150
CM = DPI / 2.54  # px por cm

def x2cm(x): return x / CM
def y2cm(y): return y / CM

print(f"Imagem: {W}x{H}px  (página 21x29.7cm, {CM:.2f}px/cm)")

# 1) linhas horizontais escuras: linhas com muitos pixels escuros consecutivos
def is_dark(p): return p[0] < 100 and p[1] < 100 and p[2] < 100

hlines = []
for y in range(H):
    cnt = 0
    best = 0
    for x in range(int(2*CM), W - int(1.5*CM)):
        if is_dark(px[x, y]):
            cnt += 1
            best = max(best, cnt)
        else:
            cnt = 0
    hlines.append(best)

# linha horizontal "de tabela" = corrida longa (>8cm)
cand = [y for y in range(H) if hlines[y] > 8 * CM]
# agrupar consecutivas
groups = []
for y in cand:
    if groups and y - groups[-1][-1] <= 2:
        groups[-1].append(y)
    else:
        groups.append([y])
hl = [g[0] for g in groups]
print(f"\nLinhas horizontais longas ({len(hl)}):")
for y in hl:
    print(f"  y={y}px = {y2cm(y):.3f}cm")

# 2) linhas verticais: nas linhas horizontais vizinhas, scan colunas escuras
if len(hl) > 2:
    y0, y1 = hl[0], hl[-1]
    ys = [y for y in range(y0, min(y1 + 1, H), 3)]
    vcount = {}
    for x in range(W):
        dark = sum(1 for y in ys if is_dark(px[x, y]))
        if dark > len(ys) * 0.55:
            vcount[x] = dark
    # agrupar colunas adjacentes
    xs = sorted(vcount)
    vg = []
    for x in xs:
        if vg and x - vg[-1][-1] <= 2:
            vg[-1].append(x)
        else:
            vg.append([x])
    vl = [sum(g) / len(g) for g in vg]
    print(f"\nLinhas verticais ({len(vl)}):")
    for x in vl:
        print(f"  x={x:.1f}px = {x2cm(x):.3f}cm")
    print("\nLarguras de coluna (cm):")
    for a, b in zip(vl, vl[1:]):
        print(f"  {x2cm(b) - x2cm(a):.3f}")

# 3) linhas cinza (BFBFBF) — folgas: examinar cor na coluna do meio da 1a coluna
print("\nLinhas com preenchimento cinza (amostra x=col1):")
xc = int(2.0 * CM)
runs = []
prev = False
for y in range(int(8 * CM), int(27 * CM)):
    p = px[xc, y]
    gray = abs(p[0] - 191) < 25 and abs(p[1] - 191) < 25 and abs(p[2] - 191) < 25
    if gray and not prev:
        runs.append([y, y])
    elif gray:
        runs[-1][1] = y
    prev = gray
for a, b in runs:
    if b - a > 5:
        print(f"  faixa y={a}-{b} ({y2cm(a):.2f}-{y2cm(b):.2f}cm) altura={(b-a)/CM:.3f}cm")
