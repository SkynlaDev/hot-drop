// Mode Zombie : affichage de la carte (sprites des obstacles, sol du décor) et de l'extraction (zone,
// hélico, flèche et jauge dans le HUD). La logique est dans map.ts et extraction.ts.
import Phaser from 'phaser';
import { C, H, TITLE_FONT, W } from '../config';
import { P } from '../ui/palette';
import { txt } from '../ui/widgets';
import { CELL, GameMap, Obstacle, THEMES, THEME_IDS, ThemeId } from './map';
import { LZ } from './extraction';
import type { World } from './world';

/** Affichage de chaque sprite d'obstacle : largeur à l'écran (px) et hauteur des pieds au-dessus du bas de l'empreinte. */
const ART: Record<string, { w: number; foot: number }> = {
  voiture: { w: 150, foot: 0 },
  voiture2: { w: 150, foot: 2 },
  voiture_v: { w: 76, foot: 0 },
  bus: { w: 270, foot: 2 },
  muret: { w: 138, foot: 6 },
  barricade: { w: 78, foot: 2 },
  gravats: { w: 146, foot: 0 },
  sapin: { w: 84, foot: 12 },
  arbre_mort: { w: 112, foot: 12 },
  rocher: { w: 140, foot: 4 },
  tronc: { w: 204, foot: 4 },
  conteneur: { w: 198, foot: 0 },
  conteneur2: { w: 198, foot: 0 },
  conteneur_v: { w: 74, foot: 0 },
  caisses: { w: 74, foot: 2 },
  futs: { w: 70, foot: 4 },
};

export const HELI = 'zc-helico';
const groundKey = (t: ThemeId) => (t === 'ville' ? 'z-ground' : `zc-${THEMES[t].ground}`);

/** Décor de la partie : ?carte=ville|foret|port dans l'adresse (essais), sinon au hasard. */
export function pickTheme(rnd: () => number): ThemeId {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('carte') : null;
  if (q && (THEME_IDS as string[]).includes(q)) return q as ThemeId;
  return THEME_IDS[Math.floor(rnd() * THEME_IDS.length)];
}

