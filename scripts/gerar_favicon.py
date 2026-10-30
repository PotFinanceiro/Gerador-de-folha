#!/usr/bin/env python3
"""Gera o favicon a partir da marca gráfica do logo WayCode."""
from PIL import Image, ImageChops

SRC = "/home/z/my-project/public/waycode-logo.png"
DST = "/home/z/my-project/src/app/icon.png"

img = Image.open(SRC).convert("RGB")
w, h = img.size

# 1) usa só a parte gráfica (superior ~55%, sem os textos)
topo = img.crop((0, 0, w, int(h * 0.55)))

# 2) recorta o conteúdo da parte gráfica (remove fundo branco excedente)
bg = topo.getpixel((4, 4))
diff = ImageChops.difference(topo, Image.new("RGB", topo.size, bg))
l, t, r, b = diff.convert("L").point(lambda v: 255 if v > 15 else 0).getbbox()
marca = topo.crop((l, t, r, b))

# 3) quadrado branco com folga de 8%
lado = int(max(marca.size) * 1.16)
canvas = Image.new("RGB", (lado, lado), (255, 255, 255))
canvas.paste(marca, ((lado - marca.width) // 2, (lado - marca.height) // 2))

# 4) tamanho para favicon (Next usa icon.png como base)
canvas.resize((256, 256), Image.LANCZOS).save(DST, "PNG", optimize=True)
print("favicon salvo:", DST)
