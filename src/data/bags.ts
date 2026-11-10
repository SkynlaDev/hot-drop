// Sacoches : des objets à part, posés sur la grille à côté du sac de base pour l'agrandir (comme Backpack Battles).
// Une case est utilisable si elle est dans le sac de base ou couverte par une sacoche posée.

export type BagId = 'pochette' | 'sacoche' | 'ceinture' | 'sac_tactique';

export interface BagDef {
  id: BagId;
  name: string;
  short: string;
  /** Forme avant rotation : une chaîne par ligne, 'X' = case couverte. */
  shape: string[];
  /** Prix d'achat en boutique. */
  price: number;
  /** Poids de tirage (caisses, boutique, butin) : plus il est bas, plus la sacoche est rare. */
  weight: number;
  /** Poids ajouté à chaque manche (les grandes sacoches deviennent plus fréquentes en fin de partie). */
  weightPerRound: number;
}

const DEFS: BagDef[] = [
  { id: 'pochette', name: 'Pochette', short: 'Poch.', shape: ['XX'], price: 4, weight: 40, weightPerRound: 0 },
  { id: 'sacoche', name: 'Sacoche', short: 'Sacoche', shape: ['XX', 'XX'], price: 8, weight: 28, weightPerRound: 2 },
  { id: 'ceinture', name: 'Ceinture', short: 'Ceint.', shape: ['XXXX'], price: 8, weight: 22, weightPerRound: 2 },
  { id: 'sac_tactique', name: 'Sac tactique', short: 'Sac tac.', shape: ['XX', 'XX', 'XX'], price: 13, weight: 6, weightPerRound: 3 },
];

export const BAGS: Record<BagId, BagDef> = Object.fromEntries(DEFS.map((d) => [d.id, d])) as Record<BagId, BagDef>;
export const BAG_IDS = DEFS.map((d) => d.id);

export function isBagId(id: string): id is BagId {
  return id in BAGS;
}
