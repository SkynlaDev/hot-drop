// Archétypes des bots : chaque bot suit un plan de build reconnaissable (objets clés, recettes visées),
// affiché avant le duel pour que le joueur puisse s'y préparer.
import type { OperatorId } from './operators';

export type ArchetypeId = 'feu_continu' | 'akimbo' | 'marque' | 'tir_lourd' | 'demolition' | 'rempart' | 'lame' | 'drones';

export interface ArchetypeDef {
  id: ArchetypeId;
  name: string;
  /** Une ligne pour le joueur : ce que fait ce sac. */
  blurb: string;
  /** Opérateurs qui jouent cet archétype (objets de signature). Absent = les deux. */
  ops?: OperatorId[];
  /** Armes préférées (objets de base). Vide = aucune arme à feu (build Lame). */
  weapons: string[];
  /** Objets assemblés visés quand le bot en a les moyens. */
  crafted: string[];
  /** Chargeurs, accessoires, protections et objets actifs préférés. */
  extras: string[];
  /** Part de protections dans le remplissage (0..1), 0,25 par défaut. */
  armorShare?: number;
  /** Toujours deux armes à feu (dès 5 objets). */
  twoGuns?: boolean;
  /** Pas d'accessoire d'arme (seulement le chargeur) : la place va aux protections et aux soins. */
  noAccessory?: boolean;
  /** Objets en plus et sac un cran plus grand : compense des objets gros et peu nombreux (Rempart). */
  extraItems?: number;
  bigBag?: boolean;
  /** Objets légendaires qui vont avec ce plan (Élites et Top 1). */
  legendaries: string[];
}

export const ARCHETYPES: Record<ArchetypeId, ArchetypeDef> = {
  feu_continu: {
    id: 'feu_continu', legendaries: ['condensateur', 'cocktail', 'plaques_veteran'], name: 'Feu continu', ops: ['viper'],
    blurb: 'SMG et fusils d’assaut à gros chargeurs : la cadence monte tant qu’il tire.',
    weapons: ['smg', 'smg_ours', 'smg_guepe', 'fusil_assaut', 'ar_vesta', 'ar_hades', 'ar_lynx'],
    crafted: ['ours_deluge', 'kr4_tactique', 'furet_akimbo', 'kr4_mitrailleur'],
    extras: ['chg_tambour', 'refroidisseur', 'chg_9mm', 'chg_556', 'poignee', 'chg_etendu', 'seringue'],
    armorShare: 0.15,
  },
  akimbo: {
    id: 'akimbo', legendaries: ['poche_sang', 'plaques_veteran', 'condensateur'], name: 'Akimbo',
    blurb: 'Deux armes de poing jumelées : beaucoup de petites touches.',
    weapons: ['pistolet', 'revolver', 'smg', 'smg_guepe'],
    crafted: ['mamba_akimbo', 'taureau_jumeaux', 'furet_akimbo'],
    extras: ['chg_9mm', 'chg_44', 'viseur_holo', 'poignee', 'flash'],
    armorShare: 0.15,
  },
  marque: {
    id: 'marque', legendaries: ['lunette_thermique', 'ange_gardien'], name: 'Marque', ops: ['sentinelle'],
    blurb: 'Une arme marque sur critique, l’autre achève la cible marquée.',
    weapons: ['dmr_faucon', 'revolver', 'colibri', 'precision'],
    crafted: ['faucon_traqueur', 'taureau_magnum'],
    extras: ['tracantes', 'chg_762', 'chg_44', 'viseur_holo', 'silencieux', 'lunette'],
    twoGuns: true,
  },
  tir_lourd: {
    id: 'tir_lourd', legendaries: ['lunette_thermique', 'ange_gardien'], name: 'Tir lourd',
    blurb: 'Fusils de précision : premier tir critique, critiques énormes.',
    weapons: ['precision', 'dmr_faucon'],
    crafted: ['aigle_longuevue', 'faucon_traqueur', 'rhinoceros', 'ecran_fumee'],
    extras: ['lunette', 'bipied', 'silencieux', 'perforantes', 'chg_762', 'fumigene', 'pointe_creuse'],
  },
  demolition: {
    id: 'demolition', legendaries: ['detonateur', 'cocktail'], name: 'Démolition',
    blurb: 'Fusils à pompe et grenades en chaîne : des explosions qui percent l’armure.',
    weapons: ['pompe', 'pompe_belier'],
    crafted: ['pompe_dragon', 'thermite', 'sous_munitions', 'grenade_incendiaire', 'chg_incendiaire', 'souffle_dragon', 'bombe_phosphore', 'bidon_napalm', 'tempete_feu', 'flash_lourde'],
    extras: ['frag', 'flash', 'fumigene', 'chg_12g', 'casque', 'ifak', 'molotov'],
  },
  rempart: {
    id: 'rempart', legendaries: ['bouclier_emeute', 'ange_gardien', 'poche_sang'], name: 'Rempart',
    blurb: 'Armure épaisse et soins renforcés : il encaisse et tient la distance.',
    weapons: ['fusil_assaut', 'ar_vesta', 'ar_lynx', 'revolver', 'pompe'],
    crafted: ['armure_lourde', 'casque_lourd', 'kit_trauma', 'sac_medical', 'juggernaut', 'poste_secours', 'garrot', 'stimulant'],
    extras: ['plaque', 'casque', 'ifak', 'seringue', 'bandage', 'chg_556', 'chg_44', 'chg_12g', 'combinaison', 'plaque_isolante', 'ration'],
    armorShare: 0.35,
    noAccessory: true,
    extraItems: 2,
    bigBag: true,
  },
  lame: {
    id: 'lame', legendaries: ['insigne_lames', 'poche_sang'], name: 'Lame',
    blurb: 'Aucune arme à feu : lames et saignement qui ignore l’armure.',
    weapons: [],
    crafted: ['machette', 'casque_lourd', 'lame_rouge'],
    extras: ['couteau', 'couteau_combat', 'masse', 'bandage', 'taser', 'casque', 'seringue'],
  },
  drones: {
    id: 'drones', legendaries: ['condensateur', 'cocktail'], name: 'Drones', ops: ['sentinelle', 'sapeur'],
    blurb: 'Drones qui tirent sans s’essouffler et frappes d’artillerie à la radio.',
    weapons: ['drone', 'smg', 'ar_vesta', 'smg_guepe'],
    crafted: ['drone_assaut', 'appui_mortier', 'designateur', 'essaim'],
    extras: ['radio', 'chg_9mm', 'chg_556', 'frag', 'lunette', 'casque', 'ration', 'poignee', 'fumigene', 'ifak', 'plaque'],
    twoGuns: true,
  },
};

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as ArchetypeId[];

/** Archétypes jouables par un opérateur. */
export function archetypesFor(op: OperatorId): ArchetypeId[] {
  return ARCHETYPE_IDS.filter((id) => !ARCHETYPES[id].ops || ARCHETYPES[id].ops!.includes(op));
}
