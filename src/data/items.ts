// Définitions des objets. Pas de raretés : un objet a toujours les mêmes valeurs.
// La puissance vient des recettes (objets assemblés, voir data/recipes.ts).

export type Tag = 'arme' | 'arme_longue' | 'melee' | 'munition' | 'accessoire' | 'protection' | 'explosif' | 'medical' | 'composant';
export type Caliber = '9mm' | '5.56' | '7.62' | '12G' | '.44';
export type Family = 'rafale' | 'precision' | 'demolition' | 'rempart' | 'tactique';
export type Category = 'arme' | 'munition' | 'accessoire' | 'protection' | 'explosif' | 'medical' | 'composant';

export interface WeaponStats {
  dmg: number;
  interval: number; // secondes entre deux tirs
  mag: number;
  reload: number; // secondes
  /** Impacts par tir sur l'adversaire (plombs) : 2 = chaque tir touche deux fois. */
  targets?: number;
  /** Toujours alimentée : ses munitions font partie de l'arme (objets assemblés). */
  selfFed?: boolean;
  /** N'importe quel chargeur adjacent l'alimente, quel que soit son calibre. */
  feedsAny?: boolean;
  /** Le 1er tir du combat est toujours critique. */
  firstCrit?: boolean;
  /** Part de l'armure adverse ignorée (0..1). */
  armorPierce?: number;
  /** Un critique retarde les prochains tirs de l'adversaire de ce nombre de secondes. */
  critStun?: number;
  /** Dégâts en plus à chaque touche, qui ignorent l'armure (incendiaire). */
  trueDmg?: number;
  /** Critique en plus, propre à l'arme. */
  critBonus?: number;
  /** Plafond du Feu continu (passif de Viper) relevé de cette valeur. */
  heatBonus?: number;
  /** Marque (passif de Sentinelle) : bonus en plus quand cette arme consomme la marque. */
  markBoost?: number;
  /** Cumuls de Brûlure / de Choc posés à chaque touche (avant la règle des armes lentes). */
  burn?: number;
  shock?: number;
  /** Le Feu continu (Viper) ne retombe pas à la recharge (KR-4 Mitrailleur). */
  heatKeep?: boolean;
  /** Coût en Endurance multiplié (armes jumelées : deux armes à la fois). */
  endMult?: number;
  /** Drone : tire seul, sans Endurance ; plus rapide avec le palier 4 de Tactique. */
  drone?: boolean;
}

/** Arme de mêlée : frappe pendant tout le duel, plus vite quand toutes les armes à feu sont à sec. */
export interface MeleeStats {
  dmg: number;
  interval: number;
  /** Saignement ajouté à chaque coup (dégâts qui ignorent l'armure, versés peu à peu). */
  bleed?: number;
  /** Part de l'armure adverse ignorée (0..1). */
  armorPierce?: number;
}

export interface ActiveStats {
  /** taser : `value` dégâts et étourdit `duration` s ; bandage : soigne `value` PV et retire `cure` de saignement. */
  kind: 'frag' | 'smoke' | 'heal' | 'flash' | 'adrenaline' | 'taser' | 'bandage';
  value: number;
  cooldown: number;
  charges: number;
  duration?: number;
  threshold?: number;
  /** Explosion qui ignore l'armure (thermite). */
  pierce?: boolean;
  /** Bandage : saignement retiré. */
  cure?: number;
  /** Cumuls de Brûlure posés sur l'adversaire (grenade incendiaire). */
  burn?: number;
  /** Cumuls de Choc posés sur l'adversaire (grenade IEM, taser lourd). */
  shock?: number;
  /** Remet à zéro le Feu continu adverse (grenade IEM). */
  heatReset?: boolean;
  /** Soin : retire tous les statuts (Brûlure, Choc, Saignement) au 1er soin (Poste de secours). */
  cleanse?: boolean;
  /** Frappe d'artillerie (radio) : ne coûte pas d'Endurance ; plus rapide avec le palier 4 de Tactique. */
  strike?: boolean;
}

export interface SynergyStats {
  kind: 'mag' | 'scope' | 'silencer' | 'pierce' | 'grip' | 'extmag' | 'holo' | 'bipod' | 'drum' | 'cooler' | 'tracer' | 'hollow';
  value: number;
  /** Chargeur spécial : alimente une arme de n'importe quel calibre et pose ce statut à chaque touche. */
  status?: 'burn' | 'shock';
}

/**
 * Effet d'une étoile, pour chaque objet distinct qui la remplit : sur l'objet porteur (`self`)
 * ou sur l'objet posé sur l'étoile (`target`). Valeurs : armure en points, charges en nombre,
 * saignement en points par coup, dégâts / cadence / soin en part (0,2 = +20 %).
 */
export interface StarEffect {
  on: 'self' | 'target';
  kind: 'armor' | 'dmg' | 'cadence' | 'charges' | 'heal' | 'bleed';
  value: number;
}

/** Étoile : des cases autour de l'objet (relatives à sa forme non tournée) qui attendent un objet portant un de ces tags. */
export interface StarDef {
  /** Cases, en [colonne, ligne] relatives au coin haut-gauche de la forme ; absent = toutes les cases voisines. */
  at?: [number, number][];
  want: Tag[];
  effect: StarEffect;
  /** Au plus ce nombre d'objets comptent. */
  max?: number;
}

