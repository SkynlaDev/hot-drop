"""Mode zombie, personnage en couches : corps sans arme + arme en main + main avant par-dessus.

Usage : python3 tools/art/layer-weapons.py <dossier des tirages PixelLab> <racine du dépôt>

Le dossier contient, par posture (`long` : arme d'épaule, `poing` : arme de poing) :
  body-<posture>.png          pose fixe (64 × 64, sans arme)
  walk-<posture>/0..8.png     marche (animate_image : 0 = pose d'entrée, 1..8 = images générées)
  die-<posture>/0..8.png      chute (0 = pose debout)

Sorties :
  public/art/zombie/couches/viper-<posture>.png         pose fixe
  public/art/zombie/couches/viper-<posture>-walk.png    8 images
  public/art/zombie/couches/viper-<posture>-die.png     9 images
  public/art/zombie/couches/viper-<posture>-main.png    9 images : main avant seule (0 = pose fixe, 1..8 = marche)
  public/art/zombie/couches/arme-<arme>.png             arme à l'échelle du personnage (contour, reflet)
  src/zombie/layersData.ts                              positions de la main par image, prise et bouche des armes

La main est suivie d'image en image par comparaison de motif (la main de la pose fixe, cherchée à ±6 px).
"""
import json
import sys
from pathlib import Path

from PIL import Image

SIZE = 64
# Boîte de la main avant dans la pose fixe (x0, y0, x1, y1 exclus), mesurée sur les tirages.
HAND = {'long': (38, 28, 46, 34), 'poing': (44, 18, 50, 24)}
# Armes du prototype : posture, largeur à l'échelle du personnage (sans contour), et position de l'arme dans la
# pose fixe (coin haut-gauche, contour compris) : la prise se déduit de la main.
WEAPONS = {
    'fusil_assaut': {'posture': 'long', 'width': 22, 'at': (31, 24)},
    'pistolet': {'posture': 'poing', 'width': 11, 'at': (45, 14)},
}
SEARCH = 6
# Postures où la marche générée bouge trop les mains (l'arme sauterait) : le haut du corps reste celui de la pose
# fixe, posé sur les jambes de la marche et décalé comme la tête (suivie de la même façon que la main).
RIGID = {'long': 37}
HEAD = (22, 1, 42, 14)


def load(p: Path) -> Image.Image:
    return Image.open(p).convert('RGBA')


def diff(a, b) -> int:
    if (a[3] >= 128) != (b[3] >= 128):
        return 300
    if a[3] < 128:
        return 0
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def track(ref: Image.Image, box, frame: Image.Image) -> tuple[int, int]:
    """Décalage (dx, dy) de la main de `ref` (boîte `box`) dans `frame`."""
    x0, y0, x1, y1 = box
    rp, fp = ref.load(), frame.load()
    best = None
    for dy in range(-SEARCH, SEARCH + 1):
        for dx in range(-SEARCH, SEARCH + 1):
            s = 0
            for y in range(y0, y1):
                for x in range(x0, x1):
                    X, Y = x + dx, y + dy
                    b = fp[X, Y] if 0 <= X < SIZE and 0 <= Y < SIZE else (0, 0, 0, 0)
                    s += diff(rp[x, y], b)
            # À score égal, le plus petit déplacement.
            key = (s, abs(dx) + abs(dy))
            if best is None or key < best[0]:
                best = (key, dx, dy)
    return best[1], best[2]


def hand_only(frame: Image.Image, box, d) -> Image.Image:
    x0, y0, x1, y1 = box
    out = Image.new('RGBA', (SIZE, SIZE))
    bx = (x0 + d[0], y0 + d[1], x1 + d[0], y1 + d[1])
    out.alpha_composite(frame.crop(bx), (bx[0], bx[1]))
    return out


def strip(frames: list[Image.Image]) -> Image.Image:
    out = Image.new('RGBA', (SIZE * len(frames), SIZE))
    for i, f in enumerate(frames):
        out.alpha_composite(f, (i * SIZE, 0))
    return out


