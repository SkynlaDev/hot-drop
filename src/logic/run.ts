// État d'une run et ses règles : carte battle royale, cartes jouées dans les zones, duels, Goulag, butin, boutique.
// Tout est pur et déterministe pour une graine donnée ; les scènes appellent ces fonctions.
// Ce module ne dépend ni des bots ni du combat : il renvoie les paramètres des duels, l'UI les simule.
import { Category, ITEMS } from '../data/items';
import { BAGS, BAG_IDS, BagId } from '../data/bags';
import { OPERATORS, OperatorId, lootPool } from '../data/operators';
import { BagInst, ItemInst, canPlace, canPlaceBag, canRemoveBag, usableCells, bagCells, cellKey, connectedBags, BASE_CELLS, COLS, ROWS } from './grid';
import { MAX_RARITY, rollRarity } from './rarity';
import { Rng, hashParts, rngFor } from './rng';
import { itemPrice } from './stats';
import { ACTIONS_PER_ZONE, Card, DANGER_BY_SIZE, GameMap, MapZone, ROUNDS, drawCards, genMap, isGassed, zonesInCircle } from './zone';

export const RESERVE_MAX = 6;
/** Sacoches en réserve (non posées), comptées à part des objets. */
export const BAG_RESERVE_MAX = 3;
export const START_CREDITS = 10;
export const REROLL_COST = 2;
export const SHOP_OFFERS = 5;
/** Chance qu'une des offres de la boutique soit une sacoche. */
export const SHOP_BAG_CHANCE = 0.4;
/** Chance qu'une caisse donne aussi une sacoche, en plus de l'objet. */
export const CRATE_BAG_CHANCE = 0.3;
/** Caisse épique (grandes zones) : 1 objet Épique garanti, Légendaire avec cette chance… */
export const EPIC_LEGENDARY_CHANCE = 0.15;
/** … plus ce nombre d'objets ordinaires de la manche. */
export const EPIC_EXTRA_ITEMS = 1;
/** Objets à choisir dans le sac de chaque bot vaincu (squad ou solo : un par duel gagné). */
export const LOOT_PICKS = 1;
/** Chance qu'une squad terminée donne aussi une sacoche. */
export const SQUAD_BAG_CHANCE = 0.5;
/** Manche du duel final « Top 1 ». */
export const FINAL_ROUND = ROUNDS;
/** Bonus de difficulté du duel final, et du Goulag (duel équitable). */
export const FINAL_DANGER = 2;
export const GOULAG_DANGER = 0;
/** Revente : moitié du prix. */
export const SELL_RATIO = 0.5;
const SAVE_KEY = 'hotdrop.run.v6';

/** PV max de tout le monde (joueur et bots) à une manche donnée. */
export function roundMaxHp(round: number): number {
  return 100 + 20 * round;
}

export interface ShopOffer {
  /** Objet proposé (uid -1 tant qu'il n'est pas acheté), ou… */
  item?: ItemInst;
  /** … id de sacoche proposée (data/bags.ts). */
  bag?: BagId;
  price: number;
  sold: boolean;
}

export type FightKind = 'solo' | 'squad' | 'final';

/** Combat en cours (solo, squad ou final). Les PV sont reportés entre les duels d'une squad. */
export interface Fight {
  kind: FightKind;
  /** Index de la carte jouée (-1 pour le final). */
  cardIndex: number;
  /** Duel en cours (index 0). */
  duel: number;
  total: number;
  /** PV au début du duel en cours. */
  hp: number;
}

/**
 * Butin à choisir après un duel gagné : le sac du bot vaincu tel qu'il était rangé.
 * Tant qu'il est là, ni carte, ni fin d'action, ni duel suivant de la squad.
 */
export interface PendingLoot {
  /** Objets du sac du bot (uid du bot, positions d'origine). */
  items: ItemInst[];
  /** Cases utilisables du sac du bot, pour l'afficher en entier. */
  usable: string[];
  /** Nombre d'objets à prendre (LOOT_PICKS, jamais plus que le sac n'en contient). */
  picks: number;
}

