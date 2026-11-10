// Une zone de la run : lieux sur une carte, gaz qui se resserre vers le point d'exfiltration.
import { Rng, rngFor } from './rng';
import type { NodeType } from './run';
import { BOSS_THREATS, THREATS, Threat } from '../data/threats';
import { BIOMES, BiomeId, FAMILY_PLACES, LOOT_FAMILIES } from '../data/biomes';
import type { Family } from '../data/items';

export interface Poi {
  id: number;
  x: number;
  y: number;
  type: Exclude<NodeType, 'boss'>;
  name: string;
  /** Menaces annoncées (lieux de combat uniquement). */
  threats: Threat[];
  /** Famille de butin annoncée (combats et caisses). */
  family?: Family;
}

export interface Zone {
  biome: BiomeId;
  /** Position de la zone dans la run (0, 1 ou 2). */
  stage: number;
  pois: Poi[];
  /** Menaces du gardien de l'exfiltration. */
  exfilThreats: Threat[];
  exfil: { x: number; y: number };
  visited: number[];
  /** Lieu actuel : -1 = pas encore largué, EXFIL_ID = point d'exfiltration. */
  pos: number;
}

/** Nombre de tours d'une zone : 6 lieux puis l'exfiltration. */
export const TURNS = 7;
export const STAGES = 3;
/** Tour (index 0) à partir duquel l'extraction anticipée est possible. */
export const EARLY_EXFIL_TURN = 3;
export const MAP_SIZE = 1000;
export const MOVE_RANGE = 340;
export const EXFIL_ID = -2;
const POI_COUNT = 20;
const MIN_SPACING = 112;
/** Distance minimale entre un lieu et le point d'exfiltration. */
const EXFIL_CLEAR = 95;
/** Rayon de la zone sûre au dernier tour. */
const GAS_MIN = 220;
/** Lieux placés d'office près de l'exfiltration, pour qu'il reste des choix en fin de zone. */
const CORE_POIS = 8;
/** Nombre minimal de lieux proposés à chaque tour. */
export const MIN_CHOICES = 3;

/** Menaces possibles selon la position de la zone : Assaut n'apparaît qu'à partir de la 2e zone. */
export function stageThreats(stage: number): Threat[] {
  return stage === 0 ? THREATS.filter((t) => t !== 'assaut') : [...THREATS];
}

/** Menaces du gardien : Cdt Kesh (Assaut + une menace du biome) en 3e zone, sinon une menace du biome. */
export function guardianThreats(biome: BiomeId, stage: number): Threat[] {
  const allowed = stageThreats(stage);
  const own = BIOMES[biome].threats.filter((t) => allowed.includes(t));
  if (stage === STAGES - 1) return [...BOSS_THREATS, ...own.filter((t) => !BOSS_THREATS.includes(t)).slice(0, 1)];
  return own.slice(0, 1);
}

/** Rayon de la zone sûre au moment d'arriver au tour `turn` (0 = largage). */
export function gasRadius(turn: number): number {
  return GAS_MIN + (580 - GAS_MIN) * (1 - Math.min(turn, TURNS - 1) / (TURNS - 1));
}

