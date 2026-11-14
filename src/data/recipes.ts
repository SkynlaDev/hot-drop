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
  // Rang 2 : deux objets assemblés (ou un assemblé + un objet de base) donnent un objet de fou.
  { id: 'souffle_dragon', inputs: ['pompe_dragon', 'grenade_incendiaire'], output: 'souffle_dragon' },
  { id: 'bobine_tesla', inputs: ['taser_lourd', 'chg_electrique'], output: 'bobine_tesla' },
  { id: 'juggernaut', inputs: ['casque_lourd', 'armure_lourde'], output: 'juggernaut' },
  { id: 'poste_secours', inputs: ['kit_trauma', 'sac_medical'], output: 'poste_secours' },
  { id: 'lame_rouge', inputs: ['machette', 'couteau_combat'], output: 'lame_rouge' },
  { id: 'rhinoceros', inputs: ['aigle_longuevue', 'perforantes'], output: 'rhinoceros' },
  { id: 'kr4_mitrailleur', inputs: ['kr4_tactique', 'chg_tambour'], output: 'kr4_mitrailleur' },
  { id: 'bombe_phosphore', inputs: ['thermite', 'sous_munitions'], output: 'bombe_phosphore' },
  // Contenu v3 : drones, radio, économie.
  { id: 'drone_assaut', inputs: ['drone', 'batterie'], output: 'drone_assaut' },
  { id: 'appui_mortier', inputs: ['radio', 'frag'], output: 'appui_mortier' },
  { id: 'designateur', inputs: ['radio', 'lunette'], output: 'designateur' },
  { id: 'essaim', inputs: ['drone_assaut', 'appui_mortier'], output: 'essaim' },
  { id: 'stimulant', inputs: ['seringue', 'ration'], output: 'stimulant' },
  { id: 'garrot', inputs: ['bandage', 'ifak'], output: 'garrot' },
  { id: 'tempete_feu', inputs: ['bidon_napalm', 'grenade_incendiaire'], output: 'tempete_feu' },
  // Recettes de doublon (remplacent l'ancienne fusion de raretés). Après les autres : à ingrédients égaux,
  // la première recette de la liste l'emporte (frag + fumigène donne la thermite avant frag + frag).
  { id: 'mamba_akimbo', inputs: ['pistolet', 'pistolet'], output: 'mamba_akimbo' },
  { id: 'taureau_jumeaux', inputs: ['revolver', 'revolver'], output: 'taureau_jumeaux' },
  { id: 'casque_lourd', inputs: ['casque', 'casque'], output: 'casque_lourd' },
  { id: 'sous_munitions', inputs: ['frag', 'frag'], output: 'sous_munitions' },
  { id: 'sac_medical', inputs: ['ifak', 'ifak'], output: 'sac_medical' },
  { id: 'machette', inputs: ['couteau', 'couteau'], output: 'machette' },
  { id: 'bidon_napalm', inputs: ['molotov', 'molotov'], output: 'bidon_napalm' },
  { id: 'ecran_fumee', inputs: ['fumigene', 'fumigene'], output: 'ecran_fumee' },
  { id: 'flash_lourde', inputs: ['flash', 'flash'], output: 'flash_lourde' },
  { id: 'coffre_fort', inputs: ['tirelire', 'tirelire'], output: 'coffre_fort' },
];
