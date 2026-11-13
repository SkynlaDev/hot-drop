// Recettes : des objets adjacents dans le sac, assemblés automatiquement hors combat (pas d'Établi).

export interface Recipe {
  id: string;
  inputs: string[];
  output: string;
}

export const RECIPES: Recipe[] = [
  { id: 'kr4_tactique', inputs: ['fusil_assaut', 'poignee', 'chg_etendu'], output: 'kr4_tactique' },
  { id: 'furet_akimbo', inputs: ['smg', 'smg_guepe'], output: 'furet_akimbo' },
  { id: 'aigle_longuevue', inputs: ['precision', 'lunette', 'bipied'], output: 'aigle_longuevue' },
  { id: 'taureau_magnum', inputs: ['revolver', 'chg_44', 'silencieux'], output: 'taureau_magnum' },
  { id: 'ours_deluge', inputs: ['smg_ours', 'chg_tambour'], output: 'ours_deluge' },
  { id: 'faucon_traqueur', inputs: ['dmr_faucon', 'tracantes'], output: 'faucon_traqueur' },
  { id: 'pompe_dragon', inputs: ['pompe', 'chg_12g'], output: 'pompe_dragon' },
  { id: 'thermite', inputs: ['frag', 'fumigene'], output: 'thermite' },
  { id: 'armure_lourde', inputs: ['plaque', 'casque'], output: 'armure_lourde' },
  { id: 'kit_trauma', inputs: ['ifak', 'seringue'], output: 'kit_trauma' },
  // Combat v2 : chargeur (tout calibre) + composant → chargeur spécial ; grenades et taser améliorés.
  ...['chg_9mm', 'chg_556', 'chg_762', 'chg_44', 'chg_12g'].flatMap((c) => [
    { id: `chg_incendiaire_${c}`, inputs: [c, 'briquet'], output: 'chg_incendiaire' },
    { id: `chg_electrique_${c}`, inputs: [c, 'batterie'], output: 'chg_electrique' },
  ]),
  { id: 'grenade_incendiaire', inputs: ['frag', 'briquet'], output: 'grenade_incendiaire' },
  { id: 'grenade_iem', inputs: ['flash', 'batterie'], output: 'grenade_iem' },
  { id: 'taser_lourd', inputs: ['taser', 'batterie'], output: 'taser_lourd' },
  // Recettes de doublon (remplacent l'ancienne fusion de raretés). Après les autres : à ingrédients égaux,
  // la première recette de la liste l'emporte (frag + fumigène donne la thermite avant frag + frag).
  { id: 'mamba_akimbo', inputs: ['pistolet', 'pistolet'], output: 'mamba_akimbo' },
  { id: 'taureau_jumeaux', inputs: ['revolver', 'revolver'], output: 'taureau_jumeaux' },
  { id: 'casque_lourd', inputs: ['casque', 'casque'], output: 'casque_lourd' },
  { id: 'sous_munitions', inputs: ['frag', 'frag'], output: 'sous_munitions' },
  { id: 'sac_medical', inputs: ['ifak', 'ifak'], output: 'sac_medical' },
  { id: 'machette', inputs: ['couteau', 'couteau'], output: 'machette' },
];
