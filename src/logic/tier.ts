// Niveau d'un objet (remplace les raretés) : objet de base ou objet assemblé par une recette.
import { ITEMS } from '../data/items';

/** 0 = objet de base, 1 = objet assemblé. */
export type Tier = 0 | 1;
export const TIER_NAMES = ['Base', 'Assemblé'];
export const TIER_COLORS = [0xa39a8c, 0xe9c46a];
export const TIER_HEX = ['#a9bccb', '#e9c46a'];

export function tierOf(defId: string): Tier {
  return ITEMS[defId].crafted ? 1 : 0;
}
