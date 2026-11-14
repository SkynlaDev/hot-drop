// Mode Zombie : cadence des animations de marche, liée à la vitesse réelle de chaque personnage.
// Pur (sans Phaser) : testable. L'affichage (anim.ts) lit l'image à montrer pour chaque case de réserve.

/** Images d'une marche (feuilles de public/art/zombie/anim). */
export const WALK_FRAMES = 8;
/** Distance parcourue (px du monde) par image de marche, pour un sprite de 64 px affiché à l'échelle 1. */
export const STRIDE_PX = 5;
/** Cadence plancher quand on bouge (les gros, très lents, restent vivants) et plafond (le coureur reste lisible). */
export const MIN_FPS = 5;
export const MAX_FPS = 18;
/** En dessous de cette vitesse (px/s), on est arrêté : l'image ne change plus. */
export const STILL_SPEED = 6;
/** Au-delà de ce saut (px) en une image, c'est une téléportation (zombie replacé, case réutilisée). */
const TELEPORT = 80;

/** Images de marche par seconde pour une vitesse (px/s), une taille de sprite (px) et une échelle d'affichage. */
export function walkFps(speed: number, size: number, scale: number): number {
  if (speed < STILL_SPEED) return 0;
  const raw = speed / (STRIDE_PX * (size / 64) * scale);
  return Math.max(MIN_FPS, Math.min(MAX_FPS, raw));
}

/**
 * Suivi de la marche de N personnages (cases de réserve) : vitesse lissée à partir des positions successives,
 * et phase de l'animation. Tableaux typés, aucune allocation par image.
 */
export class GaitTracker {
  private px: Float32Array;
  private py: Float32Array;
  private v: Float32Array;
  private ph: Float32Array;
  private ids: Int32Array;

  constructor(readonly n: number) {
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.v = new Float32Array(n);
    this.ph = new Float32Array(n);
    this.ids = new Int32Array(n).fill(-1);
  }

  /**
   * Avance la case `i` (personnage `id`, à x, y) de `dt` secondes ; renvoie l'image de marche à montrer
   * (0..WALK_FRAMES-1). Un nouveau personnage dans la case part d'une phase au hasard (déterministe par id)
   * pour que la horde ne marche pas au pas.
   */
  step(i: number, id: number, x: number, y: number, dt: number, size: number, scale: number): number {
    if (this.ids[i] !== id) {
      this.ids[i] = id;
      this.px[i] = x;
      this.py[i] = y;
      this.v[i] = 0;
      this.ph[i] = ((id * 2.618) % 1) * WALK_FRAMES;
      return Math.floor(this.ph[i]) % WALK_FRAMES;
    }
    const dx = x - this.px[i];
    const dy = y - this.py[i];
    this.px[i] = x;
    this.py[i] = y;
    const d = Math.hypot(dx, dy);
    if (dt > 0 && d < TELEPORT) {
      const inst = d / dt;
      // Lissage (constante ≈ 0,1 s) : le recul d'une balle ne fait pas tressauter les jambes.
      this.v[i] += (inst - this.v[i]) * Math.min(1, dt * 10);
    }
    this.ph[i] = (this.ph[i] + walkFps(this.v[i], size, scale) * dt) % WALK_FRAMES;
    return Math.floor(this.ph[i]) % WALK_FRAMES;
  }

  /** Vitesse lissée de la case `i` (px/s). */
  speed(i: number): number {
    return this.v[i];
  }

  /** Oublie la case (le prochain personnage repartira de zéro). */
  forget(i: number) {
    this.ids[i] = -1;
  }
}