export interface RunState {
  version: 6;
  seed: number;
  operator: OperatorId;
  /** Manche 0 à ROUNDS - 1 ; ROUNDS = duel final. */
  round: number;
  map: GameMap;
  /** Zone où le joueur est largué ; null = sur la carte, à choisir. */
  zoneId: number | null;
  cards: Card[];
  /** Index des cartes déjà jouées dans la zone. */
  played: number[];
  actionsLeft: number;
  fight?: Fight;
  goulagUsed: boolean;
  /** Un duel vient d'être perdu : le Goulag attend d'être joué. */
  pendingLoot?: PendingLoot;
  pendingGoulag?: boolean;
  credits: number;
  items: ItemInst[];
  bags: BagInst[];
  nextUid: number;
  shop?: { key: string; rerolls: number; offers: ShopOffer[] };
  speed: number;
  over?: 'win' | 'lose';
}

/** Paramètres d'un duel : l'UI génère le bot avec generateBot(seed, round, { danger }) et simule. */
export interface DuelParams {
  /** Nature du duel (le champ `kind` est réservé au résultat de playCard). */
  type: FightKind | 'goulag';
  seed: number;
  round: number;
  danger: number;
  /** Duel en cours / nombre de duels (squad), 0/1 sinon. */
  squad: { duel: number; total: number };
  /** PV du joueur au début du duel, et PV max de la manche. */
  hp: number;
  maxHp: number;
}

export interface Loot {
  items: ItemInst[];
  bags: BagInst[];
  /** Crédits gagnés (récompense + revente automatique de ce qui ne rentre pas). */
  credits: number;
}

/** `epic` : caisse épique (au moins un objet Épique ou Légendaire). */
export type PlayResult = { kind: 'shop' } | { kind: 'caisse'; loot: Loot; epic?: boolean } | ({ kind: 'duel' } & DuelParams);

// ---------- Création ----------

export function newRun(operator: OperatorId, seed = Math.floor(Math.random() * 1e9)): RunState {
  const run: RunState = {
    version: 6,
    seed,
    operator,
    round: 0,
    map: genMap(seed),
    zoneId: null,
    cards: [],
    played: [],
    actionsLeft: 0,
    goulagUsed: false,
    credits: START_CREDITS,
    items: [],
    bags: [],
    nextUid: 1,
    speed: 1,
  };
  for (const [id, x, y] of OPERATORS[operator].start) {
    const it = makeItem(run, id, 0);
    Object.assign(it, { x, y, placed: true });
    run.items.push(it);
  }
  // Une pochette en réserve pour découvrir les sacoches dès le début.
  run.bags.push(makeBag(run, 'pochette'));
  return run;
}

export function makeItem(run: RunState, defId: string, rarity: number): ItemInst {
  return { uid: run.nextUid++, defId, rarity, rot: 0, x: 0, y: 0, placed: false };
}

export function makeBag(run: RunState, defId: BagId): BagInst {
  return { uid: run.nextUid++, defId, rot: 0, x: 0, y: 0, placed: false };
}

// ---------- Carte et zones ----------

export function currentZone(run: RunState): MapZone | null {
  return run.zoneId === null ? null : run.map.zones[run.zoneId];
}

/** Zones où l'on peut se larguer (aucune pendant une zone ou au duel final). */
export function selectableZones(run: RunState): MapZone[] {
  if (run.over || run.zoneId !== null || run.round >= ROUNDS) return [];
  return zonesInCircle(run.map, run.round);
}

/** Largage dans une zone : tire ses cartes. Renvoie faux si la zone n'est pas jouable. */
export function dropInZone(run: RunState, zoneId: number): boolean {
  const zone = run.map.zones[zoneId];
  if (!zone || !selectableZones(run).includes(zone)) return false;
  run.zoneId = zoneId;
  run.cards = drawCards(run.seed, run.round, zone);
  run.played = [];
  run.actionsLeft = ACTIONS_PER_ZONE;
  run.shop = undefined;
  return true;
}

