"""Recale un sprite PixelLab dans la forme de son objet : translation seule (pas de mise à l'échelle,
pour garder la taille des pixels identique entre tous les sprites), puis découpe au masque.

Usage : python3 tools/art/fit-place.py <shapes.json> <defId> <entrée.png> <sortie.png>
Critère : chaque case de la forme doit contenir du dessin ; parmi ces positions, on garde celle qui perd
le moins de pixels hors de la forme.
"""
import json
import sys

from PIL import Image

CELL = 32


def best_place(im: Image.Image, shape: list[str]) -> tuple[Image.Image, float, float]:
    w, h = len(shape[0]) * CELL, len(shape) * CELL
    a = im.getchannel('A')
    box = a.getbbox()
    if not box:
        return Image.new('RGBA', (w, h)), 0, 0
    spr = im.crop(box)
    sw, sh = spr.size
    pts = [(x, y) for y in range(sh) for x in range(sw) if spr.getpixel((x, y))[3] >= 128]
    want = [(x, y) for y, row in enumerate(shape) for x, c in enumerate(row) if c == 'X']
    best = None
    for oy in range(min(0, h - sh), max(0, h - sh) + 1):
        for ox in range(min(0, w - sw), max(0, w - sw) + 1):
            inside = 0
            per = {}
            for x, y in pts:
                X, Y = x + ox, y + oy
                if 0 <= X < w and 0 <= Y < h and shape[Y // CELL][X // CELL] == 'X':
                    inside += 1
                    k = (X // CELL, Y // CELL)
                    per[k] = per.get(k, 0) + 1
            covered = sum(1 for c in want if per.get(c, 0) >= 30) / len(want)
            keep = inside / len(pts)
            # Centrage léger : à score égal, préférer le dessin centré dans la forme.
            key = (covered, keep, -abs(ox - (w - sw) / 2) - abs(oy - (h - sh) / 2))
            if best is None or key > best[0]:
                best = (key, ox, oy)
    (covered, keep, _), ox, oy = best
    out = Image.new('RGBA', (w, h))
    out.paste(spr, (ox, oy), spr)
    px = out.load()
    for y in range(h):
        for x in range(w):
            if shape[y // CELL][x // CELL] != 'X':
                px[x, y] = (0, 0, 0, 0)
    return out, keep, covered


if __name__ == '__main__':
    shapes = json.load(open(sys.argv[1]))
    out, keep, covered = best_place(Image.open(sys.argv[3]).convert('RGBA'), shapes[sys.argv[2]])
    out.save(sys.argv[4])
    print(f'{sys.argv[2]:16} garde {keep:.0%}  cases {covered:.0%}')
