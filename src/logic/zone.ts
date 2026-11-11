// Carte battle royale : des zones de tailles différentes, un cercle de gaz qui se resserre manche après manche,
// et les cartes tirées quand le joueur se largue dans une zone.
import { ITEMS } from '../data/items';
import { Rng, rngFor, weighted } from './rng';

export type ZoneSize = 'petite' | 'moyenne' | 'grande';

/**
 * Thème d'une zone : la moitié du butin (boutique, caisses, objets en plus des bots) en vient.
 * Le Marché noir n'oriente pas le butin mais a deux fois plus de boutiques.
 */
export type ZoneTheme = 'armurerie' | 'hopital' | 'chantier' | 'commissariat' | 'marche';
/** Thèmes répartis sur les 9 zones d'une carte. */
export const ZONE_THEMES: ZoneTheme[] = ['armurerie', 'armurerie', 'hopital', 'hopital', 'chantier', 'chantier', 'commissariat', 'commissariat', 'marche'];
/** Part du butin tirée dans le thème de la zone. */
export const THEME_BIAS = 0.5;

/** L'objet relève du thème de la zone. */
export function themeFits(theme: ZoneTheme | undefined, defId: string): boolean {
  const d = ITEMS[defId];
  switch (theme) {
    case 'armurerie': return !!d.weapon || !!d.melee;
    case 'hopital': return d.category === 'medical' || d.category === 'protection';
    case 'chantier': return d.category === 'explosif' || d.family === 'demolition';
    case 'commissariat': return d.category === 'accessoire' || d.category === 'munition';
    default: return false;
  }
}

export interface MapZone {
  id: number;
  name: string;
  size: ZoneSize;
  /** Absent sur les cartes de test construites à la main. */
  theme?: ZoneTheme;
  x: number;
  y: number;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface GameMap {
  zones: MapZone[];
  /** Cercle sûr de chaque manche (index 0 à ROUNDS - 1). */
  circles: Circle[];
  /** Point final vers lequel le cercle se resserre. */
  final: { x: number; y: number };
}

/** `solo` = un duel, `elite` = un duel contre un bot fort (meilleur butin). */
export type CardType = 'elite' | 'solo' | 'caisse' | 'caisse_renforcee' | 'shop' | 'caisse_epique';
/** Types tirés au poids (la caisse épique est tirée à part, au plus une par zone). */
export type WeightedCardType = Exclude<CardType, 'caisse_epique'>;

export interface Card {
  type: CardType;
  /** Nombre de duels : 1 (solo, élite), 0 (caisses, boutique). */
  duels: number;
}

/** Nombre de cercles (manches) avant le duel final. */
export const ROUNDS = 5;
export const ZONE_COUNT = 9;
export const MAP_SIZE = 1000;
/** Actions (cartes jouées) par zone. */
export const ACTIONS_PER_ZONE = 3;
export const CARDS_BY_SIZE: Record<ZoneSize, number> = { petite: 4, moyenne: 6, grande: 8 };
/** Niveaux de difficulté ajoutés aux bots selon la taille de la zone. */
export const DANGER_BY_SIZE: Record<ZoneSize, number> = { petite: 0, moyenne: 0.5, grande: 1 };
/** Rayon d'affichage de la zone sur la carte. */
export const ZONE_RADIUS: Record<ZoneSize, number> = { petite: 48, moyenne: 68, grande: 92 };
/** Poids de tirage des cartes selon la taille de la zone. */
export const CARD_WEIGHTS: Record<ZoneSize, Record<WeightedCardType, number>> = {
  petite: { elite: 6, solo: 38, caisse: 30, caisse_renforcee: 6, shop: 20 },
  moyenne: { elite: 16, solo: 36, caisse: 20, caisse_renforcee: 8, shop: 20 },
  grande: { elite: 28, solo: 34, caisse: 12, caisse_renforcee: 6, shop: 13 },
};
/**
 * Chance qu'une zone contienne une caisse épique (au plus une par largage) : elle remplace une des cartes tirées.
 * Réservée aux grandes zones : c'est la récompense qui justifie d'aller au chaud.
 */
export const EPIC_CRATE_CHANCE: Record<ZoneSize, number> = { petite: 0, moyenne: 0, grande: 0.5 };
/** Manche (index 0) à partir de laquelle la caisse renforcée et la caisse épique apparaissent (2e cercle). */
export const RICH_CRATES_FROM_ROUND = 1;
/** Rayon du premier cercle : couvre toute la carte. */
const FIRST_RADIUS = 760;
const MIN_SPACING = 175;
const MARGIN = 110;

export const ZONE_NAMES = [
  'Gare de triage', 'Cité des Pins', 'Zone industrielle', 'Port de plaisance', 'Centre commercial',
  'Château d’eau', 'Ferme des Saules', 'Station-service', 'Hôpital Saint-Roch', 'Carrière', 'Marché couvert',
  'Dépôt de bus', 'Les Silos', 'Lotissement des Lilas', 'Scierie', 'Stade municipal', 'Base aérienne', 'Vieux moulin',
];

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

/** Carte de combat (solo ou élite). */
export function isFightType(t: CardType): t is 'solo' | 'elite' {
  return t === 'solo' || t === 'elite';
}

export function genMap(seed: number): GameMap {
  const rng = rngFor(seed, 'map');
  const sizes = shuffle(rng, [...Array<ZoneSize>(3).fill('petite'), ...Array<ZoneSize>(3).fill('moyenne'), ...Array<ZoneSize>(3).fill('grande')]);
  const pts: { x: number; y: number }[] = [];
  let spacing = MIN_SPACING;
  for (let tries = 0; pts.length < ZONE_COUNT; tries++) {
    if (tries > 0 && tries % 2000 === 0) spacing *= 0.85;
    const p = { x: MARGIN + rng() * (MAP_SIZE - 2 * MARGIN), y: MARGIN + rng() * (MAP_SIZE - 2 * MARGIN) };
    if (pts.some((q) => dist(p, q) < spacing)) continue;
    pts.push(p);
  }
  const names = shuffle(rng, [...ZONE_NAMES]);
  const zones: MapZone[] = pts.map((p, i) => ({ id: i, name: names[i], size: sizes[i], x: Math.round(p.x), y: Math.round(p.y) }));

  // Point final : entre deux zones de tailles différentes, proches l'une de l'autre, de préférence vers le centre.
  const mid = { x: MAP_SIZE / 2, y: MAP_SIZE / 2 };
  const pairs: [MapZone, MapZone, number][] = [];
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const a = zones[i];
      const b = zones[j];
      if (a.size === b.size) continue;
      const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pairs.push([a, b, dist(a, b) + 0.6 * dist(c, mid)]);
    }
  }
  pairs.sort((p, q) => p[2] - q[2]);
  const [a, b] = pairs[Math.floor(rng() * Math.min(3, pairs.length))];
  const final = { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) };
  // Dernier cercle : englobe tout juste les centres des deux zones finales.
  const lastR = Math.ceil(Math.max(dist(final, a), dist(final, b))) + 12;
  // Les cercles interpolent centre et rayon : comme le premier et le dernier contiennent a et b, tous les contiennent.
  const circles: Circle[] = [];
  for (let r = 0; r < ROUNDS; r++) {
    const t = r / (ROUNDS - 1);
    circles.push({
      x: Math.round(mid.x + (final.x - mid.x) * t),
      y: Math.round(mid.y + (final.y - mid.y) * t),
      r: Math.round(FIRST_RADIUS + (lastR - FIRST_RADIUS) * t),
    });
  }
  // Thèmes : tirés à part, pour ne pas changer la géométrie des cartes.
  const themes = shuffle(rngFor(seed, 'themes'), [...ZONE_THEMES]);
  zones.forEach((z, i) => (z.theme = themes[i % themes.length]));
  // Sécurité : au moins 2 zones dans chaque cercle (agrandit le cercle si besoin).
  for (const c of circles) {
    const ds = zones.map((z) => dist(z, c)).sort((p, q) => p - q);
    if (ds[1] > c.r) c.r = Math.ceil(ds[1]) + 1;
  }
  return { zones, circles, final };
}