/** Vrai si le joueur peut jouer une carte maintenant (largué, pas de combat ni de Goulag en cours). */
export function canPlayCard(run: RunState, index: number): boolean {
  return !run.over && run.zoneId !== null && run.actionsLeft > 0 && !run.fight && !run.pendingGoulag && !run.pendingLoot &&
    index >= 0 && index < run.cards.length && !run.played.includes(index);
}

function zoneDanger(run: RunState): number {
  const z = currentZone(run);
  return z ? DANGER_BY_SIZE[z.size] : 0;
}

export function duelSeed(run: RunState, cardIndex: number, duel: number): number {
  return hashParts(run.seed, 'duel', run.round, run.zoneId ?? -1, cardIndex, duel);
}

/**
 * Joue une carte. La carte est marquée jouée tout de suite.
 * - boutique : l'UI ouvre la boutique (shopOffers), puis appelle endAction à la fermeture ;
 * - caisse : le butin est déjà ajouté (réserve), l'UI l'affiche puis appelle endAction ;
 * - duel : l'UI génère le bot, simule, puis appelle resolveDuel.
 * Renvoie null si la carte ne peut pas être jouée.
 */
export function playCard(run: RunState, index: number): PlayResult | null {
  if (!canPlayCard(run, index)) return null;
  const card = run.cards[index];
  run.played.push(index);
  if (card.type === 'shop') {
    shopOffers(run);
    return { kind: 'shop' };
  }
  if (card.type === 'caisse') {
    const rng = rngFor(run.seed, 'caisse', run.round, run.zoneId!, index);
    const items = addDrops(run, randomItems(run, rng, 1));
    const bags = rng() < CRATE_BAG_CHANCE ? addBags(run, [rollBag(rng, run.round)]) : { taken: [], credits: 0 };
    return { kind: 'caisse', loot: { items: items.taken, bags: bags.taken, credits: items.credits + bags.credits } };
  }
  if (card.type === 'caisse_epique') {
    const rng = rngFor(run.seed, 'caisse_epique', run.round, run.zoneId!, index);
    const best = randomItems(run, rng, 1, rng() < EPIC_LEGENDARY_CHANCE ? MAX_RARITY : 3);
    const extra = randomItems(run, rng, EPIC_EXTRA_ITEMS).filter((it) => !best.some((b) => b.defId === it.defId));
    const items = addDrops(run, [...best, ...extra]);
    return { kind: 'caisse', epic: true, loot: { items: items.taken, bags: [], credits: items.credits } };
  }
  run.fight = { kind: card.type, cardIndex: index, duel: 0, total: card.duels, hp: roundMaxHp(run.round) };
  return { kind: 'duel', ...currentDuel(run)! };
}

/** Paramètres du duel en cours (combat de carte ou final), pour lancer ou relancer après un rechargement. */
export function currentDuel(run: RunState): DuelParams | null {
  const f = run.fight;
  if (!f) return null;
  if (f.kind === 'final') {
    return { type: 'final', seed: hashParts(run.seed, 'final'), round: FINAL_ROUND, danger: FINAL_DANGER, squad: { duel: 0, total: 1 }, hp: f.hp, maxHp: roundMaxHp(FINAL_ROUND) };
  }
  return {
    type: f.kind, seed: duelSeed(run, f.cardIndex, f.duel), round: run.round, danger: zoneDanger(run),
    squad: { duel: f.duel, total: f.total }, hp: f.hp, maxHp: roundMaxHp(run.round),
  };
}

export interface DuelOutcome {
  win: boolean;
  /** PV du joueur à la fin du duel. */
  hpEnd: number;
  /** Objets du sac du bot (le joueur choisit son butin dedans). */
  botItems: ItemInst[];
  /** Cases utilisables du sac du bot (affichage du choix). */
  botUsable?: string[];
}

