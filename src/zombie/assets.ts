// Mode Zombie : chargement des sprites PixelLab (public/art/zombie) et textures dessinées en code
// (balles, gemmes, objets, effets ; et sprites de repli si une image manque).
import Phaser from 'phaser';
import { P } from '../ui/palette';
import { TITLE_FONT } from '../config';
import type { ZType } from './data';

/** Sprites des zombies : clé, fichier, pieds (en px du sprite), échelle d'affichage. */
export const Z_ART: Record<string, { file: string; feetX: number; feetY: number; size: number }> = {
  'z-marcheur1': { file: 'marcheur1', feetX: 34, feetY: 63, size: 64 },
  'z-marcheur2': { file: 'marcheur2', feetX: 34, feetY: 63, size: 64 },
  'z-marcheur3': { file: 'marcheur3', feetX: 34, feetY: 63, size: 64 },
  'z-marcheur4': { file: 'marcheur4', feetX: 34, feetY: 63, size: 64 },
  'z-coureur': { file: 'coureur', feetX: 34, feetY: 63, size: 64 },
  'z-cracheur': { file: 'cracheur', feetX: 34, feetY: 63, size: 64 },
  'z-kamikaze': { file: 'kamikaze', feetX: 34, feetY: 63, size: 64 },
  'z-brute': { file: 'brute', feetX: 48, feetY: 86, size: 96 },
  'z-boss': { file: 'boss', feetX: 66, feetY: 125, size: 128 },
};

/** Texture d'un zombie selon son type (variante de marcheur choisie par la phase). */
export function zTexture(type: ZType, variant: number): string {
  if (type === 'marcheur') return `z-marcheur${1 + (variant % 4)}`;
  return `z-${type}`;
}

/** Échelle d'affichage d'un type (le sprite fait 64, 96 ou 128 px). */
export const Z_SCALE: Record<ZType, number> = { marcheur: 1.25, coureur: 1.2, cracheur: 1.25, kamikaze: 1.35, brute: 1.35, boss: 1.6 };

export const GROUND = 'z-ground';

