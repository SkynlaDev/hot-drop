// Éléments d'en-tête partagés par la carte et la zone : progression des cercles, crédits, Goulag.
import Phaser from 'phaser';
import { C, W } from '../config';
import { RunState } from '../logic/run';
import { CardType, ROUNDS, ZoneSize } from '../logic/zone';
import { txt } from './widgets';

type Scene = Phaser.Scene;

/** Couleur et libellé de chaque taille de zone (les grandes sont « chaudes »). */
export const SIZE_INFO: Record<ZoneSize, { name: string; color: number; hex: string; heat: string }> = {
  petite: { name: 'Petite', color: 0x5fbf6a, hex: '#7ddc86', heat: 'Calme' },
  moyenne: { name: 'Moyenne', color: 0xf2c94c, hex: '#f5d46e', heat: 'Disputée' },
  grande: { name: 'Grande', color: 0xe5484d, hex: '#ff6b6b', heat: 'Chaude' },
};

/** Pastille arrondie avec icône optionnelle ; (x, y) = bord droit (align 'right') ou gauche, centre vertical. */
export function pill(scene: Scene, x: number, y: number, label: string, opts: { icon?: string; color?: number; text?: string; align?: 'left' | 'right'; size?: number; fill?: number } = {}) {
  const c = scene.add.container(0, 0);
  const size = opts.size ?? 22;
  const t = txt(scene, 0, 0, label, size, opts.text ?? C.text, { fontStyle: 'bold' }).setOrigin(0, 0.5);
  const iw = opts.icon ? size + 8 : 0;
  const h = size + 22;
  const w = t.width + iw + 30;
  const x0 = opts.align === 'right' ? x - w : x;
  const g = scene.add.graphics();
  g.fillStyle(opts.fill ?? 0x0d0f0a, 0.9);
  g.fillRoundedRect(x0, y - h / 2, w, h, h / 2);
  g.lineStyle(2, opts.color ?? C.panelLine, 1);
  g.strokeRoundedRect(x0, y - h / 2, w, h, h / 2);
  c.add(g);
  if (opts.icon) {
    const ic = scene.add.image(x0 + 15 + size / 2, y, opts.icon).setDisplaySize(size + 2, size + 2);
    if (opts.color !== undefined) ic.setTint(opts.color);
    c.add(ic);
  }
  t.setPosition(x0 + 15 + iw, y);
  c.add(t);
  c.setData('w', w);
  return c;
}

/** Crédits et état du Goulag, alignés à droite. */
export function statusPills(scene: Scene, run: RunState, y: number, right = W - 20): Phaser.GameObjects.Container {
  const cr = pill(scene, right, y, `${run.credits}`, { icon: 'ic-credit', color: C.accent, align: 'right' });
  const crW = cr.getData('w') as number;
  const gl = run.goulagUsed
    ? pill(scene, right - crW - 10, y, 'Goulag utilisé', { icon: 'ic-lock', color: 0x6a6e5c, text: C.quiet, align: 'right', size: 18 })
    : pill(scene, right - crW - 10, y, 'Goulag dispo', { icon: 'ic-heart', color: C.good, text: C.goodStr, align: 'right', size: 18 });
  const c = scene.add.container(0, 0, [cr, gl]);
  c.setData('w', crW + 10 + (gl.getData('w') as number));
  return c;
}

/** Progression des cercles : une pastille par manche puis le Top 1. */
export function roundTrack(scene: Scene, x: number, y: number, round: number): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const c = scene.add.container(0, 0, [g]);
  const step = 46;
  for (let i = 0; i <= ROUNDS; i++) {
    const cx = x + i * step;
    const done = i < round;
    const cur = i === round;
    const final = i === ROUNDS;
    if (i > 0) {
      g.lineStyle(3, i <= round ? C.accent : C.cellLine, 1);
      g.lineBetween(cx - step + 11, y, cx - 11, y);
    }
    if (final) {
      g.fillStyle(cur ? C.accent : 0x0d0f0a, 1);
      g.fillPoints([new Phaser.Math.Vector2(cx, y - 13), new Phaser.Math.Vector2(cx + 13, y), new Phaser.Math.Vector2(cx, y + 13), new Phaser.Math.Vector2(cx - 13, y)], true);
      g.lineStyle(2, cur ? 0xffffff : C.accent, 1);
      g.strokePoints([new Phaser.Math.Vector2(cx, y - 13), new Phaser.Math.Vector2(cx + 13, y), new Phaser.Math.Vector2(cx, y + 13), new Phaser.Math.Vector2(cx - 13, y)], true);
      continue;
    }
    g.fillStyle(done ? C.accent : cur ? 0xffffff : 0x0d0f0a, 1);
    g.fillCircle(cx, y, cur ? 10 : 8);
    g.lineStyle(2, done ? C.accent : cur ? C.accent : C.cellLine, 1);
    g.strokeCircle(cx, y, cur ? 12 : 8);
  }
  c.add(txt(scene, x + ROUNDS * step, y + 26, 'TOP 1', 13, C.accentStr, { fontStyle: 'bold' }).setOrigin(0.5, 0.5));
  return c;
}

/** Présentation de chaque type de carte de zone. */
export const CARD_INFO: Record<CardType, { name: string; color: number; hex: string; icon: string }> = {
  squad: { name: 'Squad', color: 0xe5484d, hex: '#ff6b6b', icon: 'ic-t-essaim' },
  solo: { name: 'Solo', color: 0xff8c1a, hex: '#ffa64d', icon: 'ic-p-contrat' },
  caisse: { name: 'Caisse', color: 0x5fbf6a, hex: '#7ddc86', icon: 'ic-p-caisse' },
  shop: { name: 'Boutique', color: 0x4fa3ff, hex: '#7dbcff', icon: 'ic-p-marchand' },
  // Violet, liseré or (voir EPIC_GOLD).
  caisse_epique: { name: 'Caisse épique', color: 0x9b51e0, hex: '#c08cff', icon: 'ic-p-caisse' },
};
/** Or des bordures et reflets de la caisse épique. */
export const EPIC_GOLD = 0xf2c94c;

/** Bouton rond à icône (menu, retour…) centré en (x, y). */
export function iconButton(scene: Scene, x: number, y: number, icon: string, onClick: () => void, r = 30) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4);
  g.fillRoundedRect(-r, -r + 4, 2 * r, 2 * r, 14);
  g.fillStyle(0x2c3224, 1);
  g.fillRoundedRect(-r, -r, 2 * r, 2 * r, 14);
  g.lineStyle(2, 0x4a5240, 1);
  g.strokeRoundedRect(-r, -r, 2 * r, 2 * r, 14);
  const ic = scene.add.image(0, 0, icon).setDisplaySize(r, r).setTint(0xece8d8);
  const z = scene.add.zone(0, 0, 2 * r + 12, 2 * r + 12).setInteractive({ useHandCursor: true });
  z.on('pointerdown', () => c.setScale(0.92));
  z.on('pointerout', () => c.setScale(1));
  z.on('pointerup', () => {
    c.setScale(1);
    onClick();
  });
  c.add([g, ic, z]);
  return c;
}
