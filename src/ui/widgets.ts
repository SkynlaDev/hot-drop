import Phaser from 'phaser';
import { C, FONT, H, W } from '../config';
import { CATEGORY_COLORS, FAMILY_INFO, ITEMS } from '../data/items';
import { ItemInst, Mask, maskOf } from '../logic/grid';
import { RARITY_COLORS, RARITY_HEX, RARITY_SHORT } from '../logic/rarity';

type Scene = Phaser.Scene;
type Container = Phaser.GameObjects.Container;

export function txt(scene: Scene, x: number, y: number, s: string, size = 24, color = C.text, extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, resolution: 2, ...extra });
}

/** Fait « rebondir » un conteneur dont l'origine est le coin haut-gauche (échelle autour de son centre). */
export function pop(scene: Scene, c: Container, from = 1.14, duration = 260) {
  const x0 = c.x;
  const y0 = c.y;
  const w = c.width * (c.scaleX || 1);
  const h = c.height * (c.scaleY || 1);
  const base = c.scaleX || 1;
  const state = { k: from };
  const apply = () => {
    c.setScale(base * state.k);
    c.setPosition(x0 - ((state.k - 1) * w) / 2, y0 - ((state.k - 1) * h) / 2);
  };
  apply();
  scene.tweens.add({ targets: state, k: 1, duration, ease: 'Back.Out', onUpdate: apply, onComplete: apply });
}

export interface Button {
  root: Container;
  setLabel(s: string): void;
  setEnabled(on: boolean): void;
}

