// Mode Zombie : données (armes de départ, accessoires, atouts, power-ups, évolutions, zombies, objectifs).
// Aucune dépendance à Phaser : ces tables sont lues par la logique pure, les scènes et les tests.

/* ------------------------------------------------------------------ */
/* Armes                                                               */
/* ------------------------------------------------------------------ */

export type SlotId = 'bouche' | 'optique' | 'sous_canon' | 'chargeur' | 'munitions';
export const SLOTS: SlotId[] = ['bouche', 'optique', 'sous_canon', 'chargeur', 'munitions'];
export const SLOT_NAMES: Record<SlotId, string> = {
  bouche: 'Bouche',
  optique: 'Optique',
  sous_canon: 'Sous-canon',
  chargeur: 'Chargeur',
  munitions: 'Munitions',
};

export type AccId =
  | 'silencieux' | 'refroidisseur'
  | 'viseur_holo' | 'lunette'
  | 'poignee' | 'bipied'
  | 'chg_etendu' | 'chg_tambour'
  | 'perforantes' | 'tracantes' | 'chg_incendiaire' | 'chg_electrique';

/** Bonus d'un accessoire : multiplicateurs (0.15 = +15 %) ou valeurs ajoutées. */
export interface AccMods {
  dmg?: number;
  rate?: number;
  range?: number;
  spread?: number;
  crit?: number;
  mag?: number;
  reload?: number;
  speed?: number;
  move?: number;
  pierce?: number;
  burn?: number;
  shock?: number;
}

export interface AccDef {
  id: AccId;
  name: string;
  slot: SlotId;
  desc: string;
  mods: AccMods;
}

export const ACCESSORIES: Record<AccId, AccDef> = {
  silencieux: { id: 'silencieux', name: 'Silencieux', slot: 'bouche', desc: '+15 % dégâts, +10 % portée', mods: { dmg: 0.15, range: 0.1 } },
  refroidisseur: { id: 'refroidisseur', name: 'Refroidisseur', slot: 'bouche', desc: '+15 % cadence', mods: { rate: 0.15 } },
  viseur_holo: { id: 'viseur_holo', name: 'Viseur holo', slot: 'optique', desc: '+8 % critique, −25 % dispersion', mods: { crit: 0.08, spread: -0.25 } },
  lunette: { id: 'lunette', name: 'Lunette ×4', slot: 'optique', desc: '+35 % portée, +12 % critique', mods: { range: 0.35, crit: 0.12 } },
  poignee: { id: 'poignee', name: 'Poignée verticale', slot: 'sous_canon', desc: '−40 % dispersion, +8 % cadence', mods: { spread: -0.4, rate: 0.08 } },
  bipied: { id: 'bipied', name: 'Bipied', slot: 'sous_canon', desc: '+22 % dégâts, −6 % vitesse', mods: { dmg: 0.22, move: -0.06 } },
  chg_etendu: { id: 'chg_etendu', name: 'Chargeur étendu', slot: 'chargeur', desc: '+50 % capacité, −10 % recharge', mods: { mag: 0.5, reload: -0.1 } },
  chg_tambour: { id: 'chg_tambour', name: 'Chargeur tambour', slot: 'chargeur', desc: '+120 % capacité, +15 % recharge', mods: { mag: 1.2, reload: 0.15 } },
  perforantes: { id: 'perforantes', name: 'Perforantes', slot: 'munitions', desc: '+1 perforation', mods: { pierce: 1 } },
  tracantes: { id: 'tracantes', name: 'Traçantes', slot: 'munitions', desc: '+10 % critique, balles +30 % plus rapides', mods: { crit: 0.1, speed: 0.3 } },
  chg_incendiaire: { id: 'chg_incendiaire', name: 'Balles incendiaires', slot: 'munitions', desc: 'Enflamme : 30 % des dégâts par seconde, 3 s', mods: { burn: 0.3 } },
  chg_electrique: { id: 'chg_electrique', name: 'Balles électriques', slot: 'munitions', desc: '15 % de chance d’arc sur 2 zombies proches', mods: { shock: 0.15 } },
};