export interface DuelResolution {
  /** Gagné tout de suite : crédits et sacoche éventuelle. Les objets se choisissent avec takeLoot. */
  loot: Loot;
  /** Victoire : objets du sac du bot parmi lesquels choisir (aussi dans run.pendingLoot). */
  lootChoices?: ItemInst[];
  /** Nombre d'objets à choisir. */
  picks?: number;
  /** Duel suivant de la squad (PV reportés), si elle continue : à lancer après takeLoot. */
  next?: DuelParams;
  /** L'action est terminée : l'UI appelle endAction (après takeLoot). */
  actionDone: boolean;
  /** Défaite avec le Goulag disponible : l'UI lance goulagParams puis resolveGoulag. */
  goulag: boolean;
  over?: 'win' | 'lose';
}

/** Crédits d'un duel gagné. */
export function duelCredits(kind: FightKind, round: number, last: boolean): number {
  if (kind === 'final') return 0;
  if (kind === 'solo') return 6 + 2 * round;
  return 5 + 2 * round + (last ? 8 + 2 * round : 0);
}

/**
 * Résout le duel en cours. Victoire : crédits (et sacoche de fin de squad) tout de suite ; les objets du bot
 * attendent le choix du joueur (run.pendingLoot, puis takeLoot).
 */
export function resolveDuel(run: RunState, out: DuelOutcome): DuelResolution {
  const empty: Loot = { items: [], bags: [], credits: 0 };
  const f = run.fight;
  if (!f || run.over || run.pendingLoot) return { loot: empty, actionDone: false, goulag: false, over: run.over };
  if (f.kind === 'final') {
    run.fight = undefined;
    run.over = out.win ? 'win' : 'lose';
    return { loot: empty, actionDone: true, goulag: false, over: run.over };
  }
  if (!out.win) {
    run.fight = undefined; // le reste de la squad est annulé
    if (!run.goulagUsed) {
      run.goulagUsed = true;
      run.pendingGoulag = true;
      return { loot: empty, actionDone: false, goulag: true };
    }
    run.over = 'lose';
    return { loot: empty, actionDone: true, goulag: false, over: 'lose' };
  }
  const last = f.duel + 1 >= f.total;
  const squadEnd = f.kind === 'squad' && last;
  const rng = rngFor(run.seed, 'loot', run.round, run.zoneId ?? -1, f.cardIndex, f.duel);
  const bags = squadEnd && rng() < SQUAD_BAG_CHANCE ? addBags(run, [rollBag(rng, run.round)]) : { taken: [], credits: 0 };
  const reward = duelCredits(f.kind, run.round, last);
  run.credits += reward;
  const loot: Loot = { items: [], bags: bags.taken, credits: reward + bags.credits };
  // Le sac du bot, tel quel : le joueur y choisit son butin.
  const choices = out.botItems.map((it) => ({ ...it, placed: true }));
  const picks = Math.min(LOOT_PICKS, choices.length);
  if (picks > 0) run.pendingLoot = { items: choices, usable: out.botUsable ?? [], picks };
  const res: DuelResolution = { loot, lootChoices: choices, picks, actionDone: last, goulag: false };
  if (!last) {
    f.duel++;
    f.hp = Math.max(1, Math.round(out.hpEnd));
    res.next = currentDuel(run)!;
    return res;
  }
  run.fight = undefined;
  return res;
}

/**
 * Prend le butin choisi dans le sac du bot vaincu : exactement `picks` objets différents de ce sac (uids du bot).
 * Ils vont en réserve ; ce qui n'y tient pas est revendu (comme addDrops). Renvoie null si le choix est invalide.
 */
export function takeLoot(run: RunState, uids: number[]): { taken: ItemInst[]; credits: number } | null {
  const p = run.pendingLoot;
  if (!p || uids.length !== p.picks || new Set(uids).size !== uids.length) return null;
  const chosen = uids.map((u) => p.items.find((it) => it.uid === u));
  if (chosen.some((c) => !c)) return null;
  run.pendingLoot = undefined;
  return addDrops(run, chosen.map((c) => ({ uid: -1, defId: c!.defId, rarity: c!.rarity, rot: 0, x: 0, y: 0, placed: false })));
}

