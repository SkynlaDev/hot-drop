"""Découpe les sprites PixelLab des objets au masque de leur forme (32 px par case).

Usage : python3 tools/art/clip-items.py <dossier des PNG bruts> <shapes.json> <dossier de sortie>
shapes.json : { "<defId>": ["XX", "X."], ... } (formes de src/data/items.ts).
"""
import json
import sys
from pathlib import Path

from PIL import Image

CELL = 32


def clip(src: Path, shape: list[str], dst: Path) -> int:
    im = Image.open(src).convert('RGBA')
    w, h = len(shape[0]) * CELL, len(shape) * CELL
    if im.size != (w, h):
        im = im.resize((w, h), Image.NEAREST)
    cut = 0
    px = im.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and shape[y // CELL][x // CELL] != 'X':
                px[x, y] = (0, 0, 0, 0)
                cut += 1
    im.save(dst)
    return cut


if __name__ == '__main__':
    raw, shapes_file, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    shapes = json.loads(shapes_file.read_text())
    out.mkdir(parents=True, exist_ok=True)
    for f in sorted(raw.glob('*.png')):
        n = clip(f, shapes[f.stem], out / f.name)
        print(f'{f.stem:16} {n:4} px hors forme')
