"""Mode zombie, personnage en couches : corps sans arme + arme en main + main avant par-dessus, en quatre vues.

Usage : python3 tools/art/layer-weapons.py <dossier des tirages PixelLab> <racine du dépôt>

Vues : `long` et `poing` (de profil, regard à droite ; arme d'épaule ou de poing), `face` (vers le bas de l'écran)
et `dos` (vers le haut). Face et dos servent aux deux sortes d'armes. Le dossier contient, par vue :
  body-<vue>.png          pose fixe (64 × 64, sans arme)
  walk-<vue>/0..8.png     marche (animate_image : 0 = pose d'entrée, 1..8 = images générées)
  die-<vue>/0..8.png      chute (0 = pose debout)

Sorties (public/art/zombie/couches/) :
  viper-<vue>.png, viper-<vue>-walk.png (8 images), viper-<vue>-die.png (9 images)
  viper-<vue>-main.png    9 images : main(s) avant seule(s) (0 = pose fixe, 1..8 = marche) ; pas pour le dos
  arme-<arme>.png         arme à l'échelle du personnage (contour, reflet), canon à droite
  arme-<arme>-face.png    la même, canon vers le bas (quart de tour : pixels intacts)
  arme-<arme>-dos.png     la même, canon vers le haut (dessinée derrière le corps)
et src/zombie/layersData.ts : décalage du point d'ancrage par image, place et bouche de chaque arme par vue.

Le point d'ancrage (la main, ou la tête quand le haut du corps est figé) est suivi d'image en image par
comparaison de motif (±6 px).
"""
import json
import sys
from pathlib import Path

from PIL import Image

SIZE = 64
SEARCH = 6
HEAD = (22, 1, 42, 14)
# Par vue : boîte de la (des) main(s) avant dans la pose fixe (x0, y0, x1, y1 exclus ; None : pas de main par-dessus,
# l'arme est derrière), et ligne de coupe quand le haut du corps est figé (la marche générée bougeait trop les
# mains : le haut reste celui de la pose fixe, posé sur les jambes de la marche et décalé comme la tête).
VIEWS = {
    'long': {'hand': (38, 28, 46, 34), 'rigid': 37},
    'poing': {'hand': (44, 18, 50, 24), 'rigid': None},
    'face': {'hand': (22, 28, 42, 34), 'rigid': 37},
    'dos': {'hand': None, 'rigid': None},
}
# Où tombe la prise de l'arme dans les vues de face et de dos (px du corps, pose fixe).
GRIP_FACE = (32, 31)
GRIP_DOS = (40, 24)
# Armes : vue de profil, largeur à l'échelle du personnage (sans contour, ≈ 0,175 × le sprite entier), et position
# de l'arme dans la pose fixe de profil (coin haut-gauche, contour compris) ; la prise est le coin de la boîte de la
# main. Sans `at` : la prise est placée comme celle du fusil d'assaut (armes d'épaule) ou du pistolet (de poing),
# en proportion de la taille de l'arme.
WEAPONS = {
    'fusil_assaut': {'posture': 'long', 'width': 22, 'at': (31, 24)},
    'pistolet': {'posture': 'poing', 'width': 11, 'at': (45, 14)},
    'smg': {'posture': 'long', 'width': 15},
    'pompe': {'posture': 'long', 'width': 18},
    'precision': {'posture': 'long', 'width': 27},
    'kr4_mitrailleur': {'posture': 'long', 'width': 28},
    'revolver': {'posture': 'poing', 'width': 13},
}
# Prise de référence, en part de la taille de l'arme (contour compris) : fusil d'assaut (24 × 10) et pistolet (13 × 12).
GRIP_RATIO = {'long': (7 / 24, 4 / 10), 'poing': (-1 / 13, 4 / 12)}


def load(p: Path) -> Image.Image:
    return Image.open(p).convert('RGBA')


def diff(a, b) -> int:
    if (a[3] >= 128) != (b[3] >= 128):
        return 300
    if a[3] < 128:
        return 0
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def track(ref: Image.Image, box, frame: Image.Image) -> tuple[int, int]:
    """Décalage (dx, dy) du motif `box` de `ref` dans `frame`."""
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
            key = (s, abs(dx) + abs(dy))
            if best is None or key < best[0]:
                best = (key, dx, dy)
    return best[1], best[2]


def crop_at(frame: Image.Image, box, d) -> Image.Image:
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