export function preloadZombieArt(load: Phaser.Loader.LoaderPlugin) {
  for (const [key, a] of Object.entries(Z_ART)) if (!load.scene.textures.exists(key)) load.image(key, `art/zombie/${a.file}.png`);
  if (!load.scene.textures.exists(GROUND)) load.image(GROUND, 'art/zombie/sol.png');
  load.once(Phaser.Loader.Events.COMPLETE, () => {
    for (const key of [...Object.keys(Z_ART), GROUND]) {
      const tex = load.scene.textures.get(key);
      if (tex.key !== '__MISSING') tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  });
}

/** Dessine une texture une seule fois. */
function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({}, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** Zombie de repli dessiné en code (si le PNG manque) : silhouette verdâtre bras tendus. */
function fallbackZombie(scene: Phaser.Scene, key: string, size: number, body: number) {
  if (scene.textures.exists(key) && scene.textures.get(key).key !== '__MISSING') return;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const k = size / 64;
  make(scene, key, size, size, (g) => {
    g.fillStyle(P.nuit, 1);
    g.fillRect(22 * k, 14 * k, 20 * k, 30 * k);
    g.fillStyle(body, 1);
    g.fillRect(24 * k, 16 * k, 16 * k, 26 * k); // torse
    g.fillStyle(0x7d8f6a, 1);
    g.fillRect(25 * k, 4 * k, 14 * k, 13 * k); // tête
    g.fillRect(38 * k, 20 * k, 18 * k, 5 * k); // bras tendus
    g.fillStyle(P.danger, 1);
    g.fillRect(34 * k, 8 * k, 3 * k, 3 * k); // œil
    g.fillStyle(P.toileSombre, 1);
    g.fillRect(25 * k, 42 * k, 6 * k, 21 * k);
    g.fillRect(33 * k, 42 * k, 6 * k, 21 * k);
  });
}

/** Toutes les textures en code du mode (idempotent). */
export function makeZombieTextures(scene: Phaser.Scene) {
  for (const [key, a] of Object.entries(Z_ART)) {
    const body = key.includes('kamikaze') ? 0x6f8a3a : key.includes('brute') ? P.toile : key.includes('boss') ? P.braiseSombre : 0x4f5a44;
    fallbackZombie(scene, key, a.size, body);
  }
  // Sol de repli : asphalte fissuré.
  if (!scene.textures.exists(GROUND) || scene.textures.get(GROUND).key === '__MISSING') {
    if (scene.textures.exists(GROUND)) scene.textures.remove(GROUND);
    make(scene, GROUND, 256, 256, (g) => {
      const rnd = new Phaser.Math.RandomDataGenerator(['sol']);
      g.fillStyle(0x2a2530, 1);
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 900; i++) {
        g.fillStyle(rnd.pick([0x241f29, 0x302a36, 0x2d2832, 0x27222c]), 1);
        g.fillRect(rnd.between(0, 255), rnd.between(0, 255), rnd.between(2, 6), rnd.between(2, 6));
      }
      g.lineStyle(2, 0x1b171f, 1);
      for (let i = 0; i < 7; i++) {
        let x = rnd.between(0, 255);
        let y = rnd.between(0, 255);
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += rnd.between(-22, 22);
          y += rnd.between(-22, 22);
          g.lineTo(x, y);
        }
        g.strokePath();
      }
    });
  }
  make(scene, 'zb-shadow', 48, 16, (g) => {
    g.fillStyle(P.noir, 0.38);
    g.fillEllipse(24, 8, 46, 14);
  });
  make(scene, 'zb-bullet', 18, 6, (g) => {
    g.fillStyle(P.orange, 0.5);
    g.fillRoundedRect(0, 0, 18, 6, 3);
    g.fillStyle(P.orangePale, 1);
    g.fillRoundedRect(6, 1, 12, 4, 2);
  });
  make(scene, 'zb-crit', 22, 8, (g) => {
    g.fillStyle(P.danger, 0.6);
    g.fillRoundedRect(0, 0, 22, 8, 4);
    g.fillStyle(P.blanc, 1);
    g.fillRoundedRect(7, 2, 15, 4, 2);
  });
  make(scene, 'zb-drone-bullet', 12, 5, (g) => {
    g.fillStyle(P.precision, 0.6);
    g.fillRoundedRect(0, 0, 12, 5, 2);
    g.fillStyle(P.precisionClaire, 1);
    g.fillRoundedRect(4, 1, 8, 3, 1);
  });
  make(scene, 'zb-spit', 18, 18, (g) => {
    g.fillStyle(P.gaz, 0.35);
    g.fillCircle(9, 9, 9);
    g.fillStyle(P.gaz, 1);
    g.fillCircle(9, 9, 5);
    g.fillStyle(P.blanc, 0.8);
    g.fillCircle(7, 7, 2);
  });
  // Plaques d'XP (« gemmes ») : losanges de couleur selon la valeur.
  const gem = (key: string, s: number, c: number, light: number) =>
    make(scene, key, s + 4, s + 4, (g) => {
      const m = (s + 4) / 2;
      g.fillStyle(P.nuit, 1);
      g.fillPoints([new Phaser.Math.Vector2(m, 0), new Phaser.Math.Vector2(s + 4, m), new Phaser.Math.Vector2(m, s + 4), new Phaser.Math.Vector2(0, m)], true);
      g.fillStyle(c, 1);
      g.fillPoints([new Phaser.Math.Vector2(m, 2), new Phaser.Math.Vector2(s + 2, m), new Phaser.Math.Vector2(m, s + 2), new Phaser.Math.Vector2(2, m)], true);
      g.fillStyle(light, 1);
      g.fillPoints([new Phaser.Math.Vector2(m, 4), new Phaser.Math.Vector2(m + s / 4, m), new Phaser.Math.Vector2(m, m), new Phaser.Math.Vector2(m - s / 4, m)], true);
    });
  gem('zb-gem1', 12, P.precision, P.precisionClaire);
  gem('zb-gem2', 15, P.soin, P.soinClair);
  gem('zb-gem3', 18, P.orange, P.orangePale);
  gem('zb-gem4', 24, P.violet, P.violetClair);
  make(scene, 'zb-dot', 8, 8, (g) => {
    g.fillStyle(P.blanc, 1);
    g.fillCircle(4, 4, 4);
  });
  make(scene, 'zb-px', 4, 4, (g) => {
    g.fillStyle(P.blanc, 1);
    g.fillRect(0, 0, 4, 4);
  });
  make(scene, 'zb-glow', 64, 64, (g) => {
    for (let r = 32; r > 0; r -= 2) {
      g.fillStyle(P.blanc, 0.06);
      g.fillCircle(32, 32, r);
    }
  });
  make(scene, 'zb-ring', 128, 128, (g) => {
    g.lineStyle(6, P.blanc, 1);
    g.strokeCircle(64, 64, 60);
  });
  make(scene, 'zb-blood', 40, 24, (g) => {
    g.fillStyle(0x3d1a1e, 0.9);
    g.fillEllipse(20, 12, 34, 16);
    g.fillEllipse(8, 8, 10, 6);
    g.fillEllipse(33, 17, 8, 6);
  });
  make(scene, 'zb-goo', 40, 24, (g) => {
    g.fillStyle(0x4f6a22, 0.85);
    g.fillEllipse(20, 12, 36, 18);
    g.fillStyle(P.gaz, 0.5);
    g.fillEllipse(16, 10, 12, 6);
  });
  make(scene, 'zb-scorch', 64, 40, (g) => {
    g.fillStyle(0x0f0d13, 0.55);
    g.fillEllipse(32, 20, 60, 34);
    g.fillStyle(0x0f0d13, 0.4);
    g.fillEllipse(32, 20, 40, 22);
  });
  make(scene, 'zb-mine', 26, 14, (g) => {
    g.fillStyle(P.nuit, 1);
    g.fillEllipse(13, 8, 26, 12);
    g.fillStyle(P.acier, 1);
    g.fillEllipse(13, 6, 22, 9);
    g.fillStyle(P.danger, 1);
    g.fillCircle(13, 5, 2.5);
  });
  make(scene, 'zb-marker', 64, 64, (g) => {
    g.lineStyle(4, P.danger, 1);
    g.strokeCircle(32, 32, 28);
    g.lineBetween(32, 0, 32, 64);
    g.lineBetween(0, 32, 64, 32);
  });
  make(scene, 'zb-drone', 36, 20, (g) => {
    g.fillStyle(P.nuit, 1);
    g.fillRect(4, 8, 28, 8);
    g.fillStyle(P.acier, 1);
    g.fillRect(6, 9, 24, 5);
    g.fillStyle(P.acierClair, 1);
    g.fillRect(0, 3, 12, 3);
    g.fillRect(24, 3, 12, 3);
    g.fillStyle(P.precision, 1);
    g.fillRect(16, 14, 4, 4);
  });
  make(scene, 'zb-turret', 44, 44, (g) => {
    g.fillStyle(P.nuit, 1);
    g.fillTriangle(6, 44, 22, 22, 38, 44);
    g.fillStyle(P.acierSombre, 1);
    g.fillTriangle(10, 42, 22, 24, 34, 42);
    g.fillStyle(P.nuit, 1);
    g.fillRect(10, 10, 24, 16);
    g.fillStyle(P.toile2, 1);
    g.fillRect(12, 12, 20, 12);
    g.fillStyle(P.acier, 1);
    g.fillRect(28, 16, 16, 4);
  });
  make(scene, 'zb-grenade', 14, 16, (g) => {
    g.fillStyle(P.nuit, 1);
    g.fillEllipse(7, 9, 14, 14);
    g.fillStyle(P.toile, 1);
    g.fillEllipse(7, 9, 10, 11);
    g.fillStyle(P.acierClair, 1);
    g.fillRect(5, 0, 4, 4);
  });
  make(scene, 'zb-shell', 10, 22, (g) => {
    g.fillStyle(P.nuit, 1);
    g.fillRoundedRect(0, 0, 10, 22, 4);
    g.fillStyle(P.or, 1);
    g.fillRoundedRect(2, 2, 6, 16, 3);
  });
  // Objets au sol : trousse, caisse, aimant, frappe aérienne.
  make(scene, 'zb-medkit', 34, 28, (g) => {
    g.fillStyle(P.nuit, 1);
    g.fillRoundedRect(0, 2, 34, 26, 4);
    g.fillStyle(P.blanc, 1);
    g.fillRoundedRect(2, 4, 30, 22, 3);
    g.fillStyle(P.danger, 1);
    g.fillRect(14, 8, 6, 14);
    g.fillRect(10, 12, 14, 6);
  });
  make(scene, 'zb-caisse', 40, 34, (g) => {
    g.fillStyle(P.nuit, 1);
    g.fillRect(0, 2, 40, 32);
    g.fillStyle(P.cuir, 1);
    g.fillRect(2, 4, 36, 28);
    g.fillStyle(P.or, 1);
    g.fillRect(2, 14, 36, 6);
    g.fillStyle(P.cuirClair, 1);
    g.fillRect(4, 6, 32, 3);
  });
  make(scene, 'zb-aimant', 30, 30, (g) => {
    g.lineStyle(8, P.nuit, 1);
    g.beginPath();
    g.arc(15, 14, 10, Math.PI, 0, false);
    g.strokePath();
    g.lineStyle(6, P.danger, 1);
    g.beginPath();
    g.arc(15, 14, 10, Math.PI, 0, false);
    g.strokePath();
    g.fillStyle(P.acierClair, 1);
    g.fillRect(2, 14, 6, 10);
    g.fillRect(22, 14, 6, 10);
  });
  make(scene, 'zb-frappe', 30, 30, (g) => {
    g.fillStyle(P.nuit, 1);
    g.fillCircle(15, 15, 15);
    g.fillStyle(P.or, 1);
    g.fillCircle(15, 15, 12);
    g.fillStyle(P.nuit, 1);
    g.fillTriangle(15, 5, 9, 19, 21, 19);
    g.fillRect(13, 19, 4, 6);
  });
  // Joystick virtuel
  make(scene, 'zb-stick-base', 180, 180, (g) => {
    g.fillStyle(P.nuit, 0.35);
    g.fillCircle(90, 90, 88);
    g.lineStyle(4, P.texte, 0.35);
    g.strokeCircle(90, 90, 86);
  });
  make(scene, 'zb-stick-knob', 84, 84, (g) => {
    g.fillStyle(P.texte, 0.5);
    g.fillCircle(42, 42, 40);
    g.lineStyle(4, P.blanc, 0.6);
    g.strokeCircle(42, 42, 38);
  });
}

