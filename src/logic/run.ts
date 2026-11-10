import { Category, Family, ITEMS, ITEM_IDS } from '../data/items';
import { ItemInst, START_UNLOCKED, canPlace } from './grid';
import { MAX_RARITY, rollRarity } from './rarity';
import { Rng, rngFor } from './rng';
import { itemPrice } from './stats';
import { STAGES, TURNS, Zone, genZone } from './zone';
import { BIOME_IDS, BiomeId } from '../data/biomes';

export type NodeType = 'contrat' | 'elite' | 'marchand' | 'caisse' | 'planque' | 'boss';

export const NODE_INFO: Record<NodeType, { name: string; letter: string; desc: string }> = {
  contrat: { name: 'Contrat', letter: 'C', desc: 'Combat standard : chaque ennemi abattu lâche un objet' },
  elite: { name: 'Élite', letter: 'É', desc: 'Combat difficile : butin Rare ou mieux' },
  marchand: { name: 'Marchand', letter: '$', desc: 'Acheter, vendre, relancer la boutique' },
  caisse: { name: 'Caisse', letter: 'R', desc: 'Ravitaillement : 2 objets au hasard, sans combat' },
  planque: { name: 'Planque', letter: 'P', desc: 'Repos : récupère 1 sursis (ou 8 crédits si tu es au maximum)' },
  boss: { name: 'Boss', letter: 'B', desc: 'Cdt Kesh et son escorte. Victoire = extraction' },
};

/** Nombre de tours d'une zone (6 lieux + exfiltration). */
export const FLOORS = TURNS;
export const RESERVE_MAX = 6;
export const START_SURSIS = 3;
export const REROLL_COST = 2;
/** Une extension débloque ce nombre de cases du gilet. */
export const EXTENSION_CELLS = 3;
const SAVE_KEY = 'hotdrop.run.v5';

export interface ShopOffer {
  inst: ItemInst;
  price: number;
  sold: boolean;
}

export interface RunState {
  version: 5;
  seed: number;
  /** Les 3 biomes de la run, tirés au début. */
  biomes: BiomeId[];
  /** Biomes déjà terminés, dans l'ordre de visite. */
  done: BiomeId[];
  /** Position de la zone en cours dans la run (0, 1 ou 2). */
  stage: number;
  /** Tour en cours dans la zone (0 = largage). */
  floor: number;
  /** Zone en cours ; null = au briefing, avant de choisir la prochaine zone. */
  zone: Zone | null;
  /** Lieux visités sur toute la run. */
  placesTotal: number;
  credits: number;
  sursis: number;
  items: ItemInst[];
  /** Cases débloquées du gilet ("x,y"). */
  unlocked: string[];
  /** Cases à débloquer en attente (achetées ou gagnées). */
  extensions: number;
  /** Nombre d'extensions achetées (le prix augmente). */
  extBought: number;
  nextUid: number;
  attempts: number;
  shop?: { floor: number; rerolls: number; offers: ShopOffer[] };
  /** Dernier niveau (voir level) dont la récompense hors combat (caisse, planque) a été donnée. */
  claimedFloor?: number;
  speed: number;
  over?: 'win' | 'lose';
}

export function isCombat(n: NodeType): n is 'contrat' | 'elite' | 'boss' {
  return n === 'contrat' || n === 'elite' || n === 'boss';
}

/** Niveau de difficulté : tour dans la zone, décalé de 4 par zone terminée. */
export function level(run: RunState): number {
  return run.floor + 4 * run.stage;
}

export function drawBiomes(seed: number): BiomeId[] {
  const rng = rngFor(seed, 'biomes');
  const ids = [...BIOME_IDS];
  const out: BiomeId[] = [];
  while (out.length < STAGES) out.push(ids.splice(Math.floor(rng() * ids.length), 1)[0]);
  return out;
}

/** Biomes encore à jouer, dans l'ordre du tirage. */
export function remainingBiomes(run: RunState): BiomeId[] {
  return run.biomes.filter((b) => !run.done.includes(b));
}

