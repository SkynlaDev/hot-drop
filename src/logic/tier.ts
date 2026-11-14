// Niveau d'un objet (remplace les raretés) : objet de base ou objet assemblé par une recette.
import { ITEMS } from '../data/items';

/** 0 = objet de base, 1 = objet assemblé, 2 = objet légendaire (unique, change une règle du duel). */
export type Tier = 0 | 1 | 2;
export const TIER_NAMES = ['Base', 'Assemblé', 'Légendaire'];
export const TIER_COLORS = [0xa39a8c, 0xe9c46a, 0xc3a6e0];
export const TIER_HEX = ['#a9bccb', '#e9c46a', '#c3a6e0'];

export function tierOf(defId: string): Tier {
  return ITEMS[defId].legendary ? 2 : ITEMS[defId].crafted ? 1 : 0;
}