export function preloadMapArt(load: Phaser.Loader.LoaderPlugin) {
  const keys: string[] = [HELI];
  if (!load.scene.textures.exists(HELI)) load.image(HELI, 'art/zombie/carte/helico.png');
  for (const t of THEME_IDS) {
    const g = groundKey(t);
    if (t !== 'ville' && !load.scene.textures.exists(g)) load.image(g, `art/zombie/carte/${THEMES[t].ground}.png`);
    keys.push(g);
    for (const id of Object.keys(THEMES[t].defs)) {
      const k = `zc-${id}`;
      keys.push(k);
      if (!load.scene.textures.exists(k)) load.image(k, `art/zombie/carte/${id}.png`);
    }
  }
  load.once(Phaser.Loader.Events.COMPLETE, () => {
    for (const k of keys) {
      const tex = load.scene.textures.get(k);
      if (tex.key !== '__MISSING') tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  });
}

/** Sprites de repli dessinés en code (si un PNG manque) : blocs sombres à la taille de l'empreinte. */
function fallbackTextures(scene: Phaser.Scene, map: GameMap) {
  for (const def of Object.values(map.theme.defs)) {
    const k = `zc-${def.id}`;
    if (scene.textures.exists(k) && scene.textures.get(k).key !== '__MISSING') continue;
    if (scene.textures.exists(k)) scene.textures.remove(k);
    const w = def.cw * CELL;
    const h = def.ch * CELL;
    const g = scene.make.graphics({}, false);
    g.fillStyle(P.nuit, 1);
    if (def.shape === 'circle') g.fillCircle(w / 2, h / 2, Math.min(w, h) / 2);
    else g.fillRect(0, 0, w, h);
    g.fillStyle(P.acierSombre, 1);
    if (def.shape === 'circle') g.fillCircle(w / 2, h / 2 - 4, Math.min(w, h) / 2 - 4);
    else g.fillRect(3, 3, w - 6, h - 10);
    g.generateTexture(k, w, h);
    g.destroy();
  }
  const gk = groundKey(map.theme.id);
  if (!scene.textures.exists(gk) || scene.textures.get(gk).key === '__MISSING') {
    if (scene.textures.exists(gk)) scene.textures.remove(gk);
    const g = scene.make.graphics({}, false);
    g.fillStyle(map.theme.id === 'foret' ? 0x2c3326 : 0x34363a, 1);
    g.fillRect(0, 0, 64, 64);
    g.generateTexture(gk, 64, 64);
    g.destroy();
  }
}

/** Clé de la texture du sol du décor (à passer au TileSprite de la scène). */
export function mapGround(scene: Phaser.Scene, map: GameMap): string {
  fallbackTextures(scene, map);
  return groundKey(map.theme.id);
}

/** Obstacles et zone d'extraction dans le monde. */
export class MapView {
  private pool: Phaser.GameObjects.Image[] = [];
  private seen: Obstacle[] = [];
  private pad: Phaser.GameObjects.Graphics;
  private heli: Phaser.GameObjects.Image;
  private heliShadow: Phaser.GameObjects.Image;
  private rotor: Phaser.GameObjects.Graphics;
  /** Hélico : altitude (0 posé, 1 en vol), départ après l'extraction. */
  private alt = 1;
  leaving = false;

  constructor(private scene: Phaser.Scene, private map: GameMap, private depth: (y: number) => number) {
    for (let i = 0; i < 140; i++) this.pool.push(scene.add.image(0, 0, '__WHITE').setVisible(false).setOrigin(0.5, 1));
    this.pad = scene.add.graphics().setDepth(-3);
    this.heliShadow = scene.add.image(0, 0, 'zb-shadow').setVisible(false).setDepth(-2).setAlpha(0.8);
    this.heli = scene.add.image(0, 0, HELI).setVisible(false);
    this.rotor = scene.add.graphics().setVisible(false);
  }

  update(w: World, camX: number, camY: number) {
    const now = this.scene.time.now / 1000;
    // Obstacles visibles (marge : les sprites dépassent de leur empreinte, vers le haut surtout).
    const list = this.map.obstaclesIn(camX - 160, camY - 80, camX + W + 160, camY + H + 260, this.seen);
    let i = 0;
    for (const o of list) {
      if (i >= this.pool.length) break;
      const im = this.pool[i++];
      const k = `zc-${o.def.id}`;
      const a = ART[o.def.id] ?? { w: o.def.cw * CELL, foot: 0 };
      if (im.texture.key !== k) im.setTexture(k);
      const bottom = (o.gy + o.def.ch) * CELL - a.foot;
      const x = (o.gx + o.def.cw / 2) * CELL;
      const sc = a.w / im.width;
      // Devant le soldat et sur lui : à demi transparent (on ne perd jamais son soldat derrière un arbre).
      const hides = bottom > w.py && bottom - im.height * sc < w.py - 20 && Math.abs(x - w.px) < a.w / 2 + 14;
      im.setVisible(true)
        .setPosition(x, bottom)
        .setScale(sc)
        .setAlpha(hides ? 0.45 : 1)
        .setDepth(this.depth(bottom - 6));
    }
    for (; i < this.pool.length; i++) if (this.pool[i].visible) this.pool[i].setVisible(false);

    // Zone d'extraction : cercle au sol, « H », progression ; l'hélico descend quand on y entre.
    const g = this.pad;
    g.clear();
    const lz = w.lz;
    const show = lz.active || w.extracted;
    if (show) {
      const x = lz.x;
      const y = lz.y;
      const r = LZ.radius;
      const beat = 0.5 + 0.5 * Math.sin(now * 5);
      g.fillStyle(P.soin, 0.1 + (lz.inside ? 0.08 : 0.04 * beat));
      g.fillCircle(x, y, r);
      g.lineStyle(6, P.soinClair, 0.55 + 0.35 * beat);
      g.strokeCircle(x, y, r);
      g.lineStyle(3, P.soinClair, 0.35);
      g.strokeCircle(x, y, r * 0.62);
      // H
      g.fillStyle(P.blanc, 0.7);
      g.fillRect(x - 28, y - 30, 12, 60);
      g.fillRect(x + 16, y - 30, 12, 60);
      g.fillRect(x - 16, y - 6, 32, 12);
      // Progression : arc autour du cercle.
      if (lz.t > 0) {
        g.lineStyle(10, P.or, 1);
        g.beginPath();
        g.arc(x, y, r + 10, -Math.PI / 2, -Math.PI / 2 + (lz.t / LZ.hold) * Math.PI * 2, false);
        g.strokePath();
      }
    }
    const wantAlt = this.leaving ? 3 : lz.inside || lz.t > 0 ? 0.9 * (1 - lz.t / LZ.hold) : 1;
    this.alt += (wantAlt - this.alt) * Math.min(1, (this.leaving ? 0.9 : 1.6) * (1 / 60));
    if (show) {
      const hx = lz.x;
      const hy = lz.y - 30 - this.alt * 260;
      this.heli.setVisible(true).setPosition(hx, hy + Math.sin(now * 3) * 4).setScale(1.5).setDepth(5000);
      this.heliShadow.setVisible(true).setPosition(lz.x, lz.y).setScale(5 - this.alt, 2.2 - this.alt * 0.4).setAlpha(0.45);
      const rg = this.rotor;
      rg.clear().setVisible(true).setDepth(5001);
      const rr = 150;
      const ry = hy - 10;
      // Rotor : un disque flou et deux pales claires qui tournent (en dessin, pas de sprite tourné).
      rg.fillStyle(P.blanc, 0.07);
      rg.fillEllipse(hx, ry, rr * 2, rr * 1.4);
      for (let k = 0; k < 2; k++) {
        const a = now * 19 + k * Math.PI;
        rg.lineStyle(3, P.blanc, 0.18);
        rg.lineBetween(hx - Math.cos(a) * rr, ry - Math.sin(a) * rr * 0.7, hx + Math.cos(a) * rr, ry + Math.sin(a) * rr * 0.7);
      }
    } else {
      this.heli.setVisible(false);
      this.heliShadow.setVisible(false);
      this.rotor.setVisible(false);
    }
  }
}

/** Dans le HUD : flèche vers la zone quand elle est hors de l'écran, jauge d'attente. */
export class LzHud {
  private label: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene) {
    this.label = txt(scene, W / 2, 196, '', 24, C.goodStr, { fontFamily: TITLE_FONT, stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5).setVisible(false).setDepth(20);
  }

  update(g: Phaser.GameObjects.Graphics, w: World) {
    const lz = w.lz;
    if (!lz.active) {
      this.label.setVisible(false);
      return;
    }
    const now = this.scene.time.now;
    const dist = Math.hypot(lz.x - w.px, lz.y - w.py);
    if (lz.inside || lz.t > 0) {
      const left = Math.max(0, LZ.hold - lz.t);
      this.label.setVisible(true).setText(lz.inside ? `EXTRACTION · TIENS ${Math.ceil(left)} S` : 'RETOURNE DANS LA ZONE !').setColor(lz.inside ? C.goodStr : C.dangerStr);
      g.fillStyle(P.nuit, 0.85);
      g.fillRect(W / 2 - 160, 214, 320, 16);
      g.fillStyle(P.or, 1);
      g.fillRect(W / 2 - 158, 216, 316 * (lz.t / LZ.hold), 12);
    } else this.label.setVisible(true).setText(`HÉLICO · ${Math.round(dist / 10)} M`).setColor(C.goodStr);
    // Flèche au bord de l'écran (comme pour le boss), verte.
    const sx = lz.x - w.px + W / 2;
    const sy = lz.y - (w.py - 40) + H / 2;
    if (sx > 0 && sx < W && sy > 60 && sy < H) return;
    const M = 52;
    const a = Math.atan2(sy - H / 2, sx - W / 2);
    const t = Math.min((W / 2 - M) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - M - 60) / Math.abs(Math.sin(a) || 1e-6));
    const ax = W / 2 + Math.cos(a) * t;
    // Pas sur les plaques du HUD (en haut) ni sur la barre d'armes (en bas).
    const ay = Math.max(270, Math.min(H - 170, H / 2 + Math.sin(a) * t));
    const s2 = 26;
    g.fillStyle(P.nuit, 0.85);
    g.fillCircle(ax, ay, s2 + 8);
    g.lineStyle(3, P.soinClair, 0.6 + 0.4 * Math.sin(now / 120));
    g.strokeCircle(ax, ay, s2 + 8);
    g.fillStyle(P.soinClair, 1);
    g.fillTriangle(ax + Math.cos(a) * s2, ay + Math.sin(a) * s2, ax + Math.cos(a + 2.4) * s2, ay + Math.sin(a + 2.4) * s2, ax + Math.cos(a - 2.4) * s2, ay + Math.sin(a - 2.4) * s2);
  }
}
