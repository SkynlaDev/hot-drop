// Mode Zombie : directeur des vagues. Combien de zombies, de quels types, quand les élites, hordes et boss.
// Logique pure, en fonction du temps écoulé (s).
import { BOSS_TIMES, MAX_ZOMBIES, RUN_TIME, ZType } from './data';

const min = (t: number) => t / 60;

/** Multiplicateur de PV des zombies (le temps les rend plus coriaces ; plus vite en mode sans fin). */
export function hpMul(t: number): number {
  const m = min(t);
  const extra = t > RUN_TIME ? 0.12 * min(t - RUN_TIME) ** 2 : 0;
  return 1 + 0.1 * m + 0.03 * m * m + extra;
}

/** Multiplicateur des dégâts des zombies. */
export function dmgMul(t: number): number {
  return 1 + 0.06 * min(t) + (t > RUN_TIME ? 0.1 * min(t - RUN_TIME) : 0);
}

/** Nombre de zombies que le directeur cherche à maintenir en vie. */
export function targetCount(t: number): number {
  const m = min(t);
  return Math.min(MAX_ZOMBIES, Math.round(14 + 16 * m + 1.4 * m * m));
}

/** Apparitions par seconde au plus (pour rejoindre la cible). */
export function spawnRate(t: number): number {
  return 2.5 + 1.6 * min(t);
}

/** Poids de chaque type selon le temps. */
export function typeWeights(t: number): [ZType, number][] {
  const m = min(t);
  const w: [ZType, number][] = [['marcheur', 10]];
  if (m >= 0.75) w.push(['coureur', Math.min(6, 1.5 + 1.5 * (m - 0.75))]);
  if (m >= 2) w.push(['cracheur', Math.min(3, 1 + 0.5 * (m - 2))]);
  if (m >= 3.5) w.push(['brute', Math.min(2.5, 0.6 + 0.4 * (m - 3.5))]);
  if (m >= 4.5) w.push(['kamikaze', Math.min(3, 1 + 0.5 * (m - 4.5))]);
  return w;
}

export function pickType(t: number, r: number): ZType {
  const w = typeWeights(t);
  const total = w.reduce((s, [, x]) => s + x, 0);
  let x = r * total;
  for (const [type, k] of w) {
    x -= k;
    if (x < 0) return type;
  }
  return w[w.length - 1][0];
}

export type WaveEvent =
  | { kind: 'boss'; tier: number }
  | { kind: 'elite' }
  | { kind: 'horde'; count: number; type: ZType };

/** Heures des boss : 3, 6, 9 min, puis toutes les 2 min 30 en mode sans fin. */
export function bossTimes(upTo: number): number[] {
  const out = [...BOSS_TIMES];
  for (let t = RUN_TIME + 150; t <= upTo; t += 150) out.push(t);
  return out;
}

/** Événements dont l'heure tombe dans ]t0, t1]. */
export function waveEvents(t0: number, t1: number): WaveEvent[] {
  const out: WaveEvent[] = [];
  const crossed = (at: number) => at > t0 && at <= t1;
  bossTimes(t1).forEach((at, i) => crossed(at) && out.push({ kind: 'boss', tier: i + 1 }));
  // Élites : toutes les 40 s à partir d'une minute, toutes les 20 s en mode sans fin.
  for (let at = 60; at <= t1; at += at >= RUN_TIME ? 20 : 40) if (crossed(at)) out.push({ kind: 'elite' });
  // Hordes : un anneau de zombies qui se referme, à 1 min 30 puis toutes les 3 min.
  for (let at = 90; at <= t1; at += 180) {
    if (!crossed(at)) continue;
    const m = min(at);
    out.push({ kind: 'horde', count: Math.round(24 + 6 * m), type: m >= 4 ? 'coureur' : 'marcheur' });
  }
  return out;
}

/** PV du boss d'un rang donné (rang 1 à 3 en partie normale). */
export function bossHp(tier: number): number {
  return Math.round(2000 * tier ** 1.7);
}
