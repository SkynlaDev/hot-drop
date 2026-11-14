// Mode Zombie : décisions sonores pures (testables) : intensité de la musique selon la menace, volumes des
// couches, cadence des grognements, limiteur de voix (pas de cacophonie à 250 zombies).

export interface Threat {
  /** Zombies en vie. */
  zombies: number;
  /** Un Colosse est là. */
  boss: boolean;
  /** Secondes depuis la dernière horde (Infinity : aucune). */
  sinceHorde: number;
  /** PV / PV max du soldat. */
  hpFrac: number;
}

/** Durée pendant laquelle une horde tient la musique au plus fort (s), puis elle redescend sur autant. */
export const HORDE_HOLD = 18;
export const HORDE_FALL = 14;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Menace perçue, 0..1 : la foule fait monter doucement, une horde ou le Colosse poussent au maximum. */
export function intensity(t: Threat): number {
  let k = 0.1 + 0.45 * clamp01(t.zombies / 220);
  if (t.sinceHorde < HORDE_HOLD) k = Math.max(k, 1);
  else if (t.sinceHorde < HORDE_HOLD + HORDE_FALL) k = Math.max(k, 1 - (0.5 * (t.sinceHorde - HORDE_HOLD)) / HORDE_FALL);
  if (t.boss) k = 1;
  if (t.hpFrac < 0.3) k += 0.15;
  return clamp01(k);
}

/** Volumes des deux couches de la partie pour une intensité : « tension » toujours, « menace » au-delà de 0,5. */
export function layerGains(k: number): { tension: number; menace: number } {
  const menace = smooth(0.5, 0.9, k);
  return { tension: 0.85 + 0.15 * (1 - menace), menace };
}

/** Grognements par seconde selon le nombre de zombies à l'écran (racine : la foule ne devient pas un vacarme). */
export function groanRate(onScreen: number): number {
  if (onScreen <= 0) return 0;
  return Math.min(1.1, 0.14 * Math.sqrt(onScreen));
}

/** Règle d'un type de son : au plus `max` en même temps, au moins `gap` s entre deux départs. */
export interface VoiceRule {
  max: number;
  gap: number;
}

/**
 * Limiteur de voix : un plafond global, et par catégorie un plafond et un écart minimal. `now` en secondes
 * (horloge du contexte audio). Chaque départ accepté doit être suivi d'un `end` de la même catégorie.
 */
export class VoiceLimiter {
  private live = new Map<string, number>();
  private last = new Map<string, number>();
  private total = 0;

  constructor(readonly maxTotal: number, readonly rules: Record<string, VoiceRule>) {}

  tryStart(kind: string, now: number): boolean {
    const r = this.rules[kind] ?? { max: 2, gap: 0.05 };
    if (this.total >= this.maxTotal) return false;
    if ((this.live.get(kind) ?? 0) >= r.max) return false;
    if (now - (this.last.get(kind) ?? -Infinity) < r.gap) return false;
    this.live.set(kind, (this.live.get(kind) ?? 0) + 1);
    this.last.set(kind, now);
    this.total++;
    return true;
  }

  end(kind: string) {
    const n = this.live.get(kind) ?? 0;
    if (n <= 0) return;
    this.live.set(kind, n - 1);
    this.total--;
  }

  playing(kind?: string): number {
    return kind ? this.live.get(kind) ?? 0 : this.total;
  }
}