/** Bouton rectangulaire : (x, y) = coin haut-gauche. Se tasse quand on appuie. */
export function button(
  scene: Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  opts: { primary?: boolean; size?: number } = {},
): Button {
  const root = scene.add.container(x, y);
  root.setSize(w, h);
  const g = scene.add.graphics();
  const t = txt(scene, w / 2, h / 2, label, opts.size ?? 28, C.text, { fontStyle: 'bold' }).setOrigin(0.5);
  const zone = scene.add.zone(w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
  let enabled = true;
  const draw = (pressed = false) => {
    g.clear();
    if (opts.primary && enabled) {
      g.fillStyle(0x000000, 0.35);
      g.fillRoundedRect(0, pressed ? 2 : 6, w, h, 16);
    }
    const fill = opts.primary ? C.accent : C.panel;
    g.fillStyle(fill, enabled ? (opts.primary ? (pressed ? 0.75 : 1) : 1) : 0.12);
    g.fillRoundedRect(0, pressed ? 4 : 0, w, h - 4, 16);
    if (!opts.primary) {
      g.lineStyle(2, C.panelLine, enabled ? 1 : 0.35);
      g.strokeRoundedRect(0, pressed ? 4 : 0, w, h - 4, 16);
    }
    t.setY(h / 2 - 2 + (pressed ? 4 : 0));
    t.setColor(opts.primary && enabled ? '#1a1206' : C.text);
    t.setAlpha(enabled ? 1 : 0.4);
  };
  draw();
  zone.on('pointerdown', () => enabled && draw(true));
  zone.on('pointerout', () => draw());
  zone.on('pointerup', () => {
    draw();
    if (enabled) onClick();
  });
  root.add([g, t, zone]);
  return {
    root,
    setLabel: (s) => t.setText(s),
    setEnabled: (on) => {
      enabled = on;
      draw();
    },
  };
}

/**
 * Remplit la silhouette d'un masque : chaque case + les ponts entre cases voisines,
 * pour que la pièce se lise comme un seul objet. `m` = marge intérieure.
 */
export function fillMask(g: Phaser.GameObjects.Graphics, mask: Mask, cell: number, m: number, r: number, ox = 0, oy = 0) {
  const on = (x: number, y: number) => y >= 0 && y < mask.length && x >= 0 && x < mask[0].length && mask[y][x];
  mask.forEach((row, y) =>
    row.forEach((filled, x) => {
      if (!filled) return;
      const px = ox + x * cell;
      const py = oy + y * cell;
      g.fillRoundedRect(px + m, py + m, cell - 2 * m, cell - 2 * m, r);
      // Les ponts débordent du rayon d'arrondi pour combler les coins des deux cases.
      const b = m + r;
      if (on(x + 1, y)) g.fillRect(px + cell - b, py + m, 2 * b, cell - 2 * m);
      if (on(x, y + 1)) g.fillRect(px + m, py + cell - b, cell - 2 * m, 2 * b);
      if (on(x + 1, y) && on(x, y + 1) && on(x + 1, y + 1)) g.fillRect(px + cell - b, py + cell - b, 2 * b, 2 * b);
    }),
  );
}

/** Case occupée la plus proche du centre de la boîte : c'est là qu'on écrit le nom. */
function labelCell(mask: Mask): [number, number] {
  const cx = (mask[0].length - 1) / 2;
  const cy = (mask.length - 1) / 2;
  let best: [number, number] = [0, 0];
  let bd = Infinity;
  mask.forEach((row, y) =>
    row.forEach((on, x) => {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (on && d < bd) {
        bd = d;
        best = [x, y];
      }
    }),
  );
  return best;
}

/** Vue d'un objet : conteneur dont l'origine est le coin haut-gauche de sa boîte englobante. */
export function itemView(scene: Scene, inst: Pick<ItemInst, 'defId' | 'rot' | 'rarity'>, cell: number): Container {
  const d = ITEMS[inst.defId];
  const mask = maskOf(inst.defId, inst.rot);
  const pw = mask[0].length * cell;
  const ph = mask.length * cell;
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  const rc = RARITY_COLORS[inst.rarity];
  // Bordure de rareté, puis corps de la pièce, puis reflet en haut de chaque case.
  g.fillStyle(rc, 1);
  fillMask(g, mask, cell, 3, 12);
  g.fillStyle(CATEGORY_COLORS[d.category], 1);
  fillMask(g, mask, cell, 8, 8);
  g.fillStyle(0xffffff, 0.07);
  mask.forEach((row, y) => row.forEach((on, x) => on && g.fillRoundedRect(x * cell + 12, y * cell + 11, cell - 24, 10, 5)));
  if (inst.rarity >= 3) {
    // Lueur pour Épique et Légendaire
    const glow = scene.add.graphics();
    glow.fillStyle(rc, 0.35);
    fillMask(glow, mask, cell, -2, 14);
    c.add(glow);
    scene.tweens.add({ targets: glow, alpha: 0.25, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.InOut' });
  }
  const [lx, ly] = labelCell(mask);
  const fam = FAMILY_INFO[d.family];
  const famTag = txt(scene, lx * cell + cell / 2, ly * cell + cell - 17, fam.name.toUpperCase(), 10, fam.hex, { fontStyle: 'bold' }).setOrigin(0.5);
  const label = txt(scene, lx * cell + cell / 2, ly * cell + cell / 2 - 2, d.short, 17, '#f4f1e6', {
    align: 'center',
    fontStyle: 'bold',
    wordWrap: { width: cell - 12 },
    stroke: '#00000066',
    strokeThickness: 3,
  }).setOrigin(0.5);
  const [fx, fy] = (() => {
    for (let y = 0; y < mask.length; y++) for (let x = 0; x < mask[0].length; x++) if (mask[y][x]) return [x, y];
    return [0, 0];
  })();
  const pip = txt(scene, fx * cell + 13, fy * cell + 10, RARITY_SHORT[inst.rarity], 14, RARITY_HEX[inst.rarity], { fontStyle: 'bold' });
  const flash = scene.add.graphics().setAlpha(0);
  c.add([g, label, famTag, pip, flash]);
  c.setSize(pw, ph);
  c.setData('flash', flash);
  c.setData('mask', mask);
  c.setData('cell', cell);
  return c;
}

/** Fait briller brièvement un objet (déclenchement en combat). */
export function flashItem(scene: Scene, view: Container | undefined, color = 0xffffff) {
  const f = view?.getData('flash') as Phaser.GameObjects.Graphics | undefined;
  if (!view || !f) return;
  f.clear();
  f.fillStyle(color, 1);
  fillMask(f, view.getData('mask') as Mask, view.getData('cell') as number, 3, 12);
  scene.tweens.killTweensOf(f);
  f.setAlpha(0.6);
  scene.tweens.add({ targets: f, alpha: 0, duration: 260, ease: 'Quad.Out' });
}

/** Message court au centre de l'écran, qui surgit puis s'efface. */
export function toast(scene: Scene, s: string, color = C.text, y = 900) {
  const t = txt(scene, W / 2, y, s, 26, color, {
    fontStyle: 'bold',
    backgroundColor: '#0d0f0ae6',
    padding: { x: 20, y: 12 },
    align: 'center',
    wordWrap: { width: W - 80 },
  })
    .setOrigin(0.5)
    .setDepth(200)
    .setScale(0.7)
    .setAlpha(0);
  scene.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 180, ease: 'Back.Out' });
  scene.tweens.add({ targets: t, y: y - 40, alpha: 0, delay: 1200, duration: 450, ease: 'Quad.In', onComplete: () => t.destroy() });
}

/** Gros titre (VICTOIRE, DÉFAITE…) qui claque puis disparaît. */
export function banner(scene: Scene, s: string, color: string, y: number) {
  const t = txt(scene, W / 2, y, s, 64, color, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 8 })
    .setOrigin(0.5)
    .setDepth(210)
    .setScale(2.2)
    .setAlpha(0);
  scene.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 260, ease: 'Back.Out' });
  scene.tweens.add({ targets: t, alpha: 0, scale: 0.9, delay: 900, duration: 300, onComplete: () => t.destroy() });
}

/** Fond de modale qui bloque les entrées derrière. */
export function modalBase(scene: Scene, onBackdrop?: () => void): Container {
  const root = scene.add.container(0, 0).setDepth(100);
  const bg = scene.add.rectangle(0, 0, W, H, 0x000000, 0.75).setOrigin(0).setInteractive();
  if (onBackdrop) bg.on('pointerup', onBackdrop);
  bg.setAlpha(0);
  scene.tweens.add({ targets: bg, alpha: 1, duration: 160 });
  root.add(bg);
  return root;
}

export function panel(scene: Scene, x: number, y: number, w: number, h: number, stroke = C.panelLine) {
  const g = scene.add.graphics();
  g.fillStyle(C.panel, 1);
  g.fillRoundedRect(x, y, w, h, 18);
  g.lineStyle(2, stroke, 1);
  g.strokeRoundedRect(x, y, w, h, 18);
  return g;
}

export function vibrate(ms: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* non supporté */
    }
  }
}

/** Fondu d'entrée commun à toutes les scènes. */
export function fadeIn(scene: Scene) {
  scene.cameras.main.fadeIn(220, 20, 22, 15);
}
