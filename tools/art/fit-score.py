"""Classe des candidats PixelLab selon leur place dans la forme de l'objet (32 px par case).

Usage : python3 tools/art/fit-score.py <shapes.json> <defId> <candidat.png>...
Score = part des pixels opaques déjà dans la forme × part des cases de la forme qui ont du dessin.
"""
import json
import sys

from PIL import Image

CELL = 32


def score(path: str, shape: list[str]) -> tuple[float, float, float]:
    im = Image.open(path).convert('RGBA')
    w, h = len(shape[0]) * CELL, len(shape) * CELL
    if im.size != (w, h):
        im = im.resize((w, h), Image.NEAREST)
    px = im.load()
    inside = outside = 0
    cells: dict[tuple[int, int], int] = {}
    for y in range(h):
        for x in range(w):
            if px[x, y][3] < 128:
                continue
            c = (x // CELL, y // CELL)
            if shape[c[1]][c[0]] == 'X':
                inside += 1
                cells[c] = cells.get(c, 0) + 1
            else:
                outside += 1
    total = inside + outside or 1
    want = [(x, y) for y, row in enumerate(shape) for x, ch in enumerate(row) if ch == 'X']
    covered = sum(1 for c in want if cells.get(c, 0) >= 40) / len(want)
    keep = inside / total
    return keep * covered, keep, covered


if __name__ == '__main__':
    shapes = json.load(open(sys.argv[1]))
    shape = shapes[sys.argv[2]]
    rows = sorted(((score(p, shape), p) for p in sys.argv[3:]), reverse=True)
    for (s, k, c), p in rows:
        print(f'{s:.3f}  garde {k:.0%}  cases {c:.0%}  {p}')
