// Mode Zombie : l'extraction. À 10:00, une zone d'atterrissage apparaît à distance ; il faut l'atteindre et y
// tenir quelques secondes pendant que la horde redouble. Logique pure (sans Phaser).
import type { GameMap } from './map';

export const LZ = {
  /** Rayon de la zone (px). */
  radius: 110,
  /** Secondes à tenir dans la zone. */
  hold: 10,
  /** Distance d'apparition au soldat (px). */
  distMin: 950,
  distMax: 1350,
  /** Hors de la zone, la progression redescend (par seconde). */
  decay: 0.5,
  /** Pendant l'attente : apparitions ×3, et des zombies en plus visés. */
  spawnMul: 3,
  extraTarget: 70,
};

export interface Landing {
  /** La zone existe (à partir de 10:00, jusqu'à l'extraction). */
  active: boolean;
  x: number;
  y: number;
  /** Secondes tenues (0 à LZ.hold). */
  t: number;
  /** Le soldat est dans la zone. */
  inside: boolean;
  /** Secondes depuis l'apparition. */
  age: number;
}

export function newLanding(): Landing {
  return { active: false, x: 0, y: 0, t: 0, inside: false, age: 0 };
}

/**
 * Choisit l'emplacement : un disque sans obstacle, à distance du soldat. Essais en spirale (angle d'or) ;
 * repli : l'essai le plus dégagé.
 */
export function placeLanding(map: GameMap | null, px: number, py: number, rng: () => number): [number, number] {
  const a0 = rng() * Math.PI * 2;
  let fx = px + Math.cos(a0) * LZ.distMin;
  let fy = py + Math.sin(a0) * LZ.distMin;
  if (!map) return [fx, fy];
  for (const pad of [LZ.radius, LZ.radius * 0.7, 64]) {
    for (let k = 0; k < 160; k++) {
      const a = a0 + k * 2.39996;
      const d = LZ.distMin + ((k * 0.618) % 1) * (LZ.distMax - LZ.distMin);
      const x = px + Math.cos(a) * d;
      const y = py + Math.sin(a) * d;
      if (map.areaFree(x, y, pad)) return [x, y];
      if (k === 0) [fx, fy] = map.freeSpot(x, y);
    }
  }
  return [fx, fy];
}

/** Ouvre la zone. */
export function openLanding(l: Landing, x: number, y: number) {
  l.active = true;
  l.x = x;
  l.y = y;
  l.t = 0;
  l.age = 0;
  l.inside = false;
}

/** Avance l'attente ; renvoie true quand l'extraction est faite. */
export function stepLanding(l: Landing, px: number, py: number, dt: number): boolean {
  if (!l.active) return false;
  l.age += dt;
  l.inside = (px - l.x) ** 2 + (py - l.y) ** 2 < LZ.radius * LZ.radius;
  if (l.inside) l.t = Math.min(LZ.hold, l.t + dt);
  else l.t = Math.max(0, l.t - LZ.decay * dt);
  return l.t >= LZ.hold;
}