/** Cercle sûr de la manche (la manche finale garde le dernier cercle). */
export function circle(map: GameMap, round: number): Circle {
  return map.circles[Math.max(0, Math.min(round, map.circles.length - 1))];
}

/** Une zone est gazée quand son centre est hors du cercle de la manche. */
export function isGassed(map: GameMap, zone: MapZone, round: number): boolean {
  const c = circle(map, round);
  return dist(zone, c) > c.r;
}

/** Zones où l'on peut se larguer à cette manche. */
export function zonesInCircle(map: GameMap, round: number): MapZone[] {
  return map.zones.filter((z) => !isGassed(map, z, round));
}

/**
 * Cartes tirées en arrivant dans une zone (face visible). Déterministe pour une graine, une manche et une zone.
 * Au moins une carte de combat, au plus une boutique, au plus une caisse épique (grandes zones).
 */
export function drawCards(seed: number, round: number, zone: MapZone): Card[] {
  const rng = rngFor(seed, 'cards', round, zone.id);
  const w = { ...CARD_WEIGHTS[zone.size] };
  if (zone.theme === 'marche') w.shop *= 2;
  const types: CardType[] = [];
  for (let i = 0; i < CARDS_BY_SIZE[zone.size]; i++) {
    // Au plus une boutique et une caisse renforcée ; pas de caisse renforcée au 1er cercle.
    const allowed = (Object.keys(w) as WeightedCardType[]).filter((t) => (t !== 'shop' || !types.includes('shop'))
      && (t !== 'caisse_renforcee' || (round >= RICH_CRATES_FROM_ROUND && !types.includes('caisse_renforcee'))));
    types.push(weighted(rng, allowed.map((t) => [t, w[t]] as const)));
  }
  if (!types.some(isFightType)) {
    // Remplace une carte au hasard par un duel solo.
    types[Math.floor(rng() * types.length)] = 'solo';
  }
  // Caisse épique : remplace une carte au hasard, sans retirer le seul combat de la zone.
  if (rng() < EPIC_CRATE_CHANCE[zone.size] && round >= RICH_CRATES_FROM_ROUND) {
    const fights = types.filter(isFightType).length;
    const spots = types.map((_, i) => i).filter((i) => fights > 1 || !isFightType(types[i]));
    types[spots[Math.floor(rng() * spots.length)]] = 'caisse_epique';
  }
  return types.map((type) => ({ type, duels: isFightType(type) ? 1 : 0 }));
}

export function isFight(card: Card): boolean {
  return isFightType(card.type);
}
