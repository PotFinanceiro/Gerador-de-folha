#!/usr/bin/env python3
"""Recorta e realça o logo WayCode para o cabeçalho do sistema."""
from PIL import Image, ImageEnhance, ImageChops, ImageOps

SRC = "/home/z/my-project/upload/Gemini_Generated_Image_kgd1x4kgd1x4kgd1.jpg"
DST = "/home/z/my-project/public/waycode-logo.png"

img = Image.open(SRC).convert("RGB")
print("original:", img.size)

# 1) fundo de referência = média dos 4 cantos
w, h = img.size
corners = [img.getpixel(p) for p in [(8, 8), (w - 8, 8), (8, h - 8), (w - 8, h - 8)]]
bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
print("cor de fundo:", bg)

# 2) bounding box do conteúdo (tudo que difere do fundo)
diff = ImageChops.difference(img, Image.new("RGB", img.size, bg))
gray = diff.convert("L").point(lambda v: 255 if v > 18 else 0)
l, t, r, b = gray.getbbox()
print("conteúdo:", (l, t, r, b))

# 3) recorte com folga de 4% e quadrado branco centralizado
pw, ph = r - l, b - t
pad = int(max(pw, ph) * 0.04)
l, t = max(0, l - pad), max(0, t - pad)
r, b = min(w, r + pad), min(h, b + pad)
conteudo = img.crop((l, t, r, b))

lado = max(conteudo.size)
canvas = Image.new("RGB", (lado, lado), (255, 255, 255))
canvas.paste(conteudo, ((lado - conteudo.width) // 2, (lado - conteudo.height) // 2))

# 4) realce: branco puro, contraste e saturação
px = canvas.load()
for y in range(canvas.height):
    for x in range(canvas.width):
        r_, g_, b_ = px[x, y]
        if r_ >= 242 and g_ >= 242 and b_ >= 242:
            px[x, y] = (255, 255, 255)

canvas = ImageEnhance.Contrast(canvas).enhance(1.18)
canvas = ImageEnhance.Color(canvas).enhance(1.45)
canvas = ImageEnhance.Contrast(canvas).enhance(1.05)

# 5) tamanho final confortável (448px = nítido em telas retina)
canvas = ImageOps.pad(canvas, (448, 448), method=Image.LANCZOS, color=(255, 255, 255))
canvas.save(DST, "PNG", optimize=True)
print("salvo:", DST, canvas.size)