/** Règles changées par un objet légendaire (cumulées sur le sac, appliquées par computeLoadout et le duel). */
export interface Keystone {
  /** Une fois par duel, à 0 PV : revient à cette part des PV max. */
  revive?: number;
  /** À chaque recharge d'une arme : éclat de ces dégâts (la moitié ignore l'armure). */
  reloadBlast?: number;
  /** Dégâts en plus par touche (armes et mêlée), pour chaque duel gagné dans la partie… */
  perWin?: number;
  /** … au plus ce bonus. */
  perWinCap?: number;
  /** Part des dégâts infligés rendue en PV. */
  lifesteal?: number;
  /** Les N premières touches reçues (balles, coups, éclats) sont bloquées. */
  block?: number;
  /** Chaque critique pose ces cumuls de Brûlure. */
  critBurn?: number;
  /** Mêlée : saignement en plus par coup, cadence en plus. */
  meleeBleed?: number;
  meleeHaste?: number;
  /** Toutes les N touches d'arme à feu, pose 5 Choc. */
  shockEvery?: number;
  /** Endurance max en plus. */
  endMax?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  short: string;
  /** Forme de l'objet avant rotation : une chaîne par ligne, 'X' = case occupée. */
  shape: string[];
  category: Category;
  family: Family;
  /** Classe d'arme affichée (Fusil d'assaut, SMG…). */
  wclass?: string;
  tags: Tag[];
  caliber?: Caliber;
  /** Manche (0 = 1er cercle) à partir de laquelle l'objet peut apparaître dans le butin et la boutique. */
  minRound: number;
  price: number;
  weapon?: WeaponStats;
  melee?: MeleeStats;
  /** Étoiles de l'objet (les accessoires ont en plus une étoile tout autour, déduite de leur synergie). */
  stars?: StarDef[];
  /** Objet de signature : seul cet opérateur peut le trouver et l'utiliser (il nourrit son passif). */
  signature?: 'viper' | 'sentinelle' | 'sapeur';
  /** Sapeur : cumuls de Réaction en chaîne en plus (Amorces). */
  chainMax?: number;
  armor?: number;
  /** Chaque balle reçue perd ce nombre de dégâts (minimum 1). */
  flatReduce?: number;
  /** Part de la Brûlure reçue évitée (0..1, combinaison ignifugée). */
  burnResist?: number;
  /** Cumuls de Choc en plus avant la décharge (plaque isolante). */
  shockThreshold?: number;
  /** Immunisé à la décharge du Choc (Blindage Juggernaut). */
  shockImmune?: boolean;
  /** Endurance régénérée en plus par seconde (ration). */
  endRegen?: number;
  /** Coût en Endurance des tirs majoré de cette part (armure lourde : 0,1). */
  endCostMult?: number;
  /** Dégâts infligés à chaque décharge de Choc que l'on déclenche (Bobine Tesla), qui ignorent l'armure. */
  dischargeDmg?: number;
  /** Crédits gagnés à chaque nouveau cercle si l'objet est posé dans le sac (+1 par cercle déjà passé). */
  income?: number;
  /** Objet obtenu par une recette (assemblage automatique) : jamais dans le butin ni la boutique. */
  crafted?: boolean;
  /**
   * Objet légendaire : rare, un seul exemplaire par partie, à partir du 2e cercle (caisse épique, boutique,
   * sac des Élites). Il change une règle du duel (`keystone`).
   */
  legendary?: boolean;
  keystone?: Keystone;
  active?: ActiveStats;
  synergy?: SynergyStats;
}

