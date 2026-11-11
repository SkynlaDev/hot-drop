// Opérateurs : choisis au début de la run, ils fixent le pool d'objets (comme les classes de Backpack Battles).
import { Family, ITEMS, LOOT_IDS } from './items';
import { RECIPES } from './recipes';

export type OperatorId = 'viper' | 'sentinelle';

export interface OperatorDef {
  id: OperatorId;
  name: string;
  /** Famille d'objets propre à l'opérateur. */
  family: Family;
  /** Accroche affichée à l'écran de choix. */
  pitch: string;
  /** Passif, appliqué par computeLoadout. */
  passive: string;
  /** Objets de départ : [defId, x, y] dans le sac de base (colonnes 2 à 6, lignes 2 à 5). */
  start: [string, number, number][];
}

export const OPERATORS: Record<OperatorId, OperatorDef> = {
  viper: {
    id: 'viper',
    name: 'Viper',
    family: 'rafale',
    pitch: 'Fusils d’assaut et SMG : noie l’ennemi sous les balles, sans lâcher la gâchette.',
    passive: 'Feu continu : chaque arme gagne +5\u00a0% de cadence par seconde de tir sans recharger (max +30\u00a0%)',
    start: [['casque', 2, 2], ['pistolet', 4, 2], ['chg_9mm', 5, 3], ['refroidisseur', 4, 4], ['couteau', 2, 4]],
  },
  sentinelle: {
    id: 'sentinelle',
    name: 'Sentinelle',
    family: 'precision',
    pitch: 'Fusils de précision et revolvers : une arme marque, l’autre achève.',
    passive: 'Marque : un critique marque l’ennemi, la touche suivante d’une autre arme fait +50\u00a0%',
    start: [['casque', 2, 2], ['revolver', 4, 2], ['chg_44', 5, 3], ['viseur_holo', 6, 3], ['couteau', 2, 4]],
  },
};

export const OPERATOR_IDS = Object.keys(OPERATORS) as OperatorId[];

/** Familles partagées par tous les opérateurs (tronc commun). */
export const NEUTRAL_FAMILIES: Family[] = ['rempart', 'tactique'];
/** Objets d'autres familles versés au tronc commun (les grenades). */
export const NEUTRAL_IDS = ['frag', 'flash'];

/** Objet de base utilisable par cet opérateur : sa famille, le tronc commun, les grenades. */
function baseUsable(op: OperatorId, id: string): boolean {
  const f = ITEMS[id].family;
  return f === OPERATORS[op].family || NEUTRAL_FAMILIES.includes(f) || NEUTRAL_IDS.includes(id);
}

/**
 * Objet que cet opérateur peut prendre et utiliser : objets de base de son pool, et objets assemblés
 * à partir de ces objets. Les armes de l'autre opérateur (Précision pour Viper, Rafale pour Sentinelle) n'en font pas partie.
 */
export function canUse(op: OperatorId, id: string): boolean {
  if (!ITEMS[id]) return false;
  if (!ITEMS[id].crafted) return baseUsable(op, id);
  return RECIPES.some((r) => r.output === id && r.inputs.every((i) => baseUsable(op, i)));
}

/** Objets que cet opérateur peut trouver (butin, caisses, boutique), hors objets assemblés. */
export function lootPool(op: OperatorId): string[] {
  return LOOT_IDS.filter((id) => baseUsable(op, id));
}
