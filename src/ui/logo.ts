// Logo du jeu : « HOT DROP » en lettres épaisses (blanc / dégradé orange), contour noir, ombre portée,
// et une bande « BATTLE ROYALE · SAC À DOS ». Dessiné en code : le texte reste net à toutes les tailles.
import Phaser from 'phaser';
import { FONT } from '../config';

/** Texte du logo : remplissage en dégradé vertical, contour noir épais. */
function word(scene: Phaser.Scene, x: number, y: number, s: string, size: number, top: string, bottom: string): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, s, {
    fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold italic', color: top, resolution: 2,
    stroke: '#0b0c0e', strokeThickness: Math.round(size * 0.09),
    padding: { left: 10, right: Math.round(size * 0.3), top: 6, bottom: 6 },
  });
  const grad = t.context.createLinearGradient(0, t.height * 0.2, 0, t.height * 0.85);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  t.setFill(grad);
  return t;
}

/**
 * Logo centré en (x, y) : y est la ligne de base de « DROP ». Renvoie le conteneur (hauteur ≈ 1,9 × size).
 */
export function drawLogo(scene: Phaser.Scene, x: number, y: number, size = 150): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y);
  const mk = (s: string, dy: number, top: string, bottom: string) => {
    // Ombre portée : la même lettre, décalée, en brun très sombre.
    const sh = word(scene, 0, dy, s, size, '#2a1204', '#2a1204').setOrigin(0.5, 1).setPosition(size * 0.05, dy + size * 0.07);
    const t = word(scene, 0, dy, s, size, top, bottom).setOrigin(0.5, 1);
    root.add([sh, t]);
    return t;
  };
  mk('HOT', -size * 0.78, '#ffffff', '#c9ccd2');
  mk('DROP', 0, '#ffd27a', '#ff6a00');

  // Bande sous le titre : trait orange, accroche, trait orange.
  const tag = scene.add.text(0, size * 0.16, 'BATTLE ROYALE · SAC À DOS', {
    fontFamily: FONT, fontSize: `${Math.round(size * 0.17)}px`, fontStyle: 'bold', color: '#e9e2cf', resolution: 2,
  }).setOrigin(0.5, 0.5);
  tag.setLetterSpacing(Math.round(size * 0.03));
  const bar = Math.round(size * 0.36);
  const gap = 14;
  const g = scene.add.graphics();
  g.fillStyle(0xff8c1a, 1);
  g.fillRect(-tag.width / 2 - gap - bar, size * 0.16 - 2, bar, 4);
  g.fillRect(tag.width / 2 + gap, size * 0.16 - 2, bar, 4);
  root.add([g, tag]);
  return root;
}