/** Choix au briefing : génère la carte du biome pour la position actuelle. */
export function enterZone(run: RunState, biome: BiomeId): void {
  run.zone = genZone(run.seed, biome, run.stage);
  run.floor = 0;
  run.shop = undefined;
}

/** Exfiltration réussie : la zone est terminée. Renvoie vrai si c'était la dernière. */
export function completeZone(run: RunState): boolean {
  if (!run.zone) return false;
  run.done.push(run.zone.biome);
  if (run.done.length >= STAGES) return true;
  run.stage++;
  run.floor = 0;
  run.zone = null;
  run.shop = undefined;
  return false;
}

export function newRun(seed = Math.floor(Math.random() * 1e9)): RunState {
  const run: RunState = {
    version: 5,
    seed,
    biomes: drawBiomes(seed),
    done: [],
    stage: 0,
    floor: 0,
    zone: null,
    placesTotal: 0,
    credits: 10,
    sursis: START_SURSIS,
    items: [],
    unlocked: [...START_UNLOCKED],
    extensions: 0,
    extBought: 0,
    nextUid: 1,
    attempts: 0,
    speed: 1,
  };
  const start: [string, number, number][] = [['casque', 2, 1], ['pistolet', 2, 3], ['chg_9mm', 4, 3], ['poignee', 1, 3]];
  for (const [id, x, y] of start) {
    const it = makeItem(run, id, 0);
    Object.assign(it, { x, y, placed: true });
    run.items.push(it);
  }
  return run;
}

export function makeItem(run: RunState, defId: string, rarity: number): ItemInst {
  return { uid: run.nextUid++, defId, rarity, rot: 0, x: 0, y: 0, placed: false };
}

/** Part de chaque catégorie dans le butin et la boutique (%), quel que soit le nombre d'objets qu'elle contient. */
export const CATEGORY_WEIGHTS: Record<Category, number> = {
  arme: 20, munition: 25, accessoire: 22, protection: 12, explosif: 11, medical: 10,
};
const CATEGORY_SIZE = ITEM_IDS.reduce((m, id) => m.set(ITEMS[id].category, (m.get(ITEMS[id].category) ?? 0) + 1), new Map<Category, number>());
const itemWeight = (id: string) => CATEGORY_WEIGHTS[ITEMS[id].category] / (CATEGORY_SIZE.get(ITEMS[id].category) ?? 1);

/** Une victoire rapporte au moins ce nombre d'objets, même contre un seul ennemi. */
export const MIN_WIN_DROPS = 2;

/** Butin orienté : poids des objets d'une famille déjà posée dans le gilet. */
export const VEST_FAMILY_BOOST = 2;

function pickWeighted(rng: Rng, ids: string[], boost?: Set<Family>): string {
  const w = (id: string) => itemWeight(id) * (boost?.has(ITEMS[id].family) ? VEST_FAMILY_BOOST : 1);
  const total = ids.reduce((s, id) => s + w(id), 0);
  let r = rng() * total;
  for (const id of ids) {
    r -= w(id);
    if (r <= 0) return id;
  }
  return ids[ids.length - 1];
}

/** Familles des objets posés dans le gilet. */
export function vestFamilies(run: RunState): Set<Family> {
  return new Set(run.items.filter((i) => i.placed).map((i) => ITEMS[i.defId].family));
}

/** Chance qu'un objet tombé dans un lieu spécialisé soit de la famille annoncée. */
export const FAMILY_DROP_CHANCE = 0.6;

function randomItems(run: RunState, rng: Rng, count: number, guarantee: number, family?: Family, boost?: Set<Family>): ItemInst[] {
  const zoneOdds = run.stage;
  const ids = [...ITEM_IDS];
  const out: ItemInst[] = [];
  for (let i = 0; i < count && ids.length; i++) {
    const fam = family && rng() < FAMILY_DROP_CHANCE ? ids.filter((x) => ITEMS[x].family === family) : [];
    const pool = fam.length ? fam : ids;
    const id = pickWeighted(rng, pool, boost);
    ids.splice(ids.indexOf(id), 1);
    out.push({ uid: -1, defId: id, rarity: rollRarity(rng, zoneOdds, ITEMS[id].minRarity, guarantee), rot: 0, x: 0, y: 0, placed: false });
  }
  return out;
}

