// Définitions des objets du prototype. Toutes les valeurs sont celles de la rareté Commun.
// Elles sont multipliées par la rareté (voir logic/rarity.ts).

export type Tag = 'arme' | 'arme_longue' | 'munition' | 'accessoire' | 'protection' | 'explosif' | 'medical';
export type Caliber = '9mm' | '5.56' | '7.62' | '12G' | '.44';
export type Family = 'rafale' | 'precision' | 'demolition' | 'rempart' | 'tactique';
export type Category = 'arme' | 'munition' | 'accessoire' | 'protection' | 'explosif' | 'medical';

export interface WeaponStats {
  dmg: number;
  interval: number; // secondes entre deux tirs
  mag: number;
  reload: number; // secondes
  targets?: number;
  /** Toujours alimentée : ses munitions font partie de l'arme (objets assemblés). */
  selfFed?: boolean;
  /** N'importe quel chargeur adjacent l'alimente, quel que soit son calibre. */
  feedsAny?: boolean;
  /** Le 1er tir du combat est toujours critique. */
  firstCrit?: boolean;
  /** Part de l'armure ennemie ignorée (0..1). */
  armorPierce?: number;
  /** Un critique retarde le prochain tir de la cible de ce nombre de secondes. */
  critStun?: number;
  /** Dégâts en plus à chaque touche, qui ignorent l'armure (incendiaire). */
  trueDmg?: number;
}

export interface ActiveStats {
  kind: 'frag' | 'smoke' | 'heal' | 'flash' | 'adrenaline';
  value: number;
  cooldown: number;
  charges: number;
  duration?: number;
  threshold?: number;
  /** Explosion qui ignore l'armure (thermite). */
  pierce?: boolean;
}

export interface SynergyStats {
  kind: 'mag' | 'scope' | 'silencer' | 'pierce' | 'grip' | 'extmag' | 'holo' | 'bipod';
  value: number;
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
  minRarity: number;
  price: number;
  weapon?: WeaponStats;
  armor?: number;
  /** Chaque balle reçue perd ce nombre de dégâts (minimum 1). */
  flatReduce?: number;
  /** Objet obtenu par une recette de l'Armurier : jamais dans le butin ni la boutique. */
  crafted?: boolean;
  active?: ActiveStats;
  synergy?: SynergyStats;
}

