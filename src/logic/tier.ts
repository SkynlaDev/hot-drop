// Niveau d'un objet (remplace les raretés) : objet de base ou objet assemblé par une recette.
import { ITEMS } from '../data/items';

/** 0 = objet de base, 1 = objet assemblé. */
export type Tier = 0 | 1;
export const TIER_NAMES = ['Base', 'Assemblé'];
export const TIER_COLORS = [0x9e9e9e, 0xf2c94c];
export const TIER_HEX = ['#b4b4b4', '#f2c94c'];

export function tierOf(defId: string): Tier {
  return ITEMS[defId].crafted ? 1 : 0;
}
