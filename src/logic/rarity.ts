import { Rng, weighted } from './rng';

// Index de rareté : 0 Commun, 1 Peu commun, 2 Rare, 3 Épique, 4 Légendaire.
export const RARITY_NAMES = ['Commun', 'Peu commun', 'Rare', 'Épique', 'Légendaire'];
export const RARITY_SHORT = ['C', 'PC', 'R', 'É', 'L'];
export const RARITY_COLORS = [0x9e9e9e, 0x4caf50, 0x2f80ed, 0x9b51e0, 0xf2c94c];
export const RARITY_HEX = ['#b4b4b4', '#5fd068', '#4f9bff', '#b57bf0', '#f2c94c'];

/** Multiplicateur de l'effet principal (dégâts, armure, soins, % de synergie). */
export const EFFECT_MULT = [1, 1.15, 1.3, 1.5, 1.75];
/** Multiplicateur du temps de recharge (arme) ou du délai (objet actif). */
export const RECHARGE_MULT = [1, 0.95, 0.9, 0.85, 0.8];
/** Multiplicateur de la taille du chargeur des armes. */
export const MAG_MULT = [1, 1, 1.25, 1.5, 1.5];
/** Charges supplémentaires par combat pour les objets actifs. */
export const EXTRA_CHARGES = [0, 0, 1, 1, 1];
export const PRICE_MULT = [1, 1.5, 2.5, 4, 6];
export const MAX_RARITY = 4;

/**
 * Chances d'apparition (%) par manche (0 à 4), de Commun à Légendaire.
 * La 6e ligne (index 5) sert au duel final « Top 1 ».
 */
export const ROUND_ODDS = [
  [65, 28, 6, 1, 0],
  [45, 35, 15, 4, 1],
  [30, 35, 24, 9, 2],
  [18, 32, 30, 16, 4],
  [10, 25, 35, 23, 7],
  [5, 18, 35, 30, 12],
];
/** Ancien nom, gardé pour les appelants : même tableau, indexé par manche. */
export const ZONE_ODDS = ROUND_ODDS;

export function rollRarity(rng: Rng, round: number, minRarity = 0, guarantee = 0): number {
  const odds = ROUND_ODDS[Math.max(0, Math.min(round, ROUND_ODDS.length - 1))];
  const r = weighted(rng, odds.map((w, i) => [i, w] as const));
  return Math.min(MAX_RARITY, Math.max(r, minRarity, guarantee));
}
