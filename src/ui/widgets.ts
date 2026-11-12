import Phaser from 'phaser';
import { ITEM_SPRITE_CELL, iconKey, isWeaponIcon, itemSpriteKey } from '../art';
import { C, FONT, H, TITLE_FONT, W } from '../config';
import { P, hex } from './palette';
import { CATEGORY_COLORS, FAMILY_INFO, ITEMS } from '../data/items';
import { ItemInst, Mask, maskOf } from '../logic/grid';
import { getSettings } from '../logic/settings';
import { sfx } from '../audio/sfx';
import { TIER_COLORS, tierOf } from '../logic/tier';

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

/** Polygone d'un rectangle aux coins coupés (chanfrein `c`), style plaque militaire. */
export function chamferPoints(x: number, y: number, w: number, h: number, c: number): Phaser.Math.Vector2[] {
  const k = Math.min(c, w / 2, h / 2);
  return [
    new Phaser.Math.Vector2(x + k, y), new Phaser.Math.Vector2(x + w - k, y), new Phaser.Math.Vector2(x + w, y + k),
    new Phaser.Math.Vector2(x + w, y + h - k), new Phaser.Math.Vector2(x + w - k, y + h), new Phaser.Math.Vector2(x + k, y + h),
    new Phaser.Math.Vector2(x, y + h - k), new Phaser.Math.Vector2(x, y + k),
  ];
}

function fillChamfer(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, c: number) {
  g.fillPoints(chamferPoints(x, y, w, h, c), true);
}

function strokeChamfer(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, c: number) {
  g.strokePoints(chamferPoints(x, y, w, h, c), true, true);
}

/** Rivet : tête sombre, reflet clair en haut à gauche. */
function rivet(g: Phaser.GameObjects.Graphics, x: number, y: number, r = 3) {
  g.fillStyle(P.nuit, 0.9);
  g.fillCircle(x + 0.8, y + 1, r);
  g.fillStyle(P.acier, 1);
  g.fillCircle(x, y, r);
  g.fillStyle(P.acierClair, 0.9);
  g.fillCircle(x - r * 0.35, y - r * 0.35, r * 0.4);
}

/**
 * Bouton de jeu : (x, y) = coin haut-gauche. Plaque aux coins coupés, lèvre 3D qui s'écrase à l'appui,
 * rivets aux extrémités ; le bouton principal (orange) respire doucement. `icon` = clé d'une icône (ic-…).
 */