const DEFS: ItemDef[] = [
  { id: 'pistolet', name: 'Pistolet Mamba', short: 'Mamba', wclass: 'Pistolet', shape: ['XX', 'X.'], category: 'arme', family: 'rafale', tags: ['arme'], caliber: '9mm', minRarity: 0, price: 4,
    weapon: { dmg: 7, interval: 1.0, mag: 6, reload: 2.0 } },
  { id: 'smg', name: 'SMG Furet', short: 'Furet', wclass: 'SMG', shape: ['XXX', '.X.'], category: 'arme', family: 'rafale', tags: ['arme'], caliber: '9mm', minRarity: 0, price: 6,
    weapon: { dmg: 4.5, interval: 0.4, mag: 15, reload: 2.5 } },
  { id: 'fusil_assaut', name: "Fusil d'assaut KR-4", short: 'KR-4', wclass: "Fusil d'assaut", shape: ['XXXX', '.X..'], category: 'arme', family: 'rafale', tags: ['arme', 'arme_longue'], caliber: '5.56', minRarity: 0, price: 8,
    weapon: { dmg: 10, interval: 0.7, mag: 15, reload: 2.5 } },
  { id: 'pompe', name: 'Pompe Sanglier', short: 'Sanglier', wclass: 'Fusil à pompe', shape: ['XXXX', 'X...'], category: 'arme', family: 'demolition', tags: ['arme'], caliber: '12G', minRarity: 1, price: 8,
    weapon: { dmg: 18.5, interval: 1.5, mag: 4, reload: 3.0, targets: 2 } },
  { id: 'precision', name: 'Fusil de précision Aigle', short: 'Aigle', wclass: 'Fusil de précision', shape: ['XXXXX', '..X..'], category: 'arme', family: 'precision', tags: ['arme', 'arme_longue'], caliber: '7.62', minRarity: 2, price: 14,
    weapon: { dmg: 51, interval: 3.0, mag: 4, reload: 3.5 } },
  { id: 'chg_9mm', name: 'Chargeur 9 mm', short: 'Chg 9mm', shape: ['X'], category: 'munition', family: 'rafale', tags: ['munition'], caliber: '9mm', minRarity: 0, price: 2,
    synergy: { kind: 'mag', value: 0.25 } },
  { id: 'chg_556', name: 'Chargeur 5.56', short: 'Chg 5.56', shape: ['X'], category: 'munition', family: 'rafale', tags: ['munition'], caliber: '5.56', minRarity: 0, price: 2,
    synergy: { kind: 'mag', value: 0.25 } },
  { id: 'chg_762', name: 'Chargeur 7.62', short: 'Chg 7.62', shape: ['X'], category: 'munition', family: 'precision', tags: ['munition'], caliber: '7.62', minRarity: 1, price: 3,
    synergy: { kind: 'mag', value: 0.25 } },
  { id: 'lunette', name: 'Lunette ×4', short: 'Lunette', shape: ['XX'], category: 'accessoire', family: 'precision', tags: ['accessoire'], minRarity: 1, price: 5,
    synergy: { kind: 'scope', value: 0.35 } },
  { id: 'silencieux', name: 'Silencieux', short: 'Silenc.', shape: ['XX'], category: 'accessoire', family: 'precision', tags: ['accessoire'], minRarity: 2, price: 7,
    synergy: { kind: 'silencer', value: 1 } },
  { id: 'plaque', name: 'Plaque céramique', short: 'Plaque', shape: ['XX', 'XX', 'XX'], category: 'protection', family: 'rempart', tags: ['protection'], minRarity: 1, price: 7,
    armor: 40 },
  { id: 'casque', name: 'Casque balistique', short: 'Casque', shape: ['XX', 'XX'], category: 'protection', family: 'rempart', tags: ['protection'], minRarity: 0, price: 4,
    armor: 15 },
  { id: 'frag', name: 'Grenade frag', short: 'Frag', shape: ['X'], category: 'explosif', family: 'demolition', tags: ['explosif'], minRarity: 0, price: 4,
    active: { kind: 'frag', value: 20, cooldown: 7, charges: 2 } },
  { id: 'fumigene', name: 'Fumigène', short: 'Fumi', shape: ['X', 'X'], category: 'explosif', family: 'tactique', tags: ['explosif'], minRarity: 0, price: 3,
    active: { kind: 'smoke', value: 0.5, cooldown: 8, charges: 2, duration: 3 } },
  { id: 'ifak', name: 'Trousse IFAK', short: 'IFAK', shape: ['XX', 'XX'], category: 'medical', family: 'rempart', tags: ['medical'], minRarity: 0, price: 4,
    active: { kind: 'heal', value: 30, cooldown: 4, charges: 1, threshold: 0.5 } },
  { id: 'perforantes', name: 'Munitions perforantes', short: 'Perfo.', shape: ['X'], category: 'munition', family: 'precision', tags: ['munition'], minRarity: 2, price: 6,
    synergy: { kind: 'pierce', value: 0.3 } },
  { id: 'flash', name: 'Grenade flash', short: 'Flash', shape: ['X'], category: 'explosif', family: 'demolition', tags: ['explosif'], minRarity: 1, price: 5,
    active: { kind: 'flash', value: 1.5, cooldown: 8, charges: 2 } },
  { id: 'seringue', name: "Seringue d'adrénaline", short: 'Adré.', shape: ['XX'], category: 'medical', family: 'rempart', tags: ['medical'], minRarity: 1, price: 5,
    active: { kind: 'adrenaline', value: 0.3, cooldown: 6, charges: 1, duration: 4, threshold: 0.3 } },
  // --- Variantes d'armes (même classe, profils différents)
  { id: 'ar_vesta', name: 'Bullpup Vesta', short: 'Vesta', wclass: "Fusil d'assaut", shape: ['XXX', '.X.'], category: 'arme', family: 'rafale', tags: ['arme', 'arme_longue'], caliber: '5.56', minRarity: 0, price: 8,
    weapon: { dmg: 7.5, interval: 0.55, mag: 15, reload: 2.2 } },
  { id: 'ar_hades', name: 'Fusil de combat Hadès', short: 'Hadès', wclass: "Fusil d'assaut", shape: ['XXXX', '.XX.'], category: 'arme', family: 'rafale', tags: ['arme', 'arme_longue'], caliber: '5.56', minRarity: 1, price: 10,
    weapon: { dmg: 18, interval: 1.05, mag: 10, reload: 3.0 } },
  { id: 'ar_lynx', name: 'Carabine Lynx', short: 'Lynx', wclass: "Fusil d'assaut", shape: ['XXX', '..X'], category: 'arme', family: 'rafale', tags: ['arme', 'arme_longue'], caliber: '5.56', minRarity: 0, price: 7,
    weapon: { dmg: 6, interval: 0.45, mag: 12, reload: 1.8 } },
  { id: 'smg_guepe', name: 'Pistolet-mitrailleur Guêpe', short: 'Guêpe', wclass: 'SMG', shape: ['XX', '.X'], category: 'arme', family: 'rafale', tags: ['arme'], caliber: '9mm', minRarity: 0, price: 5,
    weapon: { dmg: 3, interval: 0.28, mag: 12, reload: 1.8 } },
  { id: 'smg_ours', name: 'SMG lourd Ours', short: 'Ours', wclass: 'SMG', shape: ['XXX', 'XX.'], category: 'arme', family: 'rafale', tags: ['arme'], caliber: '9mm', minRarity: 1, price: 8,
    weapon: { dmg: 6, interval: 0.45, mag: 18, reload: 2.6 } },
  { id: 'revolver', name: 'Revolver Taureau', short: 'Taureau', wclass: 'Pistolet', shape: ['XXX', 'X..'], category: 'arme', family: 'precision', tags: ['arme'], caliber: '.44', minRarity: 1, price: 7,
    weapon: { dmg: 20.5, interval: 1.4, mag: 4, reload: 2.4 } },
  { id: 'pompe_belier', name: 'Pompe auto Bélier', short: 'Bélier', wclass: 'Fusil à pompe', shape: ['XXXX', 'XX..'], category: 'arme', family: 'demolition', tags: ['arme'], caliber: '12G', minRarity: 2, price: 12,
    weapon: { dmg: 13, interval: 0.95, mag: 4, reload: 3.2, targets: 2 } },
  { id: 'dmr_faucon', name: 'DMR Faucon', short: 'Faucon', wclass: 'Fusil de précision', shape: ['XXXX', '..X.'], category: 'arme', family: 'precision', tags: ['arme', 'arme_longue'], caliber: '7.62', minRarity: 1, price: 10,
    weapon: { dmg: 27, interval: 1.6, mag: 5, reload: 3.0 } },
  // --- Alimentation et accessoires : sans eux, une arme vaut peu
  { id: 'chg_12g', name: 'Cartouches 12G', short: 'Cart. 12G', shape: ['X'], category: 'munition', family: 'demolition', tags: ['munition'], caliber: '12G', minRarity: 1, price: 3,
    synergy: { kind: 'mag', value: 0.25 } },
  { id: 'chg_44', name: 'Balles .44', short: 'Balles .44', shape: ['X'], category: 'munition', family: 'precision', tags: ['munition'], caliber: '.44', minRarity: 1, price: 3,
    synergy: { kind: 'mag', value: 0.25 } },
  { id: 'poignee', name: 'Poignée verticale', short: 'Poignée', shape: ['X', 'X'], category: 'accessoire', family: 'rafale', tags: ['accessoire'], minRarity: 0, price: 4,
    synergy: { kind: 'grip', value: 0.25 } },
  { id: 'chg_etendu', name: 'Chargeur étendu', short: 'Étendu', shape: ['X', 'X'], category: 'accessoire', family: 'rafale', tags: ['accessoire'], minRarity: 1, price: 5,
    synergy: { kind: 'extmag', value: 0.5 } },
  { id: 'viseur_holo', name: 'Viseur holo', short: 'Holo', shape: ['X'], category: 'accessoire', family: 'precision', tags: ['accessoire'], minRarity: 0, price: 4,
    synergy: { kind: 'holo', value: 0.25 } },
  { id: 'bipied', name: 'Bipied', short: 'Bipied', shape: ['XX'], category: 'accessoire', family: 'precision', tags: ['accessoire'], minRarity: 1, price: 5,
    synergy: { kind: 'bipod', value: 0.35 } },
  // --- Objets assemblés à l'Établi (recettes de l'Armurier, voir data/recipes.ts)
  { id: 'kr4_tactique', name: 'KR-4 Tactique', short: 'KR-4 T.', wclass: "Fusil d'assaut", shape: ['XXXX', '.XX.'], category: 'arme', family: 'rafale', tags: ['arme', 'arme_longue'], caliber: '5.56', minRarity: 0, price: 18, crafted: true,
    weapon: { dmg: 11, interval: 0.55, mag: 22, reload: 2.2, feedsAny: true } },
  { id: 'furet_akimbo', name: 'Furet Akimbo', short: 'Akimbo', wclass: 'SMG', shape: ['XXX', 'XXX'], category: 'arme', family: 'rafale', tags: ['arme'], caliber: '9mm', minRarity: 0, price: 16, crafted: true,
    weapon: { dmg: 4.5, interval: 0.38, mag: 24, reload: 2.6, targets: 2 } },
  { id: 'aigle_longuevue', name: 'Aigle Longue-vue', short: 'Longue-vue', wclass: 'Fusil de précision', shape: ['XXXXX', '..X..'], category: 'arme', family: 'precision', tags: ['arme', 'arme_longue'], caliber: '7.62', minRarity: 0, price: 26, crafted: true,
    weapon: { dmg: 72, interval: 2.8, mag: 5, reload: 3.2, firstCrit: true, armorPierce: 0.5 } },
  { id: 'taureau_magnum', name: 'Taureau Magnum', short: 'Magnum', wclass: 'Pistolet', shape: ['XXX', 'X..'], category: 'arme', family: 'precision', tags: ['arme'], caliber: '.44', minRarity: 0, price: 16, crafted: true,
    weapon: { dmg: 26, interval: 1.3, mag: 6, reload: 2.2, selfFed: true, critStun: 0.8 } },
  { id: 'pompe_dragon', name: 'Pompe Dragon', short: 'Dragon', wclass: 'Fusil à pompe', shape: ['XXXX', 'X...'], category: 'arme', family: 'demolition', tags: ['arme'], caliber: '12G', minRarity: 0, price: 16, crafted: true,
    weapon: { dmg: 16, interval: 1.4, mag: 5, reload: 2.8, targets: 2, selfFed: true, trueDmg: 5 } },
  { id: 'thermite', name: 'Grenade thermite', short: 'Thermite', shape: ['X', 'X'], category: 'explosif', family: 'demolition', tags: ['explosif'], minRarity: 0, price: 12, crafted: true,
    active: { kind: 'frag', value: 30, cooldown: 7, charges: 2, pierce: true } },
  { id: 'armure_lourde', name: 'Armure lourde', short: 'Armure L.', shape: ['XX', 'XX', 'XX'], category: 'protection', family: 'rempart', tags: ['protection'], minRarity: 0, price: 20, crafted: true,
    armor: 75, flatReduce: 2 },
  { id: 'kit_trauma', name: 'Kit de trauma', short: 'Trauma', shape: ['XX', 'XX'], category: 'medical', family: 'rempart', tags: ['medical'], minRarity: 0, price: 14, crafted: true,
    active: { kind: 'heal', value: 35, cooldown: 4, charges: 2, threshold: 0.5 } },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(DEFS.map((d) => [d.id, d]));
export const ITEM_IDS: string[] = DEFS.map((d) => d.id);
/** Objets qu'on peut trouver dans le butin ou la boutique (hors objets assemblés). */
export const LOOT_IDS: string[] = DEFS.filter((d) => !d.crafted).map((d) => d.id);

export const FAMILY_INFO: Record<Family, { name: string; color: number; hex: string; tier2: string; tier4: string }> = {
  rafale: { name: 'Rafale', color: 0xe8a33d, hex: '#f0b252', tier2: '+15 % de cadence des armes Rafale', tier4: '1 balle sur 8 ricoche sur un 2e ennemi' },
  precision: { name: 'Précision', color: 0x4fc3f7, hex: '#6fd0fa', tier2: '+10 % de critique pour toutes les armes', tier4: 'Critiques ×2,5 au lieu de ×2' },
  demolition: { name: 'Démolition', color: 0xe5484d, hex: '#ff6b6b', tier2: '+1 charge pour chaque explosif', tier4: 'Explosions et pompe ignorent armure et Blindés' },
  rempart: { name: 'Rempart', color: 0x9fb3c0, hex: '#b4c6d2', tier2: "+20 % d'armure", tier4: "L'armure se régénère de 2 par seconde" },
  tactique: { name: 'Tactique', color: 0x9bbf3a, hex: '#b5d65a', tier2: 'Le fumigène dure 50 % plus longtemps', tier4: 'Prévu avec la radio et le drone' },
};

export const CATEGORY_COLORS: Record<Category, number> = {
  arme: 0x4b5338,
  munition: 0x5e4c36,
  accessoire: 0x3c4a52,
  protection: 0x4d565c,
  explosif: 0x5c3b36,
  medical: 0x3b5847,
};

export const CATEGORY_NAMES: Record<Category, string> = {
  arme: 'Arme',
  munition: 'Munition',
  accessoire: 'Accessoire',
  protection: 'Protection',
  explosif: 'Explosif',
  medical: 'Médical',
};
