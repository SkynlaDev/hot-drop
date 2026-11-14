// Mode Zombie : petits outils d'interface partagés par les scènes du mode.
import Phaser from 'phaser';
import { P } from '../ui/palette';
import { WeaponId } from './data';
import { itemSpriteKey } from '../art';

/** « 4:07 » */
export function fmtTime(s: number): string {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** Image (sprite d'objet ou icône) ajustée dans une boîte de `size` px, centrée en (x, y). */
export function fitImage(scene: Phaser.Scene, key: string, x: number, y: number, size: number, tint?: number, maxH = size) {
  const k = scene.textures.exists(key) ? key : 'ic-bolt';
  const img = scene.add.image(x, y, k);
  const s = Math.min(size / img.width, maxH / img.height, size / img.height);
  img.setScale(s);
  // Les icônes vectorielles sont monochromes : on les teinte ; les sprites restent tels quels.
  if (k.startsWith('ic-')) img.setTint(tint ?? P.texte);
  return img;
}

export const weaponSprite = (w: WeaponId) => itemSpriteKey(w);

/** Barre horizontale : fond, remplissage, liseré. */
export function drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number, color: number, back: number = P.nuit) {
  g.fillStyle(P.noir, 0.5);
  g.fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle(back, 1);
  g.fillRect(x, y, w, h);
  g.fillStyle(color, 1);
  g.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
  g.fillStyle(P.blanc, 0.18);
  g.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, Math.max(1, h * 0.35));
}

/** Pastilles de niveau (●●●○○). */
export function pips(g: Phaser.GameObjects.Graphics, x: number, y: number, level: number, max: number, color: number = P.or, size = 8, gap = 4) {
  for (let i = 0; i < max; i++) {
    g.fillStyle(P.nuit, 1);
    g.fillRect(x + i * (size + gap) - 1, y - 1, size + 2, size + 2);
    g.fillStyle(i < level ? color : P.trait, 1);
    g.fillRect(x + i * (size + gap), y, size, size);
  }
}