export function button(
  scene: Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  opts: { primary?: boolean; size?: number; icon?: string } = {},
): Button {
  const root = scene.add.container(x, y);
  root.setSize(w, h);
  const LIP = 6;
  const CH = Math.min(14, h * 0.22);
  const glow = scene.add.graphics();
  const g = scene.add.graphics();
  const t = txt(scene, w / 2, h / 2, label.toUpperCase(), opts.size ?? 28, C.text, { fontFamily: TITLE_FONT, letterSpacing: 1 }).setOrigin(0.5);
  const icon = opts.icon && scene.textures.exists(opts.icon) ? scene.add.image(0, 0, opts.icon) : null;
  const zone = scene.add.zone(w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
  let enabled = true;
  const draw = (pressed = false) => {
    g.clear();
    const dy = pressed ? LIP - 2 : 0;
    const prim = !!opts.primary && enabled;
    const fh = h - LIP;
    // Ombre portée et lèvre
    g.fillStyle(P.noir, 0.45);
    fillChamfer(g, 0, LIP + 3, w, fh, CH);
    g.fillStyle(prim ? P.braise : P.nuit, 1);
    fillChamfer(g, 0, LIP, w, fh, CH);
    // Face, puis bande claire en haut (le métal accroche la lumière)
    g.fillStyle(prim ? (pressed ? P.orangeClair : P.orange) : enabled ? P.relief : P.fond2, 1);
    fillChamfer(g, 0, dy, w, fh, CH);
    g.fillStyle(prim ? P.orangeClair : P.trait, prim ? 0.55 : enabled ? 0.6 : 0.2);
    fillChamfer(g, 3, dy + 3, w - 6, fh * 0.38, CH - 2);
    // Liseré intérieur et contour
    g.lineStyle(2, prim ? P.orangePale : enabled ? P.traitClair : P.case, prim ? 0.8 : 1);
    strokeChamfer(g, 0, dy, w, fh, CH);
    if (enabled && w > 140) {
      rivet(g, 14, dy + fh / 2, 3);
      rivet(g, w - 14, dy + fh / 2, 3);
    }
    if (!enabled) {
      // Hachures d'un bouton désactivé
      g.lineStyle(2, P.blanc, 0.04);
      for (let hx = CH; hx + fh < w - CH; hx += 16) g.lineBetween(hx, dy + fh - 3, hx + fh - 6, dy + 3);
    }
    const col = prim ? hex(P.nuit) : C.text;
    t.setY(fh / 2 + dy).setColor(col).setAlpha(enabled ? 1 : 0.35);
    // Le texte rétrécit s'il déborde (la police des titres est large).
    const iconW = icon ? Math.min(icon.width, (fh * 0.5 * icon.width) / Math.max(icon.width, icon.height)) + 12 : 0;
    t.setScale(Math.min(1, (w - 40 - iconW) / t.width));
    if (icon) {
      const s = Math.min(1, (fh * 0.5) / Math.max(icon.width, icon.height));
      icon.setScale(s).setTint(prim ? P.nuit : P.texte).setAlpha(enabled ? 1 : 0.35);
      const total = icon.displayWidth + 12 + t.displayWidth;
      icon.setPosition(w / 2 - total / 2 + icon.displayWidth / 2, fh / 2 + dy);
      t.setX(w / 2 - total / 2 + icon.displayWidth + 12 + t.displayWidth / 2);
    } else t.setX(w / 2);
    // Lueur du bouton principal (elle respire, voir plus bas)
    glow.clear();
    if (prim) {
      glow.lineStyle(6, P.orange, 0.35);
      strokeChamfer(glow, -4, -4, w + 8, fh + 8, CH + 3);
    }
  };
  draw();
  if (opts.primary) scene.tweens.add({ targets: glow, alpha: { from: 1, to: 0.15 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  zone.on('pointerdown', () => enabled && draw(true));
  zone.on('pointerout', () => draw());
  zone.on('pointerup', () => {
    draw();
    if (enabled) {
      sfx('click');
      onClick();
    }
  });
  root.add([glow, g, ...(icon ? [icon] : []), t, zone]);
  return {
    root,
    setLabel: (s) => {
      t.setText(s.toUpperCase());
      draw();
    },
    setEnabled: (on) => {
      enabled = on;
      draw();
    },
  };
}

/**
 * Plaque de titre (style plaque gravée) : (x, y) = centre. Bande d'accent à gauche, texte au pochoir.
 * Renvoie le conteneur ; sa largeur suit le texte.
 */
export function plate(scene: Scene, x: number, y: number, s: string, accent: number = P.orange, size = 26): Container {
  const c = scene.add.container(x, y);
  const t = txt(scene, 0, 0, s.toUpperCase(), size, C.text, { fontFamily: TITLE_FONT, letterSpacing: 2 }).setOrigin(0.5);
  const w = t.width + 64;
  const h = size + 22;
  const g = scene.add.graphics();
  g.fillStyle(P.noir, 0.45);
  fillChamfer(g, -w / 2 + 3, -h / 2 + 4, w, h, 10);
  g.fillStyle(P.fond2, 1);
  fillChamfer(g, -w / 2, -h / 2, w, h, 10);
  g.fillStyle(accent, 1);
  g.fillRect(-w / 2 + 10, -h / 2 + 6, 6, h - 12);
  g.fillRect(w / 2 - 16, -h / 2 + 6, 6, h - 12);
  g.lineStyle(2, P.traitClair, 1);
  strokeChamfer(g, -w / 2, -h / 2, w, h, 10);
  c.add([g, t]);
  c.setSize(w, h);
  return c;
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
export function itemView(scene: Scene, inst: Pick<ItemInst, 'defId' | 'rot'>, cell: number): Container {
  const d = ITEMS[inst.defId];
  const mask = maskOf(inst.defId, inst.rot);
  const pw = mask[0].length * cell;
  const ph = mask.length * cell;
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  const tier = tierOf(inst.defId);
  const rc = TIER_COLORS[tier];
  const k = cell / 80;
  if (tier >= 1) {
    // Lueur pour les objets assemblés
    const glow = scene.add.graphics();
    glow.fillStyle(rc, 0.35);
    fillMask(glow, mask, cell, -2 * k, 14 * k);
    c.add(glow);
    scene.tweens.add({ targets: glow, alpha: 0.25, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.InOut' });
  }
  // Bordure de niveau (base / assemblé), corps sombre teinté par la catégorie, reflet sur le haut de chaque case.
  g.fillStyle(rc, 1);
  fillMask(g, mask, cell, 3 * k, 10 * k);
  g.fillStyle(0x17141c, 1);
  fillMask(g, mask, cell, 6 * k, 7 * k);
  const sprite = scene.textures.exists(itemSpriteKey(inst.defId));
  // Avec un sprite, la teinte de catégorie s'efface pour laisser le dessin lisible.
  g.fillStyle(CATEGORY_COLORS[d.category], sprite ? 0.32 : 0.85);
  fillMask(g, mask, cell, 6 * k, 7 * k);
  g.fillStyle(0xffffff, 0.06);
  mask.forEach((row, y) => row.forEach((on, x) => on && g.fillRect(x * cell + 6 * k, y * cell + 6 * k, cell - 12 * k, cell * 0.3)));
  // Coutures en pointillés entre les cases d'un même objet
  g.fillStyle(0x000000, 0.28);
  mask.forEach((row, y) => row.forEach((on, x) => {
    if (!on) return;
    if (mask[y]?.[x + 1]) for (let t = 10 * k; t < cell - 10 * k; t += 7 * k) g.fillRect((x + 1) * cell - 1, y * cell + t, 2, 3 * k);
    if (mask[y + 1]?.[x]) for (let t = 10 * k; t < cell - 10 * k; t += 7 * k) g.fillRect(x * cell + t, (y + 1) * cell - 1, 3 * k, 2);
  }));
  // Coin de famille sur la première case
  const [fx, fy] = (() => {
    for (let y = 0; y < mask.length; y++) for (let x = 0; x < mask[0].length; x++) if (mask[y][x]) return [x, y];
    return [0, 0];
  })();
  const fam = FAMILY_INFO[d.family];
  g.fillStyle(fam.color, 1);
  g.fillTriangle(fx * cell + 6 * k, fy * cell + 6 * k, fx * cell + 26 * k, fy * cell + 6 * k, fx * cell + 6 * k, fy * cell + 26 * k);
  c.add(g);

  if (sprite) {
    // Sprite PixelLab dessiné dans la forme non tournée : il tourne avec l'objet, autour du centre.
    const img = scene.add.image(pw / 2, ph / 2, itemSpriteKey(inst.defId)).setOrigin(0.5).setScale(cell / ITEM_SPRITE_CELL).setAngle(90 * inst.rot);
    c.add(img);
  }
  // Icône (sans sprite) : une arme s'étire le long de sa ligne la plus longue, les autres objets se centrent.
  const cells: [number, number][] = [];
  mask.forEach((row, y) => row.forEach((on, x) => on && cells.push([x, y])));
  const key = iconKey(inst.defId);
  const icon = scene.add.image(0, 0, key).setTint(0xece2cf).setAlpha(sprite ? 0 : 0.92);
  if (isWeaponIcon(inst.defId)) {
    let by = 0;
    let best = 0;
    mask.forEach((row, y) => {
      const n = row.filter(Boolean).length;
      if (n > best) [best, by] = [n, y];
    });
    const xs = mask[by].map((v, x) => (v ? x : -1)).filter((x) => x >= 0);
    const span = (xs[xs.length - 1] - xs[0] + 1) * cell;
    const iw = Math.min(span - 16 * k, (cell - 14 * k) * 2);
    icon.setDisplaySize(iw, iw / 2).setPosition(xs[0] * cell + span / 2, by * cell + cell / 2 - 4 * k);
  } else {
    const cx = cells.reduce((a, p) => a + p[0], 0) / cells.length;
    const cy = cells.reduce((a, p) => a + p[1], 0) / cells.length;
    const size = cells.length >= 4 ? cell * 1.05 : cells.length === 1 ? cell * 0.56 : cell * 0.7;
    const ratio = icon.width / icon.height;
    icon.setDisplaySize(size * Math.min(1, ratio), size / Math.max(1, ratio)).setPosition((cx + 0.5) * cell, (cy + 0.5) * cell - (cells.length === 1 ? 7 * k : 4 * k));
  }
  c.add(icon);

  // Nom court en bas à gauche de la dernière ligne
  const ly = mask.length - 1;
  const lx = mask[ly].findIndex(Boolean);
  const label = txt(scene, lx * cell + 9 * k, ly * cell + cell - 7 * k, d.short.toUpperCase(), Math.round(14 * k), '#ece2cf', {
    fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
  }).setOrigin(0, 1);
  if (label.width > (mask[ly].filter(Boolean).length * cell) - 14 * k) label.setScale(((mask[ly].filter(Boolean).length * cell) - 14 * k) / label.width);
  const flash = scene.add.graphics().setAlpha(0);
  c.add([label, flash]);
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
  const t = txt(scene, W / 2, y, s, 64, color, { fontFamily: TITLE_FONT, stroke: '#000000', strokeThickness: 10, padding: { x: 12, y: 6 } })
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

/**
 * Panneau : plaque sombre aux coins coupés, renforts métalliques rivetés dans les angles (de la couleur
 * du contour), reflet en haut. Un seul Graphics, ajouté par l'appelant.
 */
export function panel(scene: Scene, x: number, y: number, w: number, h: number, stroke = C.panelLine) {
  const g = scene.add.graphics();
  const CH = 16;
  g.fillStyle(P.noir, 0.4);
  fillChamfer(g, x + 2, y + 5, w, h, CH);
  g.fillStyle(C.panel, 1);
  fillChamfer(g, x, y, w, h, CH);
  // Reflet du haut et ombre du bas (relief de tôle)
  g.fillStyle(P.blanc, 0.035);
  fillChamfer(g, x + 3, y + 3, w - 6, Math.min(56, h / 3), CH - 3);
  g.fillStyle(P.noir, 0.18);
  g.fillRect(x + CH, y + h - 6, w - 2 * CH, 3);
  g.lineStyle(2, stroke, 1);
  strokeChamfer(g, x, y, w, h, CH);
  // Renforts d'angle en L, rivetés
  if (w > 200 && h > 120) {
    const L = Math.min(24, w / 8, h / 5);
    const T = 4;
    g.fillStyle(stroke, 1);
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]] as const) {
      const ox = cx + sx * (CH * 0.5 + 4);
      const oy = cy + sy * (CH * 0.5 + 4);
      g.fillRect(sx > 0 ? ox : ox - L, sy > 0 ? oy : oy - T, L, T);
      g.fillRect(sx > 0 ? ox : ox - T, sy > 0 ? oy : oy - L, T, L);
      rivet(g, ox + sx * (T + 5), oy + sy * (T + 5), 2.6);
    }
  }
  return g;
}

export function vibrate(ms: number | number[]) {
  if (!getSettings().vibration) return;
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

/** Teinte de chaque sacoche (cuir, toile, sangle). */
const BAG_TINT: Record<string, [number, number]> = {
  pochette: [0x6f5238, 0xb09a72],
  sacoche: [0x6f5238, 0x8b7a5a],
  ceinture: [0x4a4d3a, 0x8b7a5a],
  sac_tactique: [0x5b5e46, 0xb09a72],
};

/**
 * Vue d'une sacoche (data/bags.ts) : cuir ou toile cousu, une encoche par case.
 * Conteneur dont l'origine est le coin haut-gauche de sa boîte englobante.
 */
export function bagView(scene: Scene, inst: { defId: string; rot: ItemInst['rot'] }, cell: number): Container {
  const mask = maskOf(inst.defId, inst.rot);
  const [body, line] = BAG_TINT[inst.defId] ?? BAG_TINT.sacoche;
  const k = cell / 72;
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4);
  fillMask(g, mask, cell, 0, 10 * k, 2 * k, 4 * k);
  g.fillStyle(line, 1);
  fillMask(g, mask, cell, 0, 10 * k);
  g.fillStyle(body, 1);
  fillMask(g, mask, cell, 3 * k, 8 * k);
  // Grain du cuir : un léger reflet en haut de chaque case
  g.fillStyle(0xffffff, 0.05);
  mask.forEach((row, y) => row.forEach((on, x) => on && g.fillRect(x * cell + 4 * k, y * cell + 4 * k, cell - 8 * k, cell * 0.22)));
  // Couture en pointillés le long du bord
  const on = (x: number, y: number) => y >= 0 && y < mask.length && x >= 0 && x < mask[0].length && mask[y][x];
  g.fillStyle(line, 0.9);
  const inset = 7 * k;
  const dash = 5 * k;
  mask.forEach((row, y) => row.forEach((filled, x) => {
    if (!filled) return;
    const px = x * cell;
    const py = y * cell;
    for (let t = 0; t < cell; t += dash * 2) {
      if (!on(x, y - 1)) g.fillRect(px + t, py + inset, dash, 1.5 * k + 0.5);
      if (!on(x, y + 1)) g.fillRect(px + t, py + cell - inset, dash, 1.5 * k + 0.5);
      if (!on(x - 1, y)) g.fillRect(px + inset, py + t, 1.5 * k + 0.5, dash);
      if (!on(x + 1, y)) g.fillRect(px + cell - inset, py + t, 1.5 * k + 0.5, dash);
    }
    // Encoche de la case (où se pose un objet)
    g.fillStyle(0x000000, 0.18);
    g.fillRoundedRect(px + 11 * k, py + 11 * k, cell - 22 * k, cell - 22 * k, 6 * k);
    g.fillStyle(line, 0.9);
  }));
  // Boucle de sangle sur la première case
  const fy = mask.findIndex((r) => r.some(Boolean));
  const fx = mask[fy].findIndex(Boolean);
  g.fillStyle(0x221e28, 1);
  g.fillRoundedRect(fx * cell + cell / 2 - 9 * k, fy * cell - 2 * k, 18 * k, 12 * k, 3 * k);
  g.lineStyle(2 * k, 0xb09a72, 1);
  g.strokeRoundedRect(fx * cell + cell / 2 - 7 * k, fy * cell, 14 * k, 8 * k, 2 * k);
  c.add(g);
  const flash = scene.add.graphics().setAlpha(0);
  c.add(flash);
  c.setSize(mask[0].length * cell, mask.length * cell);
  c.setData('flash', flash);
  c.setData('mask', mask);
  c.setData('cell', cell);
  return c;
}