export type WeaponId = 'pistolet' | 'smg' | 'fusil_assaut' | 'pompe' | 'precision' | 'revolver' | 'kr4_mitrailleur';

export interface WeaponDef {
  id: WeaponId;
  /** Nom affiché (repris du jeu principal). */
  name: string;
  /** Classe d'arme. */
  wclass: string;
  desc: string;
  /** Dégâts par projectile. */
  dmg: number;
  /** Tirs par seconde. */
  rate: number;
  /** Projectiles par tir (plombs du fusil à pompe). */
  pellets: number;
  /** Dispersion (demi-angle, radians). */
  spread: number;
  /** Vitesse des balles (px/s). */
  speed: number;
  /** Portée (px) : distance max d'acquisition et de vol. */
  range: number;
  pierce: number;
  mag: number;
  /** Temps de rechargement (s). */
  reload: number;
  crit: number;
  /** Recul infligé aux zombies (px). */
  knock: number;
  /** Multiplicateur de vitesse de déplacement. */
  move: number;
  /** Ordre de déblocage des accessoires (niveaux 2, 3, 4…). */
  unlocks: AccId[];
}

const ALL_ACC = Object.keys(ACCESSORIES) as AccId[];
/** Ordre de déblocage : les accessoires les plus utiles à l'arme d'abord, puis tous les autres. */
const order = (...first: AccId[]): AccId[] => [...first, ...ALL_ACC.filter((a) => !first.includes(a))];

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistolet: {
    id: 'pistolet', name: 'Pistolet Mamba', wclass: 'Pistolet', desc: 'Précis et rapide à recharger. Fiable du début à la fin.',
    dmg: 16, rate: 2.6, pellets: 1, spread: 0.04, speed: 950, range: 480, pierce: 0, mag: 12, reload: 0.9, crit: 0.08, knock: 8, move: 1.05,
    unlocks: order('poignee', 'chg_etendu', 'viseur_holo', 'silencieux', 'perforantes'),
  },
  smg: {
    id: 'smg', name: 'SMG Furet', wclass: 'SMG', desc: 'Un mur de balles à courte portée. Vide son chargeur en un clin d’œil.',
    dmg: 7, rate: 8, pellets: 1, spread: 0.14, speed: 850, range: 400, pierce: 0, mag: 32, reload: 1.5, crit: 0.05, knock: 3, move: 1.05,
    unlocks: order('poignee', 'chg_etendu', 'refroidisseur', 'viseur_holo', 'chg_tambour'),
  },
  fusil_assaut: {
    id: 'fusil_assaut', name: "Fusil d'assaut KR-4", wclass: "Fusil d'assaut", desc: 'Polyvalent : bonne cadence, bonne portée.',
    dmg: 12, rate: 4.8, pellets: 1, spread: 0.06, speed: 1050, range: 560, pierce: 0, mag: 30, reload: 1.7, crit: 0.06, knock: 5, move: 1,
    unlocks: order('viseur_holo', 'chg_etendu', 'poignee', 'perforantes', 'silencieux'),
  },
  pompe: {
    id: 'pompe', name: 'Pompe Sanglier', wclass: 'Fusil à pompe', desc: 'Six plombs qui repoussent tout. Dévastateur au contact.',
    dmg: 10, rate: 1.15, pellets: 6, spread: 0.32, speed: 800, range: 300, pierce: 0, mag: 6, reload: 2.1, crit: 0.04, knock: 22, move: 1,
    unlocks: order('chg_etendu', 'poignee', 'chg_incendiaire', 'silencieux', 'chg_tambour'),
  },
  precision: {
    id: 'precision', name: 'Fusil de précision Aigle', wclass: 'Fusil de précision', desc: 'Une balle, une ligne de zombies. Lent mais perforant.',
    dmg: 68, rate: 0.85, pellets: 1, spread: 0.0, speed: 1700, range: 900, pierce: 3, mag: 5, reload: 2.0, crit: 0.15, knock: 16, move: 0.95,
    unlocks: order('lunette', 'bipied', 'chg_etendu', 'tracantes', 'silencieux'),
  },
  revolver: {
    id: 'revolver', name: 'Revolver Taureau', wclass: 'Pistolet', desc: 'Six coups lourds qui traversent. Rechargement lent.',
    dmg: 36, rate: 1.6, pellets: 1, spread: 0.03, speed: 1100, range: 520, pierce: 1, mag: 6, reload: 1.8, crit: 0.12, knock: 14, move: 1.05,
    unlocks: order('viseur_holo', 'chg_etendu', 'perforantes', 'silencieux', 'lunette'),
  },
  kr4_mitrailleur: {
    id: 'kr4_mitrailleur', name: 'KR-4 Mitrailleur', wclass: 'Mitrailleuse', desc: 'Bande de 100 coups. Lourde : on avance moins vite.',
    dmg: 10, rate: 9, pellets: 1, spread: 0.16, speed: 1000, range: 520, pierce: 0, mag: 100, reload: 3.2, crit: 0.05, knock: 5, move: 0.88,
    unlocks: order('bipied', 'poignee', 'refroidisseur', 'perforantes', 'chg_tambour'),
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
/** Armes disponibles dès la première partie. */
export const STARTER_WEAPONS: WeaponId[] = ['pistolet', 'smg', 'fusil_assaut', 'pompe', 'precision'];

/** Niveau max d'une arme (accessoires débloqués aux niveaux 2 à 13, puis maîtrise). */
export const WEAPON_MAX_LEVEL = 15;
/** Bonus de dégâts permanent par niveau d'arme au-delà du premier. */
export const WEAPON_DMG_PER_LEVEL = 0.03;

/* ------------------------------------------------------------------ */
/* Classes : apparence et atouts                                        */
/* ------------------------------------------------------------------ */

export const FIGS = ['viper', 'sentinelle', 'soldat', 'tireur', 'lieutenant', 'mitrailleur', 'commandant'] as const;
export type FigId = (typeof FIGS)[number];
export const FIG_NAMES: Record<FigId, string> = {
  viper: 'Viper', sentinelle: 'Sentinelle', soldat: 'Soldat', tireur: 'Tireur', lieutenant: 'Lieutenant', mitrailleur: 'Mitrailleur', commandant: 'Commandant',
};

export type PerkId = 'medecin' | 'sapeur' | 'eclaireur' | 'tireur' | 'colosse' | 'artificier' | 'veinard';

export interface PerkDef {
  id: PerkId;
  name: string;
  desc: string;
  icon: string;
}

export const PERKS: Record<PerkId, PerkDef> = {
  medecin: { id: 'medecin', name: 'Médecin', desc: 'Régénère 0,6 PV/s ; les trousses soignent 50 % de plus.', icon: 'ifak' },
  sapeur: { id: 'sapeur', name: 'Sapeur', desc: 'Commence avec Grenades niv. 1 ; grenades 25 % plus fréquentes.', icon: 'frag' },
  eclaireur: { id: 'eclaireur', name: 'Éclaireur', desc: '+15 % vitesse de déplacement, +40 % rayon de ramassage.', icon: 'casque' },
  tireur: { id: 'tireur', name: "Tireur d'élite", desc: '+12 % de critique, +20 % de portée.', icon: 'lunette' },
  colosse: { id: 'colosse', name: 'Colosse', desc: '+40 PV max, −10 % dégâts subis, −8 % vitesse.', icon: 'armure_lourde' },
  artificier: { id: 'artificier', name: 'Artificier', desc: 'Explosions : +30 % de zone et +20 % de dégâts.', icon: 'thermite' },
  veinard: { id: 'veinard', name: 'Veinard', desc: '4 choix de power-up au lieu de 3, et une relance de plus.', icon: 'ration' },
};
export const PERK_IDS = Object.keys(PERKS) as PerkId[];
export const STARTER_PERKS: PerkId[] = ['medecin', 'sapeur', 'eclaireur', 'tireur'];

/* ------------------------------------------------------------------ */
/* Power-ups (en partie)                                                */
/* ------------------------------------------------------------------ */

export type PowerId =
  | 'cadence' | 'degats' | 'ricochet' | 'incendiaire' | 'explosif' | 'perforation' | 'multitir' | 'critique' | 'electrique' | 'recharge'
  | 'grenades' | 'drone' | 'mines' | 'lames' | 'tourelle' | 'artillerie'
  | 'pv' | 'regen' | 'vitesse' | 'aimant' | 'armure';

export type EvoId = 'bombardement' | 'tourbillon' | 'escadrille' | 'napalm' | 'seconde_vie' | 'forteresse';

export interface PowerDef {
  id: PowerId;
  name: string;
  /** Famille : modifie l'arme, ajoute une arme secondaire, ou améliore le soldat. */
  kind: 'arme' | 'soutien' | 'soldat';
  max: number;
  /** Texture de l'icône : sprite d'objet (it-…) ou icône vectorielle (ic-…). */
  icon: string;
  /** Effet du niveau `lvl` (1 = premier niveau pris). */
  desc: (lvl: number) => string;
}

const pct = (x: number) => `${Math.round(x * 100)} %`;

export const POWERS: Record<PowerId, PowerDef> = {
  cadence: { id: 'cadence', name: 'Cadence', kind: 'arme', max: 5, icon: 'it-refroidisseur', desc: () => '+12 % de cadence de tir' },
  degats: { id: 'degats', name: 'Gros calibre', kind: 'arme', max: 5, icon: 'it-chg_762', desc: () => '+15 % de dégâts (toutes les sources)' },
  ricochet: { id: 'ricochet', name: 'Ricochet', kind: 'arme', max: 4, icon: 'ic-link', desc: (l) => `Les balles rebondissent vers un autre zombie (${l} rebond${l > 1 ? 's' : ''})` },
  incendiaire: { id: 'incendiaire', name: 'Balles incendiaires', kind: 'arme', max: 5, icon: 'it-chg_incendiaire', desc: (l) => `Brûlure : ${pct(0.2 + 0.1 * l)} des dégâts par seconde pendant 3 s` },
  explosif: { id: 'explosif', name: 'Balles explosives', kind: 'arme', max: 5, icon: 'it-sous_munitions', desc: (l) => `Explosion à l'impact : ${pct(0.2 + 0.1 * l)} des dégâts, rayon ${40 + 10 * l}` },
  perforation: { id: 'perforation', name: 'Perforation', kind: 'arme', max: 4, icon: 'it-perforantes', desc: () => 'Les balles traversent un zombie de plus' },
  multitir: { id: 'multitir', name: 'Tir multiple', kind: 'arme', max: 4, icon: 'it-chg_tambour', desc: () => '+1 projectile par tir (+2 plombs au fusil à pompe)' },
  critique: { id: 'critique', name: 'Coup au but', kind: 'arme', max: 5, icon: 'it-lunette', desc: () => '+6 % de chance de critique, critiques +10 % plus forts' },
  electrique: { id: 'electrique', name: 'Arc électrique', kind: 'arme', max: 5, icon: 'it-bobine_tesla', desc: (l) => `${pct(0.08 + 0.06 * l)} de chance qu'un tir électrise ${2 + Math.floor(l / 2)} zombies proches` },
  recharge: { id: 'recharge', name: 'Main sûre', kind: 'arme', max: 5, icon: 'it-chg_etendu', desc: () => '−12 % temps de recharge, +15 % de capacité' },
  grenades: { id: 'grenades', name: 'Grenades', kind: 'soutien', max: 5, icon: 'it-frag', desc: (l) => l === 1 ? 'Lance une grenade automatiquement toutes les 3,5 s' : 'Grenades plus fréquentes, plus fortes, +1 grenade tous les 2 niveaux' },
  drone: { id: 'drone', name: 'Drone de combat', kind: 'soutien', max: 5, icon: 'it-batterie', desc: (l) => l === 1 ? 'Un drone tourne autour de toi et tire sur les zombies' : l === 3 || l === 5 ? '+1 drone, tirs plus forts' : 'Drones plus rapides et plus forts' },
  mines: { id: 'mines', name: 'Mines', kind: 'soutien', max: 5, icon: 'it-thermite', desc: (l) => l === 1 ? 'Pose une mine derrière toi toutes les 3,5 s' : 'Mines plus fréquentes et plus puissantes' },
  lames: { id: 'lames', name: 'Machettes', kind: 'soutien', max: 5, icon: 'it-machette', desc: (l) => l === 1 ? 'Une machette tourne autour de toi' : '+1 machette, plus de dégâts' },
  tourelle: { id: 'tourelle', name: 'Tourelle', kind: 'soutien', max: 5, icon: 'it-kr4_mitrailleur', desc: (l) => l === 1 ? 'Déploie une tourelle toutes les 14 s (8 s de tir)' : 'Tourelle plus durable et plus rapide' },
  artillerie: { id: 'artillerie', name: "Frappe d'artillerie", kind: 'soutien', max: 5, icon: 'it-bombe_phosphore', desc: (l) => l === 1 ? 'Toutes les 9 s, 3 obus tombent sur les zombies' : '+1 obus, frappes plus fréquentes' },
  pv: { id: 'pv', name: 'Gilet lourd', kind: 'soldat', max: 5, icon: 'it-plaque', desc: () => '+20 PV max (et soigne 20 PV)' },
  regen: { id: 'regen', name: 'Trousse de soins', kind: 'soldat', max: 5, icon: 'it-ifak', desc: () => '+0,4 PV par seconde' },
  vitesse: { id: 'vitesse', name: 'Rangers', kind: 'soldat', max: 5, icon: 'ic-chev', desc: () => '+8 % de vitesse de déplacement' },
  aimant: { id: 'aimant', name: 'Aimant', kind: 'soldat', max: 5, icon: 'ic-compass', desc: () => '+35 % de rayon de ramassage de l’XP' },
  armure: { id: 'armure', name: 'Plaques', kind: 'soldat', max: 5, icon: 'it-casque_lourd', desc: () => '−7 % de dégâts subis' },
};
export const POWER_IDS = Object.keys(POWERS) as PowerId[];

export interface EvoDef {
  id: EvoId;
  name: string;
  from: [PowerId, PowerId];
  icon: string;
  desc: string;
}

export const EVOLUTIONS: Record<EvoId, EvoDef> = {
  bombardement: { id: 'bombardement', name: 'Bombardement', from: ['explosif', 'grenades'], icon: 'it-sous_munitions', desc: 'Les grenades deviennent un tapis de bombes : 6 grenades toutes les 2 s, zone ×1,3.' },
  tourbillon: { id: 'tourbillon', name: 'Tourbillon', from: ['lames', 'vitesse'], icon: 'it-lame_rouge', desc: '8 lames rouges, plus larges, dégâts ×2, elles repoussent les zombies.' },
  escadrille: { id: 'escadrille', name: 'Escadrille', from: ['drone', 'cadence'], icon: 'it-bobine_tesla', desc: '4 drones, cadence doublée, balles perforantes.' },
  napalm: { id: 'napalm', name: 'Napalm', from: ['incendiaire', 'mines'], icon: 'it-grenade_incendiaire', desc: 'Les mines laissent une mare de feu ; brûlure ×1,5.' },
  seconde_vie: { id: 'seconde_vie', name: 'Seconde vie', from: ['pv', 'regen'], icon: 'it-kit_trauma', desc: 'Une fois par partie, revient à 60 % des PV au lieu de mourir. Régénération ×2.' },
  forteresse: { id: 'forteresse', name: 'Forteresse', from: ['tourelle', 'artillerie'], icon: 'it-rhinoceros', desc: 'Deux tourelles permanentes, artillerie toutes les 4 s.' },
};
export const EVO_IDS = Object.keys(EVOLUTIONS) as EvoId[];

/* ------------------------------------------------------------------ */
/* Zombies                                                             */
/* ------------------------------------------------------------------ */

export type ZType = 'marcheur' | 'coureur' | 'cracheur' | 'kamikaze' | 'brute' | 'boss';

export interface ZDef {
  type: ZType;
  name: string;
  hp: number;
  speed: number;
  /** Dégâts au contact (par coup). */
  dmg: number;
  /** Rayon de collision (px). */
  r: number;
  /** XP lâchée. */
  xp: number;
  /** Résistance au recul (1 = normal). */
  mass: number;
  /** Points d'XP d'arme pour le kill. */
  weaponXp: number;
}

export const ZOMBIES: Record<ZType, ZDef> = {
  marcheur: { type: 'marcheur', name: 'Marcheur', hp: 20, speed: 54, dmg: 8, r: 16, xp: 1, mass: 1, weaponXp: 1 },
  coureur: { type: 'coureur', name: 'Coureur', hp: 13, speed: 118, dmg: 6, r: 14, xp: 1, mass: 0.8, weaponXp: 1 },
  cracheur: { type: 'cracheur', name: 'Cracheur', hp: 30, speed: 50, dmg: 6, r: 16, xp: 2, mass: 1, weaponXp: 2 },
  kamikaze: { type: 'kamikaze', name: 'Gonflé', hp: 26, speed: 88, dmg: 0, r: 17, xp: 2, mass: 1.2, weaponXp: 2 },
  brute: { type: 'brute', name: 'Brute', hp: 190, speed: 38, dmg: 18, r: 26, xp: 6, mass: 5, weaponXp: 4 },
  boss: { type: 'boss', name: 'Le Colosse', hp: 2600, speed: 44, dmg: 30, r: 46, xp: 60, mass: 40, weaponXp: 60 },
};

/** Élite : un zombie normal, plus gros et rouge, qui lâche une caisse. */
export const ELITE = { hp: 7, dmg: 1.5, r: 1.3, xp: 8, weaponXp: 10 };
/** Crachat acide du cracheur. */
export const SPIT = { range: 320, cooldown: 2.8, dmg: 9, speed: 260 };
/** Explosion du gonflé (à son contact ou à sa mort). */
export const BLAST = { radius: 85, dmg: 26, trigger: 46 };

/* ------------------------------------------------------------------ */
/* Partie                                                              */
/* ------------------------------------------------------------------ */

/** Durée d'une partie (s) : survivre jusque-là = extraction. */
export const RUN_TIME = 600;
/** Boss : un toutes les 3 minutes. */
export const BOSS_TIMES = [180, 360, 540];
/** Plafond d'ennemis en vie. */
export const MAX_ZOMBIES = 250;

export const PLAYER = { hp: 100, speed: 210, r: 18, pickup: 70, invuln: 0.12 };

/** XP nécessaire pour passer du niveau `lvl` au suivant (niveau de personnage, en partie). */
export function xpToNext(lvl: number): number {
  const k = lvl - 1;
  return Math.round(5 + 6 * k + 0.32 * k * k);
}

/* ------------------------------------------------------------------ */
/* Objectifs (débloquent armes et atouts)                              */
/* ------------------------------------------------------------------ */

export type GoalId = 'survive5' | 'boss1' | 'kills1500' | 'win1' | 'level20' | 'endless15';

export interface GoalDef {
  id: GoalId;
  name: string;
  reward: { weapon?: WeaponId; perk?: PerkId };
  rewardText: string;
}

export const GOALS: GoalDef[] = [
  { id: 'survive5', name: 'Survivre 5 minutes', reward: { weapon: 'revolver' }, rewardText: 'Arme : Revolver Taureau' },
  { id: 'boss1', name: 'Abattre un Colosse', reward: { perk: 'artificier' }, rewardText: 'Atout : Artificier' },
  { id: 'kills1500', name: '1 500 zombies au total', reward: { perk: 'colosse' }, rewardText: 'Atout : Colosse' },
  { id: 'level20', name: 'Atteindre le niveau 20', reward: { perk: 'veinard' }, rewardText: 'Atout : Veinard' },
  { id: 'win1', name: "Tenir 10 minutes (extraction)", reward: { weapon: 'kr4_mitrailleur' }, rewardText: 'Arme : KR-4 Mitrailleur' },
  { id: 'endless15', name: 'Tenir 15 minutes (sans fin)', reward: {}, rewardText: 'Titre : Increvable' },
];