/** Paramètres du Goulag : un duel équitable au niveau de la manche, PV pleins. */
export function goulagParams(run: RunState): DuelParams | null {
  if (!run.pendingGoulag) return null;
  const round = Math.min(run.round, FINAL_ROUND);
  return { type: 'goulag', seed: hashParts(run.seed, 'goulag'), round, danger: GOULAG_DANGER, squad: { duel: 0, total: 1 }, hp: roundMaxHp(round), maxHp: roundMaxHp(round) };
}

/** Résultat du Goulag. Victoire : retour en jeu, l'action est consommée (l'UI appelle endAction). Défaite : fin de run. */
export function resolveGoulag(run: RunState, win: boolean): void {
  if (!run.pendingGoulag) return;
  run.pendingGoulag = false;
  if (!win) run.over = 'lose';
}

/**
 * Fin d'une action (boutique fermée, caisse ouverte, combat terminé, Goulag gagné).
 * Après la 3e action, le cercle se resserre : manche suivante, retour sur la carte.
 * Sans effet (renvoie null) si un combat, un butin à choisir ou le Goulag est en cours, ou hors zone.
 */
export function endAction(run: RunState): { nextRound: boolean; final: boolean } | null {
  if (run.over || run.fight || run.pendingGoulag || run.pendingLoot || run.zoneId === null || run.actionsLeft <= 0) return null;
  run.actionsLeft--;
  run.shop = undefined;
  if (run.actionsLeft > 0) return { nextRound: false, final: false };
  run.round++;
  run.zoneId = null;
  run.cards = [];
  run.played = [];
  return { nextRound: true, final: run.round >= FINAL_ROUND };
}

/** Lance le duel final « Top 1 » (après la 5e manche). */
export function finalDuelParams(run: RunState): DuelParams | null {
  if (run.over || run.round < FINAL_ROUND || run.pendingGoulag) return null;
  if (!run.fight) run.fight = { kind: 'final', cardIndex: -1, duel: 0, total: 1, hp: roundMaxHp(FINAL_ROUND) };
  return currentDuel(run);
}

/** Zone gazée ? (raccourci pour l'UI) */
export function zoneGassed(run: RunState, zone: MapZone, round = run.round): boolean {
  return isGassed(run.map, zone, round);
}

// ---------- Butin ----------

/** Part de chaque catégorie dans le butin et la boutique (%), quel que soit le nombre d'objets qu'elle contient. */
export const CATEGORY_WEIGHTS: Record<Category, number> = {
  arme: 20, munition: 25, accessoire: 22, protection: 12, explosif: 11, medical: 10,
};

function pickWeighted(rng: Rng, ids: string[]): string {
  const size = new Map<Category, number>();
  for (const id of ids) size.set(ITEMS[id].category, (size.get(ITEMS[id].category) ?? 0) + 1);
  const w = (id: string) => CATEGORY_WEIGHTS[ITEMS[id].category] / (size.get(ITEMS[id].category) ?? 1);
  const total = ids.reduce((s, id) => s + w(id), 0);
  let r = rng() * total;
  for (const id of ids) {
    r -= w(id);
    if (r <= 0) return id;
  }
  return ids[ids.length - 1];
}

/** Objets tirés dans le pool de l'opérateur, tous différents, rareté selon la manche (au moins `guarantee`). */
function randomItems(run: RunState, rng: Rng, count: number, guarantee = 0): ItemInst[] {
  const ids = lootPool(run.operator);
  const out: ItemInst[] = [];
  for (let i = 0; i < count && ids.length; i++) {
    const id = pickWeighted(rng, ids);
    ids.splice(ids.indexOf(id), 1);
    out.push({ uid: -1, defId: id, rarity: rollRarity(rng, run.round, ITEMS[id].minRarity, guarantee), rot: 0, x: 0, y: 0, placed: false });
  }
  return out;
}