/** Hauteur des chiffres des nombres de dégâts (px de texture) et largeur de chaque caractère. */
export const DIGIT_H = 32;
export const DIGIT_W: Record<string, number> = {};

/**
 * Chiffres 0-9, « + » et « - » au pochoir, blancs cernés de noir (teintés à l'affichage). Rendus une fois
 * dans des canevas à part, puis réutilisés par toutes les parties.
 */
export function makeDigitTextures(scene: Phaser.Scene) {
  for (const ch of '0123456789+-') {
    const key = `zd-${ch}`;
    if (scene.textures.exists(key)) {
      DIGIT_W[ch] = scene.textures.get(key).getSourceImage().width - 6;
      continue;
    }
    const t = scene.make.text({ x: 0, y: 0, text: ch, style: { fontFamily: TITLE_FONT, fontSize: '28px', color: '#ffffff', stroke: '#000000', strokeThickness: 6 } }, false);
    const c = document.createElement('canvas');
    c.width = Math.ceil(t.width);
    c.height = DIGIT_H + 6;
    c.getContext('2d')!.drawImage(t.canvas, 0, Math.round((c.height - t.height) / 2));
    t.destroy();
    scene.textures.addCanvas(key, c);
    DIGIT_W[ch] = c.width - 6;
  }
}