export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function shuffle<T>(rng: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function genZone(seed: number, biome: BiomeId = 'banlieue', stage = 0): Zone {
  const rng = rngFor(seed, 'zone', stage);
  const exfil = { x: 500 + (rng() - 0.5) * 240, y: 500 + (rng() - 0.5) * 240 };
  const pts: { x: number; y: number }[] = [];
  for (let tries = 0; tries < 6000 && pts.length < POI_COUNT; tries++) {
    const a = rng() * Math.PI * 2;
    const core = pts.length < CORE_POIS && tries < 3000;
    const r = Math.sqrt(rng()) * (core ? gasRadius(TURNS - 2) - 10 : 440);
    const c = core ? exfil : { x: 500, y: 500 };
    const p = { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
    if (core && dist(p, { x: 500, y: 500 }) > 460) continue;
    if (dist(p, exfil) < EXFIL_CLEAR) continue;
    if (pts.some((q) => dist(p, q) < MIN_SPACING)) continue;
    pts.push(p);
  }
  const types = shuffle(rng, [
    ...Array<Poi['type']>(8).fill('contrat'),
    ...Array<Poi['type']>(4).fill('caisse'),
    ...Array<Poi['type']>(2).fill('marchand'),
    ...Array<Poi['type']>(3).fill('elite'),
    ...Array<Poi['type']>(3).fill('planque'),
  ]);
  const pois: Poi[] = pts.map((p, i) => ({ id: i, x: Math.round(p.x), y: Math.round(p.y), type: types[i % types.length], name: '', threats: [] }));

  // Lieux spécialisés : chaque famille de butin au moins une fois, puis tirage où celles du biome pèsent double.
  const looters = shuffle(rng, pois.filter((p) => p.type === 'contrat' || p.type === 'elite' || p.type === 'caisse'));
  const bag = [...LOOT_FAMILIES, ...LOOT_FAMILIES, ...BIOMES[biome].families.filter((f) => LOOT_FAMILIES.includes(f)).flatMap((f) => [f, f])];
  looters.forEach((p, i) => {
    p.family = i < LOOT_FAMILIES.length ? LOOT_FAMILIES[i] : bag[Math.floor(rng() * bag.length)];
  });
  // Noms : un lieu spécialisé prend un nom de sa famille (de préférence propre au biome), les autres un nom du biome.
  const usedNames = new Set<string>();
  const take = (list: string[]) => {
    const free = list.filter((n) => !usedNames.has(n));
    const n = free.length ? free[Math.floor(rng() * free.length)] : null;
    if (n) usedNames.add(n);
    return n;
  };
  const places = BIOMES[biome].places;
  const famPlaces = FAMILY_PLACES[biome];
  for (const p of pois) {
    if (!p.family || p.family === 'tactique') continue;
    p.name = take(famPlaces[p.family]) ?? '';
  }
  const neutral = places.filter((n) => !Object.values(famPlaces).some((l) => l.includes(n)));
  for (const p of pois) if (!p.name) p.name = take(neutral) ?? take(places) ?? `Lieu ${p.id + 1}`;
  // Menaces : distribuées en cycle, celles du biome en double, pour qu'aucune ne couvre plus d'un tiers des combats.
  const allowed = stageThreats(stage);
  const cycle = shuffle(rng, [...allowed, ...BIOMES[biome].threats.filter((t) => allowed.includes(t))]);
  // Plafond : une menace ne couvre jamais plus d'un tiers des lieux de combat.
  const fights = pois.filter((p) => p.type === 'contrat' || p.type === 'elite');
  const cap = Math.ceil(fights.length / 3);
  const used = new Map<Threat, number>();
  let c = 0;
  const next = (not?: Threat): Threat => {
    for (let i = 0; i < cycle.length * 2; i++) {
      const t = cycle[c++ % cycle.length];
      if (t !== not && (used.get(t) ?? 0) < cap) {
        used.set(t, (used.get(t) ?? 0) + 1);
        return t;
      }
    }
    return cycle.find((t) => t !== not) ?? cycle[0];
  };
  for (const p of fights) {
    p.threats.push(next());
    if (p.type === 'elite') p.threats.push(next(p.threats[0]));
  }
  return {
    biome, stage, pois, exfilThreats: guardianThreats(biome, stage),
    exfil: { x: Math.round(exfil.x), y: Math.round(exfil.y) }, visited: [], pos: -1,
  };
}

export function posOf(z: Zone): { x: number; y: number } | null {
  if (z.pos === EXFIL_ID) return z.exfil;
  return z.pois.find((p) => p.id === z.pos) ?? null;
}

export function inSafeZone(z: Zone, p: { x: number; y: number }, turn: number): boolean {
  return dist(p, z.exfil) <= gasRadius(turn);
}

/** Lieux où l'on peut aller pour le tour `turn`, et si l'exfiltration est possible. */
export function options(z: Zone, turn: number): { pois: Poi[]; exfil: boolean; forced: boolean } {
  if (turn >= TURNS - 1) return { pois: [], exfil: true, forced: true };
  const here = posOf(z);
  const free = z.pois.filter((p) => !z.visited.includes(p.id) && inSafeZone(z, p, turn));
  let pois = here ? free.filter((p) => dist(p, here) <= MOVE_RANGE) : free;
  if (here) {
    // Au moins MIN_CHOICES lieux : on complète avec les lieux sûrs les plus proches, même hors de portée.
    const byDist = [...free].sort((a, b) => dist(a, here) - dist(b, here));
    for (const p of byDist) {
      if (pois.length >= MIN_CHOICES) break;
      if (!pois.includes(p)) pois.push(p);
    }
    // Au moins 2 options différentes (type ou famille de butin) quand la carte le permet.
    const key = (p: Poi) => `${p.type}/${p.family ?? ''}`;
    if (pois.length && pois.every((p) => key(p) === key(pois[0]))) {
      const other = byDist.find((p) => key(p) !== key(pois[0]));
      if (other) pois.push(other);
    }
  }
  const exfil = !!here && turn >= EARLY_EXFIL_TURN && dist(here, z.exfil) <= MOVE_RANGE;
  if (!pois.length) return { pois: [], exfil: true, forced: true };
  return { pois, exfil, forced: false };
}