export function rollBag(rng: Rng, round: number): BagId {
  const total = BAG_IDS.reduce((s, id) => s + BAGS[id].weight + BAGS[id].weightPerRound * round, 0);
  let r = rng() * total;
  for (const id of BAG_IDS) {
    r -= BAGS[id].weight + BAGS[id].weightPerRound * round;
    if (r < 0) return id;
  }
  return BAG_IDS[BAG_IDS.length - 1];
}

export function itemSellValue(defId: string, rarity: number): number {
  return Math.max(1, Math.floor(itemPrice(defId, rarity) * SELL_RATIO));
}

export function bagSellValue(defId: string): number {
  return Math.max(1, Math.floor(BAGS[defId as BagId].price * SELL_RATIO));
}

/** Ajoute le butin à la réserve ; ce qui ne rentre pas est revendu automatiquement. */
export function addDrops(run: RunState, drops: ItemInst[]): { taken: ItemInst[]; credits: number } {
  const taken: ItemInst[] = [];
  let credits = 0;
  for (const d of drops) {
    if (reserve(run).length < RESERVE_MAX) taken.push(takeItem(run, d));
    else credits += itemSellValue(d.defId, d.rarity);
  }
  run.credits += credits;
  return { taken, credits };
}

/** Ajoute des sacoches à la réserve (max BAG_RESERVE_MAX) ; le surplus est revendu. */
export function addBags(run: RunState, ids: BagId[]): { taken: BagInst[]; credits: number } {
  const taken: BagInst[] = [];
  let credits = 0;
  for (const id of ids) {
    if (reserveBags(run).length < BAG_RESERVE_MAX) {
      const b = makeBag(run, id);
      run.bags.push(b);
      taken.push(b);
    } else credits += bagSellValue(id);
  }
  run.credits += credits;
  return { taken, credits };
}

/** Ajoute un objet proposé (butin ou boutique) à la réserve. */
export function takeItem(run: RunState, offer: ItemInst): ItemInst {
  const it = makeItem(run, offer.defId, offer.rarity);
  run.items.push(it);
  return it;
}

export function reserve(run: RunState): ItemInst[] {
  return run.items.filter((i) => !i.placed);
}

export function reserveBags(run: RunState): BagInst[] {
  return run.bags.filter((b) => !b.placed);
}

export function sellItem(run: RunState, uid: number): number {
  const it = run.items.find((i) => i.uid === uid);
  if (!it) return 0;
  const v = itemSellValue(it.defId, it.rarity);
  run.items = run.items.filter((i) => i.uid !== uid);
  run.credits += v;
  return v;
}

/** Revend une sacoche (en réserve, ou posée si elle peut être retirée). */
export function sellBag(run: RunState, uid: number): number {
  const b = run.bags.find((x) => x.uid === uid);
  if (!b || (b.placed && !canRemoveBag(run.bags, run.items, b))) return 0;
  const v = bagSellValue(b.defId);
  run.bags = run.bags.filter((x) => x.uid !== uid);
  run.credits += v;
  return v;
}

// ---------- Sacoches sur la grille ----------

export function usable(run: RunState): Set<string> {
  return usableCells(run.bags);
}

export function placeBag(run: RunState, uid: number, x: number, y: number, rot: BagInst['rot']): boolean {
  const b = run.bags.find((v) => v.uid === uid);
  if (!b || !canPlaceBag(run.bags, run.items, b, x, y, rot)) return false;
  Object.assign(b, { x, y, rot, placed: true });
  return true;
}

/** Retire une sacoche vide de la grille vers la réserve. */
export function unplaceBag(run: RunState, uid: number): boolean {
  const b = run.bags.find((v) => v.uid === uid);
  if (!b || !canRemoveBag(run.bags, run.items, b) || reserveBags(run).length >= BAG_RESERVE_MAX) return false;
  b.placed = false;
  return true;
}

// ---------- Boutique ----------

function shopKey(run: RunState): string {
  return `${run.round}:${run.zoneId}:${run.played[run.played.length - 1] ?? -1}`;
}

