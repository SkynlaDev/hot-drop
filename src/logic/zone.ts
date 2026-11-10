// Zone de Vestra : lieux sur une carte, gaz qui se resserre vers le point d'exfiltration.
import { Rng, rngFor } from './rng';
import type { NodeType } from './run';
import { THREATS, Threat } from '../data/threats';

export interface Poi {
  id: number;
  x: number;
  y: number;
  type: Exclude<NodeType, 'boss'>;
  name: string;
  /** Menaces annoncées (lieux de combat uniquement). */
  threats: Threat[];
}

export interface Zone {
  pois: Poi[];
  exfil: { x: number; y: number };
  visited: number[];
  /** Lieu actuel : -1 = pas encore largué, EXFIL_ID = point d'exfiltration. */
  pos: number;
}

/** Nombre de tours : 7 lieux puis l'exfiltration. */
export const TURNS = 8;
/** Tour (index 0) à partir duquel l'extraction anticipée est possible. */
export const EARLY_EXFIL_TURN = 3;
export const MAP_SIZE = 1000;
export const MOVE_RANGE = 340;
export const EXFIL_ID = -2;
const POI_COUNT = 16;
const MIN_SPACING = 125;

const NAMES = [
  'Usine', 'Ferme', 'Hôpital', 'École', 'Dépôt', 'Silo', 'Garage', 'Église', 'Supermarché', 'Château d\'eau',
  'Station-service', 'Caserne', 'Scierie', 'Motel', 'Pont', 'Antenne', 'Carrière', 'Gare', 'Mairie', 'Entrepôt',
];

/** Rayon de la zone sûre au moment d'arriver au tour `turn` (0 = largage). */
export function gasRadius(turn: number): number {
  return 40 + 540 * (1 - Math.min(turn, TURNS - 1) / (TURNS - 1));
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

export function genZone(seed: number): Zone {
  const rng = rngFor(seed, 'zone');
  const exfil = { x: 500 + (rng() - 0.5) * 240, y: 500 + (rng() - 0.5) * 240 };
  const pts: { x: number; y: number }[] = [];
  for (let tries = 0; tries < 4000 && pts.length < POI_COUNT; tries++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * 440;
    const p = { x: 500 + Math.cos(a) * r, y: 500 + Math.sin(a) * r };
    if (dist(p, exfil) < 150) continue;
    if (pts.some((q) => dist(p, q) < MIN_SPACING)) continue;
    pts.push(p);
  }
  const types = shuffle(rng, [
    ...Array<Poi['type']>(7).fill('contrat'),
    ...Array<Poi['type']>(3).fill('caisse'),
    ...Array<Poi['type']>(2).fill('marchand'),
    ...Array<Poi['type']>(2).fill('elite'),
    ...Array<Poi['type']>(2).fill('planque'),
  ]);
  const names = shuffle(rng, [...NAMES]);
  const pois: Poi[] = pts.map((p, i) => ({ id: i, x: Math.round(p.x), y: Math.round(p.y), type: types[i % types.length], name: names[i % names.length], threats: [] }));
  // Menaces : distribuées en cycle pour qu'aucune ne couvre plus d'un tiers des combats.
  const cycle = shuffle(rng, [...THREATS]);
  let c = 0;
  for (const p of pois) {
    if (p.type !== 'contrat' && p.type !== 'elite') continue;
    p.threats.push(cycle[c++ % cycle.length]);
    if (p.type === 'elite') p.threats.push(cycle[c++ % cycle.length]);
  }
  return { pois, exfil: { x: Math.round(exfil.x), y: Math.round(exfil.y) }, visited: [], pos: -1 };
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
  // Filet de sécurité : si rien n'est à portée, les 3 lieux sûrs les plus proches.
  if (!pois.length && here) pois = [...free].sort((a, b) => dist(a, here) - dist(b, here)).slice(0, 3);
  const exfil = !!here && turn >= EARLY_EXFIL_TURN && dist(here, z.exfil) <= MOVE_RANGE;
  if (!pois.length) return { pois: [], exfil: true, forced: true };
  return { pois, exfil, forced: false };
}