/** Butin tiré au hasard (ennemis abattus, caisse). Déterministe pour une graine et un usage donnés. */
export function rollDrops(run: RunState, count: number, guarantee: number, salt: string | number, family?: Family): ItemInst[] {
  // Le butin penche vers les familles du gilet ; la boutique, elle, reste neutre.
  return randomItems(run, rngFor(run.seed, run.stage, run.floor, 'drops', salt), count, guarantee, family, vestFamilies(run));
}

/** Ajoute le butin à la réserve ; ce qui ne rentre pas est revendu automatiquement. */
export function addDrops(run: RunState, drops: ItemInst[]): { taken: ItemInst[]; credits: number } {
  const taken: ItemInst[] = [];
  let credits = 0;
  for (const d of drops) {
    if (reserve(run).length < RESERVE_MAX) taken.push(takeItem(run, d));
    else credits += Math.max(1, Math.floor(itemPrice(d.defId, d.rarity) * 0.5));
  }
  run.credits += credits;
  return { taken, credits };
}

export function shopOffers(run: RunState): ShopOffer[] {
  if (run.shop && run.shop.floor === level(run)) return run.shop.offers;
  run.shop = { floor: level(run), rerolls: 0, offers: [] };
  rollShop(run);
  return run.shop.offers;
}

export function rollShop(run: RunState): void {
  if (!run.shop) return;
  const rng = rngFor(run.seed, run.stage, run.floor, 'shop', run.shop.rerolls);
  run.shop.offers = randomItems(run, rng, 4, 0).map((inst) => ({ inst, price: itemPrice(inst.defId, inst.rarity), sold: false }));
}

/** Ajoute un objet proposé (loot ou boutique) à la réserve. */
export function takeItem(run: RunState, offer: ItemInst): ItemInst {
  const it = makeItem(run, offer.defId, offer.rarity);
  run.items.push(it);
  return it;
}

export function reserve(run: RunState): ItemInst[] {
  return run.items.filter((i) => !i.placed);
}

export function canFuse(a: ItemInst, b: ItemInst): boolean {
  return a.uid !== b.uid && a.defId === b.defId && a.rarity === b.rarity && a.rarity < MAX_RARITY;
}

/** Fusionne `consumed` dans `keep` : `keep` monte d'une rareté, `consumed` disparaît. */
export function fuse(run: RunState, keep: ItemInst, consumed: ItemInst): void {
  if (!canFuse(keep, consumed)) return;
  keep.rarity++;
  run.items = run.items.filter((i) => i.uid !== consumed.uid);
}

export function extensionPrice(run: RunState): number {
  return 6 + 4 * run.extBought;
}

export function rewardCredits(node: NodeType, floor: number): number {
  if (node === 'elite') return 10 + 2 * floor;
  if (node === 'boss') return 0;
  return 6 + floor;
}

export function saveRun(run: RunState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(run));
  } catch {
    /* stockage indisponible : on continue sans sauvegarde */
  }
}

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as RunState;
    if (run.version !== 5 || run.over) return null;
    sanitizeLayout(run);
    return run;
  } catch {
    return null;
  }
}

/** Remet en réserve les objets qui ne tiennent plus (ex. : sauvegarde d'une version aux formes différentes). */
export function sanitizeLayout(run: RunState): void {
  const kept: ItemInst[] = [];
  const unlocked = new Set(run.unlocked);
  for (const it of run.items) {
    if (!it.placed) continue;
    if (canPlace(kept, it, it.x, it.y, it.rot, unlocked)) kept.push(it);
    else it.placed = false;
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* rien */
  }
}