def muzzle(im: Image.Image, toward: str) -> tuple[int, int]:
    """Bout du canon : pixel opaque le plus à droite (profil), le plus bas (face) ou le plus haut (dos)."""
    px = im.load()
    pts = [(x, y) for y in range(im.height) for x in range(im.width) if px[x, y][3]]
    if toward == 'right':
        return max(pts, key=lambda p: (p[0], -p[1]))
    if toward == 'down':
        return max(pts, key=lambda p: (p[1], p[0]))
    return min(pts, key=lambda p: (p[1], -p[0]))


def main():
    raw, root = Path(sys.argv[1]), Path(sys.argv[2])
    out = root / 'public/art/zombie/couches'
    out.mkdir(parents=True, exist_ok=True)
    data = {'views': {}, 'weapons': {}}
    for view, cfg in VIEWS.items():
        body = load(raw / f'body-{view}.png')
        walk = [load(raw / f'walk-{view}/{i}.png') for i in range(1, 9)]
        die = [load(raw / f'die-{view}/{i}.png') for i in range(9)]
        box = cfg['hand']
        if cfg['rigid']:
            cut = cfg['rigid']
            moved = []
            for f in walk:
                d = track(body, HEAD, f)
                c = Image.new('RGBA', (SIZE, SIZE))
                c.alpha_composite(f.crop((0, cut - 1, SIZE, SIZE)), (0, cut - 1))
                c.alpha_composite(body.crop((0, 0, SIZE, cut)), d)
                moved.append((c, d))
            walk = [c for c, _ in moved]
            offs = [(0, 0)] + [d for _, d in moved]
        elif box:
            offs = [(0, 0)] + [track(body, box, f) for f in walk]
        else:
            offs = [(0, 0)] + [track(body, HEAD, f) for f in walk]
        body.save(out / f'viper-{view}.png')
        strip(walk).save(out / f'viper-{view}-walk.png')
        strip(die).save(out / f'viper-{view}-die.png')
        if box:
            strip([crop_at(body, box, (0, 0))] + [crop_at(f, box, d) for f, d in zip(walk, offs[1:])]).save(out / f'viper-{view}-main.png')
        data['views'][view] = {'offsets': [list(o) for o in offs], 'hands': box is not None}
        print(view, 'décalages :', offs)
    for wid, w in WEAPONS.items():
        side = small_weapon(root / f'public/art/zombie/armes/{wid}.png', w['width'])
        hx, hy = VIEWS[w['posture']]['hand'][:2]
        W, H = side.size
        if 'at' in w:
            at = w['at']
        else:
            rx, ry = GRIP_RATIO[w['posture']]
            at = (hx - round(rx * W), hy - round(ry * H))
        grip = (hx - at[0], hy - at[1])
        face = side.transpose(Image.ROTATE_270)  # canon vers le bas : (x, y) -> (H-1-y, x)
        dos = side.transpose(Image.ROTATE_90)  # canon vers le haut : (x, y) -> (y, W-1-x)
        gf = (H - 1 - grip[1], grip[0])
        gd = (grip[1], W - 1 - grip[0])
        side.save(out / f'arme-{wid}.png')
        face.save(out / f'arme-{wid}-face.png')
        dos.save(out / f'arme-{wid}-dos.png')
        data['weapons'][wid] = {
            'posture': w['posture'],
            # Par vue : coin haut-gauche de l'arme dans la pose fixe (px du corps), taille, bout du canon (px de l'arme).
            'profil': {'at': list(at), 'size': [W, H], 'muzzle': list(muzzle(side, 'right'))},
            'face': {'at': [GRIP_FACE[0] - gf[0], GRIP_FACE[1] - gf[1]], 'size': [H, W], 'muzzle': list(muzzle(face, 'down'))},
            'dos': {'at': [GRIP_DOS[0] - gd[0], GRIP_DOS[1] - gd[1]], 'size': [H, W], 'muzzle': list(muzzle(dos, 'up'))},
        }
    ts = root / 'src/zombie/layersData.ts'
    ts.write_text(
        '// Généré par tools/art/layer-weapons.py : ne pas modifier à la main.\n'
        '// Vues : décalage du point d\'ancrage par image (0 = pose fixe, 1..8 = marche), et si une main passe devant\n'
        '// l\'arme. Armes : par vue, coin haut-gauche dans la pose fixe (px du corps), taille et bout du canon (px de\n'
        '// l\'arme).\n'
        f'export const LAYERS = {json.dumps(data, indent=2, ensure_ascii=False)} as const;\n'
    )


if __name__ == '__main__':
    main()