/** Offres de la boutique ouverte (tirées à la première ouverture pour cette carte). */
export function shopOffers(run: RunState): ShopOffer[] {
  const key = shopKey(run);
  if (run.shop && run.shop.key === key) return run.shop.offers;
  run.shop = { key, rerolls: 0, offers: [] };
  rollShop(run);
  return run.shop.offers;
}

export function rollShop(run: RunState): void {
  if (!run.shop) return;
  const rng = rngFor(run.seed, 'shop', run.shop.key, run.shop.rerolls);
  const hasBag = rng() < SHOP_BAG_CHANCE;
  const items = randomItems(run, rng, hasBag ? SHOP_OFFERS - 1 : SHOP_OFFERS);
  const offers: ShopOffer[] = items.map((item) => ({ item, price: itemPrice(item.defId, item.rarity), sold: false }));
  if (hasBag) {
    const bag = rollBag(rng, run.round);
    offers.push({ bag, price: BAGS[bag].price, sold: false });
  }
  run.shop.offers = offers;
}

/** Relance la boutique (REROLL_COST crédits). */
export function rerollShop(run: RunState): boolean {
  if (!run.shop || run.credits < REROLL_COST) return false;
  run.credits -= REROLL_COST;
  run.shop.rerolls++;
  rollShop(run);
  return true;
}

/** Achète une offre : va en réserve. Échoue sans crédits ou réserve pleine. */
export function buyOffer(run: RunState, index: number): ItemInst | BagInst | null {
  const o = run.shop?.offers[index];
  if (!o || o.sold || run.credits < o.price) return null;
  if (o.item) {
    if (reserve(run).length >= RESERVE_MAX) return null;
    run.credits -= o.price;
    o.sold = true;
    return takeItem(run, o.item);
  }
  if (o.bag) {
    if (reserveBags(run).length >= BAG_RESERVE_MAX) return null;
    run.credits -= o.price;
    o.sold = true;
    const b = makeBag(run, o.bag);
    run.bags.push(b);
    return b;
  }
  return null;
}

// ---------- Fusion ----------

export function canFuse(a: ItemInst, b: ItemInst): boolean {
  return a.uid !== b.uid && a.defId === b.defId && a.rarity === b.rarity && a.rarity < MAX_RARITY;
}

/** Fusionne `consumed` dans `keep` : `keep` monte d'une rareté, `consumed` disparaît. */
export function fuse(run: RunState, keep: ItemInst, consumed: ItemInst): void {
  if (!canFuse(keep, consumed)) return;
  keep.rarity++;
  run.items = run.items.filter((i) => i.uid !== consumed.uid);
}

// ---------- Sauvegarde ----------

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
    if (run.version !== 6 || run.over) return null;
    sanitizeLayout(run);
    return run;
  } catch {
    return null;
  }
}

/**
 * Remet en réserve ce qui ne tient plus : sacoches hors grille, sur le sac de base, qui se chevauchent
 * ou détachées du bloc, puis objets hors des cases utilisables.
 */
export function sanitizeLayout(run: RunState): void {
  const base = new Set(BASE_CELLS);
  const taken = new Set<string>();
  for (const b of run.bags) {
    if (!b.placed) continue;
    const cells = bagCells(b).map(([x, y]) => ({ x, y, k: cellKey(x, y) }));
    const ok = cells.every((c) => c.x >= 0 && c.y >= 0 && c.x < COLS && c.y < ROWS && !base.has(c.k) && !taken.has(c.k));
    if (ok) cells.forEach((c) => taken.add(c.k));
    else b.placed = false;
  }
  // Détache les sacoches qui ne sont plus reliées au sac de base.
  const linked = connectedBags(run.bags);
  for (const b of run.bags) if (b.placed && !linked.has(b.uid)) b.placed = false;
  const cells = usableCells(run.bags);
  const kept: ItemInst[] = [];
  for (const it of run.items) {
    if (!it.placed) continue;
    if (canPlace(kept, it, it.x, it.y, it.rot, cells)) kept.push(it);
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
