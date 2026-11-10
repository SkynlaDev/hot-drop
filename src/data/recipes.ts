// Recettes : des objets différents, adjacents dans le sac, assemblés automatiquement hors combat (pas d'Établi).

export interface Recipe {
  id: string;
  inputs: string[];
  output: string;
}

export const RECIPES: Recipe[] = [
  { id: 'kr4_tactique', inputs: ['fusil_assaut', 'poignee', 'chg_etendu'], output: 'kr4_tactique' },
  { id: 'furet_akimbo', inputs: ['smg', 'smg_guepe'], output: 'furet_akimbo' },
  { id: 'aigle_longuevue', inputs: ['precision', 'lunette', 'bipied'], output: 'aigle_longuevue' },
  { id: 'taureau_magnum', inputs: ['revolver', 'chg_44', 'viseur_holo'], output: 'taureau_magnum' },
  { id: 'pompe_dragon', inputs: ['pompe', 'chg_12g'], output: 'pompe_dragon' },
  { id: 'thermite', inputs: ['frag', 'fumigene'], output: 'thermite' },
  { id: 'armure_lourde', inputs: ['plaque', 'casque'], output: 'armure_lourde' },
  { id: 'kit_trauma', inputs: ['ifak', 'seringue'], output: 'kit_trauma' },
];