const DEFS: ItemDef[] = [
  { id: 'pistolet', name: 'Pistolet Mamba', short: 'Mamba', wclass: 'Pistolet', shape: ['XX', 'X.'], category: 'arme', family: 'rafale', tags: ['arme'], caliber: '9mm', minRound: 0, price: 4,
    weapon: { dmg: 11, interval: 0.86, mag: 8, reload: 2.0 } },
  { id: 'smg', name: 'SMG Furet', short: 'Furet', wclass: 'SMG', shape: ['XXX', '.X.'], category: 'arme', family: 'rafale', tags: ['arme'], caliber: '9mm', minRound: 0, price: 6,
    weapon: { dmg: 4.5, interval: 0.4, mag: 15, reload: 2.5 } },
  { id: 'fusil_assaut', name: "Fusil d'assaut KR-4", short: 'KR-4', wclass: "Fusil d'assaut", shape: ['XXXX', '.X..'], category: 'arme', family: 'rafale', tags: ['arme', 'arme_longue'], caliber: '5.56', minRound: 0, price: 8,
    weapon: { dmg: 10, interval: 0.7, mag: 15, reload: 2.5 } },
  { id: 'pompe', name: 'Pompe Sanglier', short: 'Sanglier', wclass: 'Fusil à pompe', shape: ['XXXX', 'X...'], category: 'arme', family: 'demolition', tags: ['arme'], caliber: '12G', minRound: 0, price: 8,
    weapon: { dmg: 18.5, interval: 1.5, mag: 4, reload: 3.0, targets: 2 },
    stars: [{ want: ['explosif'], effect: { on: 'self', kind: 'dmg', value: 0.15 }, max: 2 }] },
  { id: 'precision', name: 'Fusil de précision Aigle', short: 'Aigle', wclass: 'Fusil de précision', shape: ['XXXXX', '..X..'], category: 'arme', family: 'precision', tags: ['arme', 'arme_longue'], caliber: '7.62', minRound: 1, price: 14,
    weapon: { dmg: 51.5, interval: 3.0, mag: 4, reload: 3.5 } },
  { id: 'chg_9mm', name: 'Chargeur 9 mm', short: 'Chg 9mm', shape: ['X'], category: 'munition', family: 'rafale', tags: ['munition'], caliber: '9mm', minRound: 0, price: 2,
    synergy: { kind: 'mag', value: 0.25 } },
  { id: 'chg_556', name: 'Chargeur 5.56', short: 'Chg 5.56', shape: ['X'], category: 'munition', family: 'rafale', tags: ['munition'], caliber: '5.56', minRound: 0, price: 2,
    synergy: { kind: 'mag', value: 0.25 } },
  { id: 'chg_762', name: 'Chargeur 7.62', short: 'Chg 7.62', shape: ['X'], category: 'munition', family: 'precision', tags: ['munition'], caliber: '7.62', minRound: 0, price: 3,
    synergy: { kind: 'mag', value: 0.25 } },
  { id: 'lunette', name: 'Lunette ×4', short: 'Lunette', shape: ['XX'], category: 'accessoire', family: 'precision', tags: ['accessoire'], minRound: 0, price: 5,
    synergy: { kind: 'scope', value: 0.25 } },
  { id: 'silencieux', name: 'Silencieux', short: 'Silenc.', shape: ['XX'], category: 'accessoire', family: 'precision', tags: ['accessoire'], minRound: 1, price: 7,
    synergy: { kind: 'silencer', value: 1 } },
  { id: 'plaque', name: 'Plaque céramique', short: 'Plaque', shape: ['XX', 'XX', 'XX'], category: 'protection', family: 'rempart', tags: ['protection'], minRound: 0, price: 7,
    armor: 40,
    stars: [{ at: [[-1, 0], [-1, 1], [-1, 2]], want: ['protection'], effect: { on: 'self', kind: 'armor', value: 8 }, max: 2 }] },
  { id: 'casque', name: 'Casque balistique', short: 'Casque', shape: ['XX', 'XX'], category: 'protection', family: 'rempart', tags: ['protection'], minRound: 0, price: 4,
    armor: 15,
    stars: [{ at: [[0, 2], [1, 2]], want: ['protection'], effect: { on: 'self', kind: 'armor', value: 6 }, max: 1 }] },
  { id: 'frag', name: 'Grenade frag', short: 'Frag', shape: ['X'], category: 'explosif', family: 'demolition', tags: ['explosif'], minRound: 0, price: 4,
    active: { kind: 'frag', value: 20, cooldown: 7, charges: 2 },
    stars: [{ want: ['explosif'], effect: { on: 'self', kind: 'dmg', value: 0.2 }, max: 2 }] },
  { id: 'fumigene', name: 'Fumigène', short: 'Fumi', shape: ['X', 'X'], category: 'explosif', family: 'tactique', tags: ['explosif'], minRound: 0, price: 3,
    active: { kind: 'smoke', value: 0.5, cooldown: 8, charges: 2, duration: 3 },
    stars: [{ want: ['explosif'], effect: { on: 'self', kind: 'charges', value: 1 }, max: 1 }] },
  { id: 'ifak', name: 'Trousse IFAK', short: 'IFAK', shape: ['XX', 'XX'], category: 'medical', family: 'rempart', tags: ['medical'], minRound: 0, price: 4,
    active: { kind: 'heal', value: 30, cooldown: 4, charges: 1, threshold: 0.5 },
    stars: [{ at: [[2, 0], [2, 1]], want: ['protection'], effect: { on: 'self', kind: 'heal', value: 0.2 }, max: 1 }] },
  { id: 'perforantes', name: 'Munitions perforantes', short: 'Perfo.', shape: ['X'], category: 'munition', family: 'precision', tags: ['munition'], minRound: 1, price: 6,
    synergy: { kind: 'pierce', value: 0.3 } },
  { id: 'flash', name: 'Grenade flash', short: 'Flash', shape: ['X'], category: 'explosif', family: 'demolition', tags: ['explosif'], minRound: 0, price: 5,
    active: { kind: 'flash', value: 1.5, cooldown: 8, charges: 2 },
    stars: [{ want: ['explosif'], effect: { on: 'self', kind: 'charges', value: 1 }, max: 1 }] },
  { id: 'seringue', name: "Seringue d'adrénaline", short: 'Adré.', shape: ['XX'], category: 'medical', family: 'rempart', tags: ['medical'], minRound: 0, price: 5,
    active: { kind: 'adrenaline', value: 0.3, cooldown: 6, charges: 1, duration: 4, threshold: 0.3 },
    stars: [{ want: ['arme'], effect: { on: 'target', kind: 'cadence', value: 0.1 }, max: 1 }] },
  // --- Variantes d'armes (même classe, profils différents)
  { id: 'ar_vesta', name: 'Bullpup Vesta', short: 'Vesta', wclass: "Fusil d'assaut", shape: ['XXX', '.X.'], category: 'arme', family: 'rafale', tags: ['arme', 'arme_longue'], caliber: '5.56', minRound: 0, price: 8,
    weapon: { dmg: 7.5, interval: 0.55, mag: 15, reload: 2.2 } },
  { id: 'ar_hades', name: 'Fusil de combat Hadès', short: 'Hadès', wclass: "Fusil d'assaut", shape: ['XXXX', '.XX.'], category: 'arme', family: 'rafale', tags: ['arme', 'arme_longue'], caliber: '5.56', minRound: 0, price: 10,
    weapon: { dmg: 18, interval: 1.05, mag: 10, reload: 3.0 } },
  { id: 'ar_lynx', name: 'Carabine Lynx', short: 'Lynx', wclass: "Fusil d'assaut", shape: ['XXX', 'X.X'], category: 'arme', family: 'rafale', tags: ['arme', 'arme_longue'], caliber: '5.56', minRound: 0, price: 7,
    weapon: { dmg: 6, interval: 0.45, mag: 12, reload: 1.8 } },
  { id: 'smg_guepe', name: 'Pistolet-mitrailleur Guêpe', short: 'Guêpe', wclass: 'SMG', shape: ['XX', '.X'], category: 'arme', family: 'rafale', tags: ['arme'], caliber: '9mm', minRound: 0, price: 5,
    weapon: { dmg: 3, interval: 0.28, mag: 12, reload: 1.8 } },
  { id: 'smg_ours', name: 'SMG lourd Ours', short: 'Ours', wclass: 'SMG', shape: ['XXX', 'XX.'], category: 'arme', family: 'rafale', tags: ['arme'], caliber: '9mm', minRound: 0, price: 8,
    weapon: { dmg: 6, interval: 0.45, mag: 18, reload: 2.6 } },
  { id: 'revolver', name: 'Revolver Taureau', short: 'Taureau', wclass: 'Pistolet', shape: ['XXX', 'X..'], category: 'arme', family: 'precision', tags: ['arme'], caliber: '.44', minRound: 0, price: 7,
    weapon: { dmg: 19, interval: 1.4, mag: 4, reload: 2.4 } },
  { id: 'pompe_belier', name: 'Pompe auto Bélier', short: 'Bélier', wclass: 'Fusil à pompe', shape: ['XXXX', 'XX..'], category: 'arme', family: 'demolition', tags: ['arme'], caliber: '12G', minRound: 1, price: 12,
    weapon: { dmg: 13, interval: 0.95, mag: 4, reload: 3.2, targets: 2 },
    stars: [{ want: ['explosif'], effect: { on: 'self', kind: 'dmg', value: 0.15 }, max: 2 }] },
  { id: 'dmr_faucon', name: 'DMR Faucon', short: 'Faucon', wclass: 'Fusil de précision', shape: ['XXXX', '..X.'], category: 'arme', family: 'precision', tags: ['arme', 'arme_longue'], caliber: '7.62', minRound: 0, price: 10,
    weapon: { dmg: 35.5, interval: 1.6, mag: 5, reload: 3.0 } },
  // --- Alimentation et accessoires : sans eux, une arme vaut peu
  { id: 'chg_12g', name: 'Cartouches 12G', short: 'Cart. 12G', shape: ['X'], category: 'munition', family: 'demolition', tags: ['munition'], caliber: '12G', minRound: 0, price: 3,
    synergy: { kind: 'mag', value: 0.25 } },
  { id: 'chg_44', name: 'Balles .44', short: 'Balles .44', shape: ['X'], category: 'munition', family: 'precision', tags: ['munition'], caliber: '.44', minRound: 0, price: 3,
    synergy: { kind: 'mag', value: 0.25 } },
  { id: 'poignee', name: 'Poignée verticale', short: 'Poignée', shape: ['X', 'X'], category: 'accessoire', family: 'rafale', tags: ['accessoire'], minRound: 0, price: 4,
    synergy: { kind: 'grip', value: 0.25 } },
  { id: 'chg_etendu', name: 'Chargeur étendu', short: 'Étendu', shape: ['X', 'X'], category: 'accessoire', family: 'rafale', tags: ['accessoire'], minRound: 0, price: 5,
    synergy: { kind: 'extmag', value: 0.5 } },
  { id: 'viseur_holo', name: 'Viseur holo', short: 'Holo', shape: ['X'], category: 'accessoire', family: 'precision', tags: ['accessoire'], minRound: 0, price: 4,
    synergy: { kind: 'holo', value: 0.25 } },
  { id: 'bipied', name: 'Bipied', short: 'Bipied', shape: ['XX'], category: 'accessoire', family: 'precision', tags: ['accessoire'], minRound: 0, price: 5,
    synergy: { kind: 'bipod', value: 0.25 } },
  // --- Autour des passifs : Feu continu (Viper) et Marque (Sentinelle)
  { id: 'chg_tambour', name: 'Chargeur tambour', short: 'Tambour', shape: ['XX', 'XX'], category: 'accessoire', family: 'rafale', tags: ['accessoire'], signature: 'viper', minRound: 0, price: 5,
    synergy: { kind: 'drum', value: 1 } },
  { id: 'refroidisseur', name: 'Refroidisseur de canon', short: 'Refroid.', shape: ['XXX'], category: 'accessoire', family: 'rafale', tags: ['accessoire'], signature: 'viper', minRound: 0, price: 5,
    synergy: { kind: 'cooler', value: 1 } },
  { id: 'colibri', name: 'Pistolet de poche Colibri', short: 'Colibri', wclass: 'Pistolet', shape: ['XX'], category: 'arme', family: 'precision', tags: ['arme'], caliber: '.44', minRound: 0, price: 5,
    weapon: { dmg: 8.5, interval: 0.8, mag: 6, reload: 1.8, critBonus: 0.2 } },
  { id: 'tracantes', name: 'Munitions traçantes', short: 'Traçantes', shape: ['X'], category: 'munition', family: 'precision', tags: ['munition'], signature: 'sentinelle', minRound: 1, price: 5,
    synergy: { kind: 'tracer', value: 0.3 } },
  // --- Objets assemblés (recettes, voir data/recipes.ts) : ingrédients adjacents, assemblage automatique
  { id: 'kr4_tactique', name: 'KR-4 Tactique', short: 'KR-4 T.', wclass: "Fusil d'assaut", shape: ['XXXX', '.XX.'], category: 'arme', family: 'rafale', tags: ['arme', 'arme_longue'], caliber: '5.56', minRound: 0, price: 18, crafted: true,
    weapon: { dmg: 12.5, interval: 0.55, mag: 22, reload: 2.2, feedsAny: true } },
  { id: 'furet_akimbo', name: 'Furet Akimbo', short: 'Akimbo', wclass: 'SMG', shape: ['XXX', 'XXX'], category: 'arme', family: 'rafale', tags: ['arme'], caliber: '9mm', minRound: 0, price: 16, crafted: true,
    weapon: { dmg: 4.5, interval: 0.38, mag: 24, reload: 2.6, targets: 2, endMult: 1.25 } },
  { id: 'aigle_longuevue', name: 'Aigle Longue-vue', short: 'Longue-vue', wclass: 'Fusil de précision', shape: ['XXXXX', '..X..'], category: 'arme', family: 'precision', tags: ['arme', 'arme_longue'], caliber: '7.62', minRound: 0, price: 26, crafted: true,
    weapon: { dmg: 51.5, interval: 2.8, mag: 5, reload: 3.2, firstCrit: true, armorPierce: 0.5 } },
  { id: 'taureau_magnum', name: 'Taureau Magnum', short: 'Magnum', wclass: 'Pistolet', shape: ['XXX', 'X..'], category: 'arme', family: 'precision', tags: ['arme'], caliber: '.44', minRound: 0, price: 16, crafted: true,
    weapon: { dmg: 32, interval: 1.3, mag: 6, reload: 2.2, selfFed: true, critStun: 0.5 } },
  { id: 'ours_deluge', name: 'Ours Déluge', short: 'Déluge', wclass: 'SMG', shape: ['XXXX', '.XX.'], category: 'arme', family: 'rafale', tags: ['arme'], caliber: '9mm', minRound: 0, price: 18, crafted: true,
    weapon: { dmg: 9.5, interval: 0.36, mag: 40, reload: 3.4, selfFed: true, heatBonus: 0.2 } },
  { id: 'faucon_traqueur', name: 'Faucon Traqueur', short: 'Traqueur', wclass: 'Fusil de précision', shape: ['XXXX', '.XX.'], category: 'arme', family: 'precision', tags: ['arme', 'arme_longue'], caliber: '7.62', minRound: 0, price: 18, crafted: true,
    weapon: { dmg: 28, interval: 1.5, mag: 6, reload: 2.8, selfFed: true, critBonus: 0.1, markBoost: 0.3 } },
  { id: 'pompe_dragon', name: 'Pompe Dragon', short: 'Dragon', wclass: 'Fusil à pompe', shape: ['XXXX', 'X...'], category: 'arme', family: 'demolition', tags: ['arme'], caliber: '12G', minRound: 0, price: 16, crafted: true,
    weapon: { dmg: 15, interval: 1.4, mag: 5, reload: 2.8, targets: 2, selfFed: true, trueDmg: 3 },
    stars: [{ want: ['explosif'], effect: { on: 'self', kind: 'dmg', value: 0.15 }, max: 2 }] },
  { id: 'thermite', name: 'Grenade thermite', short: 'Thermite', shape: ['X', 'X'], category: 'explosif', family: 'demolition', tags: ['explosif'], minRound: 0, price: 12, crafted: true,
    active: { kind: 'frag', value: 30, cooldown: 7, charges: 2, pierce: true },
    stars: [{ want: ['arme'], effect: { on: 'target', kind: 'dmg', value: 0.1 }, max: 1 }] },
  { id: 'armure_lourde', name: 'Armure lourde', short: 'Armure L.', shape: ['XX', 'XX', 'XX'], category: 'protection', family: 'rempart', tags: ['protection'], minRound: 0, price: 20, crafted: true,
    armor: 75, flatReduce: 2,
    stars: [{ want: ['medical'], effect: { on: 'target', kind: 'heal', value: 0.25 }, max: 2 }] },
  { id: 'kit_trauma', name: 'Kit de trauma', short: 'Trauma', shape: ['XX', 'XX'], category: 'medical', family: 'rempart', tags: ['medical'], minRound: 0, price: 14, crafted: true,
    active: { kind: 'heal', value: 35, cooldown: 4, charges: 2, threshold: 0.5 },
    stars: [{ want: ['protection'], effect: { on: 'self', kind: 'heal', value: 0.3 }, max: 1 }] },
  // --- Mêlée et objets de corps à corps (tronc commun : famille Tactique ou Rempart)
  { id: 'couteau', name: 'Couteau', short: 'Couteau', wclass: 'Couteau', shape: ['XX'], category: 'arme', family: 'tactique', tags: ['melee'], minRound: 0, price: 3,
    melee: { dmg: 4, interval: 1.0 },
    stars: [{ at: [[2, 0]], want: ['melee'], effect: { on: 'self', kind: 'bleed', value: 2 }, max: 1 }] },
  { id: 'couteau_combat', name: 'Couteau de combat', short: 'Couteau C.', wclass: 'Couteau', shape: ['XX'], category: 'arme', family: 'tactique', tags: ['melee'], minRound: 0, price: 5,
    melee: { dmg: 3, interval: 1.0, bleed: 4 },
    stars: [{ at: [[2, 0]], want: ['melee'], effect: { on: 'self', kind: 'bleed', value: 2 }, max: 1 }] },
  { id: 'masse', name: 'Masse', short: 'Masse', wclass: 'Masse', shape: ['XXX'], category: 'arme', family: 'tactique', tags: ['melee'], minRound: 1, price: 7,
    melee: { dmg: 12, interval: 1.8, armorPierce: 0.3 },
    stars: [{ want: ['protection'], effect: { on: 'self', kind: 'dmg', value: 0.25 }, max: 1 }] },
  { id: 'taser', name: 'Taser', short: 'Taser', shape: ['XX'], category: 'accessoire', family: 'tactique', tags: ['accessoire'], minRound: 0, price: 5,
    active: { kind: 'taser', value: 3, cooldown: 0, charges: 1, duration: 1.5 },
    stars: [{ want: ['melee'], effect: { on: 'self', kind: 'charges', value: 1 }, max: 1 }] },
  { id: 'bandage', name: 'Bandage', short: 'Bandage', shape: ['X'], category: 'medical', family: 'rempart', tags: ['medical'], minRound: 0, price: 3,
    active: { kind: 'bandage', value: 12, cooldown: 2, charges: 1, threshold: 0.5, cure: 10 },
    stars: [{ want: ['protection'], effect: { on: 'self', kind: 'heal', value: 0.5 }, max: 1 }] },
  { id: 'machette', name: 'Machette', short: 'Machette', wclass: 'Machette', shape: ['XXX'], category: 'arme', family: 'tactique', tags: ['melee'], minRound: 0, price: 6, crafted: true,
    melee: { dmg: 8, interval: 1.2 },
    stars: [{ at: [[3, 0]], want: ['melee'], effect: { on: 'self', kind: 'dmg', value: 0.25 }, max: 1 }] },
  // --- Recettes de doublon : deux exemplaires identiques adjacents
  { id: 'mamba_akimbo', name: 'Mamba Akimbo', short: 'Akimbo M.', wclass: 'Pistolet', shape: ['XX', 'XX'], category: 'arme', family: 'rafale', tags: ['arme'], caliber: '9mm', minRound: 0, price: 10, crafted: true,
    weapon: { dmg: 9, interval: 0.8, mag: 16, reload: 2.2, targets: 2, endMult: 1.25 } },
  { id: 'taureau_jumeaux', name: 'Taureau Jumeaux', short: 'Jumeaux', wclass: 'Pistolet', shape: ['XXX', 'XX.'], category: 'arme', family: 'precision', tags: ['arme'], caliber: '.44', minRound: 0, price: 14, crafted: true,
    weapon: { dmg: 18, interval: 1.3, mag: 8, reload: 2.6, targets: 2, critBonus: 0.1, endMult: 1.25 } },
  { id: 'casque_lourd', name: 'Casque lourd', short: 'Casque L.', shape: ['XX', 'XX'], category: 'protection', family: 'rempart', tags: ['protection'], minRound: 0, price: 8, crafted: true,
    armor: 32, flatReduce: 1,
    stars: [{ at: [[0, 2], [1, 2]], want: ['protection'], effect: { on: 'self', kind: 'armor', value: 10 }, max: 1 }] },
  { id: 'sous_munitions', name: 'Grenade à sous-munitions', short: 'Sous-mun.', shape: ['X'], category: 'explosif', family: 'demolition', tags: ['explosif'], minRound: 0, price: 8, crafted: true,
    active: { kind: 'frag', value: 22, cooldown: 6, charges: 3 },
    stars: [{ want: ['explosif'], effect: { on: 'self', kind: 'charges', value: 1 }, max: 1 }] },
  { id: 'sac_medical', name: 'Sac médical', short: 'Sac méd.', shape: ['XX', 'XX'], category: 'medical', family: 'rempart', tags: ['medical'], minRound: 0, price: 8, crafted: true,
    active: { kind: 'heal', value: 28, cooldown: 5, charges: 3, threshold: 0.5 },
    stars: [{ want: ['medical'], effect: { on: 'target', kind: 'charges', value: 1 }, max: 2 }] },

  // --- Combat v2 (design/COMBAT-V2.md) : composants, objets assemblés de rang 1, contres de statuts
  { id: 'briquet', name: 'Briquet', short: 'Briquet', shape: ['X'], category: 'composant', family: 'demolition', tags: ['composant'], minRound: 0, price: 2,
    stars: [{ want: ['explosif'], effect: { on: 'target', kind: 'dmg', value: 0.2 }, max: 1 }] },
  { id: 'batterie', name: 'Batterie', short: 'Batterie', shape: ['X'], category: 'composant', family: 'tactique', tags: ['composant'], minRound: 0, price: 2,
    stars: [{ want: ['arme'], effect: { on: 'target', kind: 'cadence', value: 0.05 }, max: 1 }] },
  { id: 'ration', name: 'Ration de combat', short: 'Ration', shape: ['X'], category: 'composant', family: 'rempart', tags: ['composant'], minRound: 0, price: 3,
    endRegen: 0.25 },
  { id: 'chg_incendiaire', name: 'Chargeur incendiaire', short: 'Chg feu', shape: ['X'], category: 'munition', family: 'demolition', tags: ['munition'], minRound: 0, price: 6, crafted: true,
    synergy: { kind: 'mag', value: 0.25, status: 'burn' } },
  { id: 'chg_electrique', name: 'Chargeur électrique', short: 'Chg élec', shape: ['X'], category: 'munition', family: 'tactique', tags: ['munition'], minRound: 0, price: 6, crafted: true,
    synergy: { kind: 'mag', value: 0.25, status: 'shock' } },
  { id: 'grenade_incendiaire', name: 'Grenade incendiaire', short: 'Incend.', shape: ['X'], category: 'explosif', family: 'demolition', tags: ['explosif'], minRound: 0, price: 7, crafted: true,
    active: { kind: 'frag', value: 14, cooldown: 7, charges: 2, burn: 4 },
    stars: [{ want: ['explosif'], effect: { on: 'self', kind: 'charges', value: 1 }, max: 1 }] },
  { id: 'grenade_iem', name: 'Grenade IEM', short: 'IEM', shape: ['X'], category: 'explosif', family: 'tactique', tags: ['explosif'], minRound: 0, price: 8, crafted: true,
    active: { kind: 'flash', value: 1.2, cooldown: 8, charges: 2, shock: 4, heatReset: true },
    stars: [{ want: ['explosif'], effect: { on: 'self', kind: 'charges', value: 1 }, max: 1 }] },
  { id: 'taser_lourd', name: 'Taser lourd', short: 'Taser L.', shape: ['XX'], category: 'accessoire', family: 'tactique', tags: ['accessoire'], minRound: 0, price: 8, crafted: true,
    active: { kind: 'taser', value: 6, cooldown: 6, charges: 2, duration: 1.5, shock: 5 },
    stars: [{ want: ['melee'], effect: { on: 'self', kind: 'charges', value: 1 }, max: 1 }] },
  { id: 'combinaison', name: 'Combinaison ignifugée', short: 'Ignifugée', shape: ['XX', 'XX'], category: 'protection', family: 'rempart', tags: ['protection'], minRound: 1, price: 6,
    armor: 14, burnResist: 0.5,
    stars: [{ at: [[2, 0], [2, 1]], want: ['protection'], effect: { on: 'self', kind: 'armor', value: 5 }, max: 1 }] },
  { id: 'plaque_isolante', name: 'Plaque isolante', short: 'Isolante', shape: ['XX'], category: 'protection', family: 'rempart', tags: ['protection'], minRound: 1, price: 5,
    armor: 10, shockThreshold: 3,
    stars: [{ at: [[0, 1], [1, 1]], want: ['protection'], effect: { on: 'self', kind: 'armor', value: 4 }, max: 1 }] },
  // --- Combat v2, rang 2 : objets de fou (ingrédients assemblés)
  { id: 'souffle_dragon', name: 'Souffle du Dragon', short: 'Souffle', wclass: 'Fusil à pompe', shape: ['XXXXX', 'XX...'], category: 'arme', family: 'demolition', tags: ['arme'], caliber: '12G', minRound: 0, price: 30, crafted: true,
    weapon: { dmg: 17, interval: 1.4, mag: 6, reload: 2.6, targets: 2, selfFed: true, burn: 1 },
    stars: [{ want: ['explosif'], effect: { on: 'self', kind: 'dmg', value: 0.15 }, max: 2 }] },
  { id: 'bobine_tesla', name: 'Bobine Tesla', short: 'Tesla', wclass: 'Arme électrique', shape: ['XXX', 'XXX'], category: 'arme', family: 'tactique', tags: ['arme'], minRound: 0, price: 28, crafted: true,
    weapon: { dmg: 6, interval: 0.6, mag: 30, reload: 2, selfFed: true, shock: 1 }, dischargeDmg: 30 },
  { id: 'juggernaut', name: 'Blindage Juggernaut', short: 'Juggernaut', shape: ['XXX', 'XXX', 'XXX'], category: 'protection', family: 'rempart', tags: ['protection'], minRound: 0, price: 34, crafted: true,
    armor: 140, flatReduce: 4, shockImmune: true, endCostMult: 0.15,
    stars: [{ want: ['medical'], effect: { on: 'target', kind: 'heal', value: 0.3 }, max: 2 }] },
  { id: 'poste_secours', name: 'Poste de secours', short: 'Poste', shape: ['XXX', 'XXX'], category: 'medical', family: 'rempart', tags: ['medical'], minRound: 0, price: 26, crafted: true,
    active: { kind: 'heal', value: 60, cooldown: 4, charges: 3, threshold: 0.6, cleanse: true },
    stars: [{ want: ['protection'], effect: { on: 'self', kind: 'heal', value: 0.3 }, max: 1 }] },
  { id: 'lame_rouge', name: 'Lame rouge', short: 'Lame R.', wclass: 'Machette', shape: ['XXXX'], category: 'arme', family: 'tactique', tags: ['melee'], minRound: 0, price: 16, crafted: true,
    melee: { dmg: 11, interval: 0.9, bleed: 12 },
    stars: [{ at: [[4, 0]], want: ['melee'], effect: { on: 'self', kind: 'dmg', value: 0.25 }, max: 1 }] },
  { id: 'rhinoceros', name: 'Fusil anti-matériel Rhinocéros', short: 'Rhinocéros', wclass: 'Fusil de précision', shape: ['XXXXXX', '..X...'], category: 'arme', family: 'precision', tags: ['arme', 'arme_longue'], caliber: '7.62', minRound: 0, price: 36, crafted: true,
    weapon: { dmg: 130, interval: 3.6, mag: 3, reload: 4, selfFed: true, firstCrit: true, armorPierce: 1 } },
  { id: 'kr4_mitrailleur', name: 'KR-4 Mitrailleur', short: 'KR-4 M.', wclass: "Fusil d'assaut", shape: ['XXXXX', '.XXX.'], category: 'arme', family: 'rafale', tags: ['arme', 'arme_longue'], caliber: '5.56', minRound: 0, price: 32, crafted: true,
    weapon: { dmg: 12, interval: 0.45, mag: 60, reload: 4, selfFed: true, heatBonus: 0.2, heatKeep: true } },
  { id: 'bombe_phosphore', name: 'Bombe au phosphore', short: 'Phosphore', shape: ['XX'], category: 'explosif', family: 'demolition', tags: ['explosif'], minRound: 0, price: 24, crafted: true,
    active: { kind: 'frag', value: 30, cooldown: 6, charges: 3, pierce: true, burn: 8 },
    stars: [{ want: ['explosif'], effect: { on: 'self', kind: 'charges', value: 1 }, max: 1 }] },
  // --- Sapeur (3e opérateur) : objets de signature autour de la Réaction en chaîne
  { id: 'charge_c4', name: 'Charge C4', short: 'C4', shape: ['XX'], category: 'explosif', family: 'demolition', tags: ['explosif'], signature: 'sapeur', minRound: 0, price: 6,
    active: { kind: 'frag', value: 26, cooldown: 7, charges: 1, pierce: true },
    stars: [{ want: ['explosif'], effect: { on: 'self', kind: 'charges', value: 1 }, max: 2 }] },
  { id: 'amorces', name: 'Amorces électriques', short: 'Amorces', shape: ['X'], category: 'composant', family: 'demolition', tags: ['composant'], signature: 'sapeur', minRound: 0, price: 4,
    chainMax: 2,
    stars: [{ want: ['explosif'], effect: { on: 'target', kind: 'dmg', value: 0.15 }, max: 2 }] },
  { id: 'gilet_demineur', name: 'Gilet de démineur', short: 'Démineur', shape: ['XX', 'XX'], category: 'protection', family: 'rempart', tags: ['protection'], signature: 'sapeur', minRound: 1, price: 7,
    armor: 24, flatReduce: 1,
    stars: [{ want: ['explosif'], effect: { on: 'target', kind: 'charges', value: 1 }, max: 1 }] },
  // --- Contenu v3 : drones et radio (palier 4 de Tactique), Molotov, pointes creuses, économie
  { id: 'drone', name: 'Drone de reconnaissance', short: 'Drone', wclass: 'Drone', shape: ['XX', 'XX'], category: 'arme', family: 'tactique', tags: ['arme'], minRound: 1, price: 9,
    weapon: { dmg: 5, interval: 0.7, mag: 30, reload: 2.5, selfFed: true, drone: true } },
  { id: 'radio', name: 'Radio de campagne', short: 'Radio', shape: ['X', 'X'], category: 'explosif', family: 'tactique', tags: ['explosif'], minRound: 1, price: 7,
    active: { kind: 'frag', value: 24, cooldown: 9, charges: 2, strike: true },
    stars: [{ want: ['arme'], effect: { on: 'target', kind: 'dmg', value: 0.1 }, max: 1 }] },
  { id: 'pointe_creuse', name: 'Balles à pointe creuse', short: 'Pointe cr.', shape: ['X'], category: 'munition', family: 'precision', tags: ['munition'], minRound: 1, price: 5,
    synergy: { kind: 'hollow', value: 0.2 } },
  { id: 'tirelire', name: "Caisse de l'intendant", short: 'Intendant', shape: ['XX'], category: 'composant', family: 'tactique', tags: ['composant'], minRound: 0, price: 6,
    income: 2 },
  { id: 'molotov', name: 'Cocktail Molotov', short: 'Molotov', shape: ['X'], category: 'explosif', family: 'demolition', tags: ['explosif'], minRound: 0, price: 4,
    active: { kind: 'frag', value: 8, cooldown: 6, charges: 2, burn: 5 },
    stars: [{ want: ['explosif'], effect: { on: 'self', kind: 'dmg', value: 0.2 }, max: 2 }] },
  { id: 'drone_assaut', name: "Drone d'assaut", short: 'Drone A.', wclass: 'Drone', shape: ['XX', 'XX'], category: 'arme', family: 'tactique', tags: ['arme'], minRound: 0, price: 20, crafted: true,
    weapon: { dmg: 10, interval: 0.55, mag: 40, reload: 2.2, selfFed: true, drone: true, armorPierce: 0.3 } },
  { id: 'appui_mortier', name: 'Appui mortier', short: 'Mortier', shape: ['XX', 'XX'], category: 'explosif', family: 'tactique', tags: ['explosif'], minRound: 0, price: 18, crafted: true,
    active: { kind: 'frag', value: 30, cooldown: 9, charges: 3, strike: true },
    stars: [{ want: ['explosif'], effect: { on: 'self', kind: 'charges', value: 1 }, max: 1 }] },
  { id: 'designateur', name: 'Désignateur laser', short: 'Désign.', shape: ['XXX'], category: 'explosif', family: 'tactique', tags: ['explosif'], minRound: 0, price: 18, crafted: true,
    active: { kind: 'frag', value: 34, cooldown: 11, charges: 2, strike: true, pierce: true },
    stars: [{ want: ['arme'], effect: { on: 'target', kind: 'dmg', value: 0.15 }, max: 1 }] },
  { id: 'bidon_napalm', name: 'Bidon de napalm', short: 'Napalm', shape: ['X', 'X'], category: 'explosif', family: 'demolition', tags: ['explosif'], minRound: 0, price: 12, crafted: true,
    active: { kind: 'frag', value: 12, cooldown: 6, charges: 3, burn: 8 },
    stars: [{ want: ['explosif'], effect: { on: 'self', kind: 'dmg', value: 0.2 }, max: 2 }] },
  { id: 'essaim', name: 'Essaim de drones', short: 'Essaim', wclass: 'Drone', shape: ['XXX', 'XXX'], category: 'arme', family: 'tactique', tags: ['arme'], minRound: 0, price: 34, crafted: true,
    weapon: { dmg: 8, interval: 0.3, mag: 60, reload: 2, selfFed: true, drone: true, armorPierce: 0.3 } },
  { id: 'coffre_fort', name: 'Coffre-fort', short: 'Coffre', shape: ['XX', 'XX'], category: 'composant', family: 'tactique', tags: ['composant'], minRound: 0, price: 14, crafted: true,
    income: 6 },
  // --- Contenu v3 : recettes de soutien (soins, fumée, flash) et Tempête de feu (rang 2)
  { id: 'stimulant', name: 'Stimulant de combat', short: 'Stimulant', shape: ['XX', 'X.'], category: 'medical', family: 'rempart', tags: ['medical'], minRound: 0, price: 12, crafted: true,
    endRegen: 0.3, active: { kind: 'adrenaline', value: 0.45, cooldown: 6, charges: 1, duration: 5, threshold: 0.4 },
    stars: [{ want: ['arme'], effect: { on: 'target', kind: 'cadence', value: 0.12 }, max: 1 }] },
  { id: 'garrot', name: 'Garrot et pansements', short: 'Garrot', shape: ['XX', 'X.'], category: 'medical', family: 'rempart', tags: ['medical'], minRound: 0, price: 10, crafted: true,
    active: { kind: 'bandage', value: 26, cooldown: 2, charges: 2, threshold: 0.5, cure: 20 },
    stars: [{ want: ['protection'], effect: { on: 'self', kind: 'heal', value: 0.4 }, max: 1 }] },
  { id: 'ecran_fumee', name: 'Écran de fumée', short: 'Écran', shape: ['X', 'X', 'X'], category: 'explosif', family: 'tactique', tags: ['explosif'], minRound: 0, price: 9, crafted: true,
    active: { kind: 'smoke', value: 0.5, cooldown: 7, charges: 3, duration: 4 },
    stars: [{ want: ['arme'], effect: { on: 'target', kind: 'dmg', value: 0.1 }, max: 1 }] },
  { id: 'flash_lourde', name: 'Grenade aveuglante lourde', short: 'Flash L.', shape: ['X', 'X'], category: 'explosif', family: 'demolition', tags: ['explosif'], minRound: 0, price: 11, crafted: true,
    active: { kind: 'flash', value: 2.2, cooldown: 8, charges: 2 },
    stars: [{ want: ['explosif'], effect: { on: 'self', kind: 'charges', value: 1 }, max: 1 }] },
  { id: 'tempete_feu', name: 'Tempête de feu', short: 'Tempête', shape: ['XX', 'XX'], category: 'explosif', family: 'demolition', tags: ['explosif'], minRound: 0, price: 28, crafted: true,
    active: { kind: 'frag', value: 20, cooldown: 6, charges: 3, burn: 12 },
    stars: [{ want: ['explosif'], effect: { on: 'self', kind: 'dmg', value: 0.2 }, max: 2 }] },
  // --- Objets légendaires (design/CONTENU-V3.md) : uniques, dès le 2e cercle, chacun change une règle du duel
  { id: 'ange_gardien', name: "Médaille de l'ange gardien", short: 'Ange', shape: ['X'], category: 'medical', family: 'rempart', tags: ['medical'], minRound: 1, price: 18, legendary: true,
    keystone: { revive: 0.35 },
    stars: [{ want: ['protection'], effect: { on: 'target', kind: 'armor', value: 10 }, max: 1 }] },
  { id: 'detonateur', name: 'Détonateur de recharge', short: 'Détonat.', shape: ['XX'], category: 'explosif', family: 'demolition', tags: ['explosif'], minRound: 1, price: 18, legendary: true,
    keystone: { reloadBlast: 14 },
    stars: [{ want: ['explosif'], effect: { on: 'target', kind: 'dmg', value: 0.2 }, max: 2 }] },
  { id: 'plaques_veteran', name: 'Plaques du vétéran', short: 'Vétéran', shape: ['X'], category: 'accessoire', family: 'tactique', tags: ['accessoire'], minRound: 1, price: 16, legendary: true,
    keystone: { perWin: 1, perWinCap: 10 } },
  { id: 'poche_sang', name: 'Poche de sang', short: 'Poche', shape: ['X', 'X'], category: 'medical', family: 'rempart', tags: ['medical'], minRound: 1, price: 18, legendary: true,
    keystone: { lifesteal: 0.1 },
    stars: [{ want: ['medical'], effect: { on: 'target', kind: 'heal', value: 0.25 }, max: 2 }] },
  { id: 'bouclier_emeute', name: 'Bouclier anti-émeute', short: 'Bouclier', shape: ['XX', 'XX', 'XX'], category: 'protection', family: 'rempart', tags: ['protection'], minRound: 1, price: 20, legendary: true,
    armor: 25, keystone: { block: 6 },
    stars: [{ want: ['melee'], effect: { on: 'target', kind: 'dmg', value: 0.25 }, max: 1 }] },
  { id: 'lunette_thermique', name: 'Lunette thermique', short: 'Thermique', shape: ['XX'], category: 'accessoire', family: 'precision', tags: ['accessoire'], minRound: 1, price: 18, legendary: true,
    keystone: { critBurn: 3 } },
  { id: 'insigne_lames', name: 'Insigne des Lames', short: 'Insigne', shape: ['X'], category: 'accessoire', family: 'tactique', tags: ['accessoire'], minRound: 1, price: 16, legendary: true,
    keystone: { meleeBleed: 4, meleeHaste: 0.25 } },
  { id: 'condensateur', name: 'Condensateur', short: 'Condens.', shape: ['XX'], category: 'composant', family: 'tactique', tags: ['composant'], minRound: 1, price: 18, legendary: true,
    keystone: { shockEvery: 8 } },
  { id: 'cocktail', name: 'Cocktail de combat', short: 'Cocktail', shape: ['X'], category: 'medical', family: 'rempart', tags: ['medical'], minRound: 1, price: 16, legendary: true,
    endRegen: 0.4, keystone: { endMax: 6 },
    stars: [{ want: ['arme'], effect: { on: 'target', kind: 'cadence', value: 0.08 }, max: 1 }] },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(DEFS.map((d) => [d.id, d]));
export const ITEM_IDS: string[] = DEFS.map((d) => d.id);
/** Objets qu'on peut trouver dans le butin ou la boutique (hors objets assemblés et légendaires). */
export const LOOT_IDS: string[] = DEFS.filter((d) => !d.crafted && !d.legendary).map((d) => d.id);
/** Objets légendaires : tirés à part (caisse épique, boutique, sac des Élites), un seul exemplaire par partie. */
export const LEGENDARY_IDS: string[] = DEFS.filter((d) => d.legendary).map((d) => d.id);

export const FAMILY_INFO: Record<Family, { name: string; color: number; hex: string; tier2: string; tier4: string }> = {
  rafale: { name: 'Rafale', color: 0xf4b06a, hex: '#f4b06a', tier2: '+15 % de cadence des armes Rafale', tier4: '1 balle sur 3 touche deux fois' },
  precision: { name: 'Précision', color: 0x5fb3e0, hex: '#9ad3f2', tier2: '+10 % de critique pour toutes les armes', tier4: 'Critiques ×2,25 au lieu de ×2' },
  demolition: { name: 'Démolition', color: 0xc94a4a, hex: '#ef7b72', tier2: '+1 charge pour chaque explosif', tier4: "Explosions et fusils à pompe ignorent l'armure" },
  rempart: { name: 'Rempart', color: 0xa9bccb, hex: '#a9bccb', tier2: "+30 % d'armure", tier4: "L'armure se régénère de 3 par seconde" },
  tactique: { name: 'Tactique', color: 0xb5d65a, hex: '#b5d65a', tier2: 'Le fumigène dure 50 % plus longtemps', tier4: 'Drones et radios agissent 30 % plus vite' },
};

export const CATEGORY_COLORS: Record<Category, number> = {
  arme: 0x4a4d3a,
  munition: 0x6f5238,
  accessoire: 0x30343a,
  protection: 0x565b61,
  explosif: 0x6e2f27,
  medical: 0x3f5a35,
  composant: 0x4a3626,
};

export const CATEGORY_NAMES: Record<Category, string> = {
  arme: 'Arme',
  munition: 'Munition',
  accessoire: 'Accessoire',
  protection: 'Protection',
  explosif: 'Explosif',
  medical: 'Médical',
  composant: 'Composant',
};