def small_weapon(src: Path, w: int) -> Image.Image:
    """Réduction de l'arme entière (moyenne par zone, seuil d'opacité), puis contour sombre et reflet en haut."""
    im = load(src)
    h = round(im.height * w / im.width)
    r = im.resize((w, h), Image.BOX)
    px = r.load()
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            px[x, y] = (p[0], p[1], p[2], 255) if p[3] >= 110 else (0, 0, 0, 0)
    o = Image.new('RGBA', (w + 2, h + 2))
    o.alpha_composite(r, (1, 1))
    s, q = o.copy().load(), o.load()
    for y in range(h + 2):
        for x in range(w + 2):
            if s[x, y][3]:
                if y > 0 and not s[x, y - 1][3]:
                    q[x, y] = tuple(min(255, v + 70) for v in s[x, y][:3]) + (255,)
                continue
            if any(0 <= x + dx < w + 2 and 0 <= y + dy < h + 2 and s[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                q[x, y] = (14, 11, 18, 255)
    return o


def muzzle(im: Image.Image) -> tuple[int, int]:
    """Bout du canon : pixel opaque le plus à droite (le plus haut s'il y en a plusieurs)."""
    px = im.load()
    for x in range(im.width - 1, -1, -1):
        for y in range(im.height):
            if px[x, y][3]:
                return x, y
    return im.width - 1, im.height // 2


def main():
    raw, root = Path(sys.argv[1]), Path(sys.argv[2])
    out = root / 'public/art/zombie/couches'
    out.mkdir(parents=True, exist_ok=True)
    data = {'postures': {}, 'weapons': {}}
    for posture, box in HAND.items():
        body = load(raw / f'body-{posture}.png')
        walk = [load(raw / f'walk-{posture}/{i}.png') for i in range(1, 9)]
        die = [load(raw / f'die-{posture}/{i}.png') for i in range(9)]
        body.save(out / f'viper-{posture}.png')
        strip(walk).save(out / f'viper-{posture}-walk.png')
        strip(die).save(out / f'viper-{posture}-die.png')
        if posture in RIGID:
            cut = RIGID[posture]
            moved = []
            for f in walk:
                d = track(body, HEAD, f)
                c = Image.new('RGBA', (SIZE, SIZE))
                c.alpha_composite(f.crop((0, cut - 1, SIZE, SIZE)), (0, cut - 1))
                c.alpha_composite(body.crop((0, 0, SIZE, cut)), d)
                moved.append((c, d))
            walk = [c for c, _ in moved]
            offs = [(0, 0)] + [d for _, d in moved]
            strip(walk).save(out / f'viper-{posture}-walk.png')
        else:
            offs = [(0, 0)] + [track(body, box, f) for f in walk]
        strip([hand_only(body, box, (0, 0))] + [hand_only(f, box, d) for f, d in zip(walk, offs[1:])]).save(out / f'viper-{posture}-main.png')
        data['postures'][posture] = {'hand': [box[0], box[1]], 'offsets': [list(o) for o in offs]}
        print(posture, 'décalages de la main :', offs)
    for wid, w in WEAPONS.items():
        im = small_weapon(root / f'public/art/zombie/armes/{wid}.png', w['width'])
        im.save(out / f'arme-{wid}.png')
        hx, hy = HAND[w['posture']][:2]
        data['weapons'][wid] = {
            'posture': w['posture'],
            # Prise : point de l'arme posé sur le coin de la boîte de la main.
            'grip': [hx - w['at'][0], hy - w['at'][1]],
            'muzzle': list(muzzle(im)),
            'size': [im.width, im.height],
        }
    ts = root / 'src/zombie/layersData.ts'
    ts.write_text(
        '// Généré par tools/art/layer-weapons.py : ne pas modifier à la main.\n'
        '// Postures : coin de la boîte de la main avant dans la pose fixe, puis son décalage par image\n'
        '// (0 = pose fixe, 1..8 = marche). Armes : prise (point posé sur ce coin) et bouche, en px de l\'arme.\n'
        f'export const LAYERS = {json.dumps(data, indent=2, ensure_ascii=False)} as const;\n'
    )


if __name__ == '__main__':
    main()
