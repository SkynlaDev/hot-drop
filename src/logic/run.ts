// État d'une run et ses règles : carte battle royale, cartes jouées dans les zones, duels, Goulag, butin, boutique.
// Tout est pur et déterministe pour une graine donnée ; les scènes appellent ces fonctions.
// Ce module ne dépend ni des bots ni du combat : il renvoie les paramètres des duels, l'UI les simule.
import { Category, ITEMS, LEGENDARY_IDS } from '../data/items';
import { BAGS, BAG_IDS, BagId } from '../data/bags';
import { OPERATORS, OperatorId, canUse, lootPool } from '../data/operators';
import { RECIPES } from '../data/recipes';
import { BagInst, ItemInst, canPlace, dims, findSpot, sharedEdge, canPlaceBag, canRemoveBag, usableCells, bagCells, cellKey, connectedBags, BASE_CELLS, COLS, ROWS } from './grid';
import { Rng, hashParts, pick, rngFor } from './rng';
import { itemPrice, maxHpFor } from './stats';
import { noteItems } from './profile';
import { ACTIONS_PER_ZONE, Card, DANGER_BY_SIZE, GameMap, MapZone, ROUNDS, THEME_BIAS, ZoneTheme, drawCards, genMap, isGassed, themeFits, zonesInCircle } from './zone';

export const RESERVE_MAX = 12;
/** Sacoches en réserve (non posées), comptées à part des objets. */
export const BAG_RESERVE_MAX = 3;
export const START_CREDITS = 10;
export const REROLL_COST = 2;
export const SHOP_OFFERS = 5;
/** Chance qu'une des offres de la boutique soit une sacoche. */
export const SHOP_BAG_CHANCE = 0.4;
/** Les trois caisses. */
export type CrateKind = 'caisse' | 'caisse_renforcee' | 'caisse_epique' | 'largage';
/**
 * Caisses : `offers` objets proposés dont on prend au plus `picks` ; toujours une arme parmi eux.
 * Renforcée : en plus, un ingrédient qui complète une recette commencée dans le sac. Épique : un objet assemblé.
 * Crédits ramassés (`cash` selon la manche) et chance de sacoche.
 */
export const CRATES: Record<CrateKind, { offers: number; picks: number; cash: (round: number) => number; bag: number }> = {
  caisse: { offers: 3, picks: 1, cash: (r) => 3 + r, bag: 0.3 },
  caisse_renforcee: { offers: 4, picks: 2, cash: (r) => 6 + 2 * r, bag: 0.6 },
  caisse_epique: { offers: 5, picks: 2, cash: (r) => 10 + 3 * r, bag: 0.5 },
  // Début de partie : 3 armes de départ de classes différentes, on en garde 1 (son chargeur est fourni).
  largage: { offers: 3, picks: 1, cash: () => 0, bag: 0 },
};
/** Prix maximal d'une arme proposée au largage. */
export const LANDING_PRICE_CAP = 8;
/** Chance qu'une Élite vaincue donne aussi une sacoche. */
export const ELITE_BAG_CHANCE = 0.4;
/** Objets qu'on emporte du sac du vaincu : 1 après un duel, 2 après une Élite. */
export const DUEL_PICKS = 1;
export const ELITE_PICKS = 2;
/** Manche du duel final « Top 1 ». */
export const FINAL_ROUND = ROUNDS;
/** Bonus de difficulté du duel final, et du Goulag (duel équitable). */
export const FINAL_DANGER = 2;
export const GOULAG_DANGER = 0;
/** Revente : moitié du prix. */
export const SELL_RATIO = 0.5;
const SAVE_KEY = 'hotdrop.run.v8';

/** PV max de tout le monde (joueur et bots) à une manche donnée : la même formule que les bots (maxHpFor). */
export function roundMaxHp(round: number): number {
  return maxHpFor(round);
}

export interface ShopOffer {
  /** Objet proposé (uid -1 tant qu'il n'est pas acheté), ou… */
  item?: ItemInst;
  /** … id de sacoche proposée (data/bags.ts). */
  bag?: BagId;
  price: number;
  sold: boolean;
  /** Verrouillée : survit aux relances et passe à la boutique suivante (une seule à la fois). */
  locked?: boolean;
}

export type FightKind = 'solo' | 'elite' | 'final';

/** Combat en cours (duel, Élite ou final) : toujours un seul duel. */
export interface Fight {
  kind: FightKind;
  /** Index de la carte jouée (-1 pour le final). */
  cardIndex: number;
  /** PV au début du duel. */
  hp: number;
}

/**
 * Fouille après un duel gagné : le sac du bot vaincu tel qu'il était rangé. On y prend tout ce qu'on veut
 * (lootItem / swapLoot), seule la place fait le tri, puis on termine (finishLoot).
 * Tant qu'elle est en cours, ni carte, ni fin d'action, ni duel suivant de la squad.
 */
export interface PendingLoot {
  /** Objets encore dans le sac du bot (uid du bot, positions d'origine), ou encore proposés par la caisse. */
  items: ItemInst[];
  /** Cases utilisables du sac du bot, pour l'afficher en entier (vide pour une caisse). */
  usable: string[];
  /** Caisse : son type ; absent pour le sac d'un bot. */
  crate?: CrateKind;
  /** Nombre maximal d'objets à prendre (caisses) ; absent = autant qu'on veut (sac d'un bot). */
  maxPicks?: number;
  /** Objets déjà pris. */
  picked: number;
}

/** Où est allé un objet pris dans le sac du vaincu ; `plein` = ni réserve ni sac, rien n'a bougé. */
export type LootTake = { to: 'reserve' | 'sac'; item: ItemInst } | { to: 'plein' };

export interface RunState {
  version: 7;
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
  pendingLoot?: PendingLoot;
  /** Un duel vient d'être perdu : le Goulag attend d'être joué. */
  pendingGoulag?: boolean;
  /** Le cercle vient de se resserrer : la boutique du ravitaillement attend avant la carte (ou le Top 1). */
  resupply?: boolean;
  credits: number;
  items: ItemInst[];
  bags: BagInst[];
  nextUid: number;
  shop?: { key: string; rerolls: number; offers: ShopOffer[] };
  over?: 'win' | 'lose';
  /** Duels gagnés dans la partie (Goulag compris) : font grandir les Plaques du vétéran. */
  wins?: number;
  /** Crédits rapportés par les objets de revenu au dernier ravitaillement (affichage). */
  lastIncome?: number;
  /** Niveau de Menace (0 à 5, profile.ts) : difficulté choisie au départ. */
  menace?: number;
  /** Défi du jour : date AAAA-MM-JJ (graine et opérateur imposés). */
  daily?: string;
}

/** Paramètres d'un duel : l'UI génère le bot avec generateBot(seed, round, { danger }) et simule. */
export interface DuelParams {
  /** Nature du duel (le champ `kind` est réservé au résultat de playCard). */
  type: FightKind | 'goulag';
  seed: number;
  round: number;
  danger: number;
  /** Thème de la zone : oriente les objets en plus du sac du bot (donc le butin). */
  theme?: ZoneTheme;
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

/** Caisse : crédits et sacoche tout de suite (`loot`), les objets se choisissent dans run.pendingLoot. */
export type PlayResult = { kind: 'shop' } | { kind: 'caisse'; crate: CrateKind; loot: Loot } | ({ kind: 'duel' } & DuelParams);

// ---------- Création ----------

/** Danger ajouté à tous les bots par la Menace (1 : +0,5 ; 4 : +1 en tout). */
export function menaceDanger(run: Pick<RunState, 'menace'>): number {
  const m = run.menace ?? 0;
  return (m >= 1 ? 0.5 : 0) + (m >= 4 ? 0.5 : 0);
}

/** PV max du joueur à une manche (Menace 5 : −15 %). */
export function playerMaxHp(run: Pick<RunState, 'menace'>, round: number): number {
  return Math.round(roundMaxHp(round) * ((run.menace ?? 0) >= 5 ? 0.85 : 1));
}

/** Prix d'une relance de la boutique (Menace 2 : 3 cr). */
export function rerollCost(run: Pick<RunState, 'menace'>): number {
  return (run.menace ?? 0) >= 2 ? REROLL_COST + 1 : REROLL_COST;
}

export function newRun(operator: OperatorId, seed = Math.floor(Math.random() * 1e9), opts: { menace?: number; daily?: string } = {}): RunState {
  const menace = Math.max(0, Math.min(5, opts.menace ?? 0));
  const run: RunState = {
    version: 7,
    seed,
    operator,
    round: 0,
    map: genMap(seed),
    zoneId: null,
    cards: [],
    played: [],
    actionsLeft: 0,
    goulagUsed: menace >= 3,
    credits: START_CREDITS - (menace >= 2 ? 3 : 0),
    items: [],
    bags: [],
    nextUid: 1,
    ...(menace ? { menace } : {}),
    ...(opts.daily ? { daily: opts.daily } : {}),
  };
  // Kit de départ sans arme ni chargeur : l'arme se choisit au largage.
  for (const [id, x, y] of OPERATORS[operator].start) {
    if (ITEMS[id].weapon || ITEMS[id].synergy?.kind === 'mag') continue;
    const it = makeItem(run, id);
    Object.assign(it, { x, y, placed: true });
    run.items.push(it);
  }
  // Une pochette en réserve pour découvrir les sacoches dès le début.
  run.bags.push(makeBag(run, 'pochette'));
  const offers = landingOffers(run, rngFor(seed, 'largage'));
  run.pendingLoot = { items: layoutOffers(offers.map(drop)), usable: [], crate: 'largage', maxPicks: 1, picked: 0 };
  return run;
}

/**
 * Armes du largage : 3 classes d'armes différentes, prix ≤ LANDING_PRICE_CAP, dont au moins une de la famille
 * de l'opérateur. Le choix oriente la run sans la figer.
 */
export function landingOffers(run: RunState, rng: Rng): string[] {
  const fam = OPERATORS[run.operator].family;
  const pool = lootPool(run.operator).filter((id) => ITEMS[id].weapon && ITEMS[id].minRound === 0 && ITEMS[id].price <= LANDING_PRICE_CAP);
  const out: string[] = [];
  const own = pool.filter((id) => ITEMS[id].family === fam);
  if (own.length) out.push(pick(rng, own));
  const classes = () => new Set(out.map((id) => ITEMS[id].wclass));
  for (let guard = 0; out.length < CRATES.largage.offers && guard < 60; guard++) {
    const left = pool.filter((id) => !out.includes(id) && !classes().has(ITEMS[id].wclass));
    if (!left.length) break;
    out.push(pick(rng, left));
  }
  // Ordre mélangé : l'arme de la famille n'est pas toujours la première.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Chargeur fourni avec une arme du largage (aucun pour une arme qui s'alimente seule). */
export function landingMag(weaponId: string): string | undefined {
  const w = ITEMS[weaponId];
  if (!w.weapon || w.weapon.selfFed) return undefined;
  return Object.values(ITEMS).find((d) => d.synergy?.kind === 'mag' && d.caliber === w.caliber && !d.signature && !d.crafted)?.id;
}

export function makeItem(run: RunState, defId: string): ItemInst {
  return { uid: run.nextUid++, defId, rot: 0, x: 0, y: 0, placed: false };
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
  if (run.resupply || !zone || !selectableZones(run).includes(zone)) return false;
  run.zoneId = zoneId;
  run.cards = drawCards(run.seed, run.round, zone);
  run.played = [];
  run.actionsLeft = ACTIONS_PER_ZONE;
  keepLockedOffer(run);
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

export function duelSeed(run: RunState, cardIndex: number): number {
  return hashParts(run.seed, 'duel', run.round, run.zoneId ?? -1, cardIndex, 0);
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
  if (card.type === 'caisse' || card.type === 'caisse_renforcee' || card.type === 'caisse_epique') {
    const crate = card.type;
    const def = CRATES[crate];
    const rng = rngFor(run.seed, crate, run.round, run.zoneId!, index);
    const cash = def.cash(run.round);
    run.credits += cash;
    const bags = rng() < def.bag ? addBags(run, [rollBag(rng, run.round)]) : { taken: [], credits: 0 };
    const offers = layoutOffers(crateOffers(run, crate, rng));
    run.pendingLoot = { items: offers, usable: [], crate, maxPicks: Math.min(def.picks, offers.length), picked: 0 };
    return { kind: 'caisse', crate, loot: { items: [], bags: bags.taken, credits: cash + bags.credits } };
  }
  run.fight = { kind: card.type, cardIndex: index, hp: playerMaxHp(run, run.round) };
  return { kind: 'duel', ...currentDuel(run)! };
}

/** Paramètres du duel en cours (combat de carte ou final), pour lancer ou relancer après un rechargement. */
export function currentDuel(run: RunState): DuelParams | null {
  const f = run.fight;
  if (!f) return null;
  if (f.kind === 'final') {
    return { type: 'final', seed: hashParts(run.seed, 'final'), round: FINAL_ROUND, danger: FINAL_DANGER + menaceDanger(run), hp: f.hp, maxHp: playerMaxHp(run, FINAL_ROUND) };
  }
  return {
    type: f.kind, seed: duelSeed(run, f.cardIndex), round: run.round, danger: zoneDanger(run) + menaceDanger(run), theme: zoneTheme(run),
    hp: f.hp, maxHp: playerMaxHp(run, run.round),
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
  /** Gagné tout de suite : crédits et sacoche éventuelle. Les objets se prennent pendant la fouille. */
  loot: Loot;
  /** Victoire : objets du sac du bot à fouiller (aussi dans run.pendingLoot). */
  lootChoices?: ItemInst[];
  /** L'action est terminée : l'UI appelle endAction (après finishLoot). */
  actionDone: boolean;
  /** Défaite avec le Goulag disponible : l'UI lance goulagParams puis resolveGoulag. */
  goulag: boolean;
  over?: 'win' | 'lose';
}

/** Crédits d'un duel gagné. */
export function duelCredits(kind: FightKind, round: number): number {
  if (kind === 'final') return 0;
  if (kind === 'elite') return 10 + 3 * round;
  return 6 + 2 * round;
}

/**
 * Résout le duel en cours. Victoire : crédits (et sacoche après une Élite) tout de suite ; on fouille ensuite le sac
 * du vaincu pour y prendre 1 objet (2 après une Élite) : run.pendingLoot, lootItem, puis finishLoot.
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
    run.fight = undefined;
    if (!run.goulagUsed) {
      run.goulagUsed = true;
      run.pendingGoulag = true;
      return { loot: empty, actionDone: false, goulag: true };
    }
    run.over = 'lose';
    return { loot: empty, actionDone: true, goulag: false, over: 'lose' };
  }
  const bagChance = f.kind === 'elite' ? ELITE_BAG_CHANCE : 0;
  const rng = rngFor(run.seed, 'loot', run.round, run.zoneId ?? -1, f.cardIndex);
  const bags = rng() < bagChance ? addBags(run, [rollBag(rng, run.round)]) : { taken: [], credits: 0 };
  run.wins = (run.wins ?? 0) + 1;
  const reward = duelCredits(f.kind, run.round);
  run.credits += reward;
  const loot: Loot = { items: [], bags: bags.taken, credits: reward + bags.credits };
  // Le sac du vaincu, tel qu'il était rangé : on y choisit son butin (sauf les objets de signature de l'autre opérateur).
  const choices = out.botItems.filter((it) => canUse(run.operator, it.defId) && !(ITEMS[it.defId].legendary && ownsItem(run, it.defId))).map((it) => ({ ...it, placed: true }));
  const picks = f.kind === 'elite' ? ELITE_PICKS : DUEL_PICKS;
  if (choices.length) run.pendingLoot = { items: choices, usable: out.botUsable ?? [], maxPicks: Math.min(picks, choices.length), picked: 0 };
  const res: DuelResolution = { loot, lootChoices: choices, actionDone: true, goulag: false };
  run.fight = undefined;
  return res;
}

/**
 * Destination d'un nouvel objet : la réserve si elle a de la place, sinon une place libre dans le sac.
 * `bagFirst` : le sac d'abord (largage : on repart prêt à combattre).
 */
function stowSpot(items: ItemInst[], defId: string, cells: Set<string>, bagFirst = false): { to: 'reserve' } | { to: 'sac'; x: number; y: number; rot: ItemInst['rot'] } | null {
  const roomy = items.filter((i) => !i.placed).length < RESERVE_MAX;
  if (roomy && !bagFirst) return { to: 'reserve' };
  const spot = findSpot(items, { uid: -1, defId, rot: 0, x: 0, y: 0, placed: false }, cells);
  return spot ? { to: 'sac', ...spot } : roomy ? { to: 'reserve' } : null;
}

/** Place libre du sac où `defId` touche l'objet `next` (un chargeur contre son arme), ou null. */
function spotTouching(items: ItemInst[], defId: string, next: ItemInst, cells: Set<string>): { x: number; y: number; rot: ItemInst['rot'] } | null {
  const self: ItemInst = { uid: -1, defId, rot: 0, x: 0, y: 0, placed: true };
  for (const rot of [0, 1, 2, 3] as ItemInst['rot'][]) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!canPlace(items, self, x, y, rot, cells)) continue;
        if (sharedEdge({ ...self, x, y, rot }, next)) return { x, y, rot };
      }
    }
  }
  return null;
}

/** Encore le droit de prendre un objet (caisses : `maxPicks`). */
function canTakeMore(p: PendingLoot): boolean {
  return p.maxPicks === undefined || p.picked < p.maxPicks;
}

function takeFromLoot(run: RunState, src: ItemInst, dest: NonNullable<ReturnType<typeof stowSpot>>): LootTake & { to: 'reserve' | 'sac' } {
  const p = run.pendingLoot!;
  p.items = p.items.filter((i) => i.uid !== src.uid);
  p.picked++;
  const item = makeItem(run, src.defId);
  if (dest.to === 'sac') Object.assign(item, { x: dest.x, y: dest.y, rot: dest.rot, placed: true });
  run.items.push(item);
  // Largage : l'arme arrive avec son chargeur, rangé à côté si possible.
  const mag = p.crate === 'largage' ? landingMag(src.defId) : undefined;
  if (mag) {
    const m = makeItem(run, mag);
    const cells = usable(run);
    const near = item.placed ? spotTouching(run.items, mag, item, cells) : null;
    const spot = near ? { to: 'sac' as const, ...near } : stowSpot(run.items, mag, cells, true);
    if (spot?.to === 'sac') Object.assign(m, { x: spot.x, y: spot.y, rot: spot.rot, placed: true });
    run.items.push(m);
  }
  return { to: dest.to, item };
}

/**
 * Prend un objet (uid du bot) dans le sac du vaincu : en réserve, ou directement dans le sac si la réserve
 * est pleine. `plein` si ni l'un ni l'autre n'a de place (l'UI propose alors un échange). Null si invalide.
 */
export function lootItem(run: RunState, uid: number): LootTake | null {
  const src = run.pendingLoot?.items.find((i) => i.uid === uid);
  if (!src || !canTakeMore(run.pendingLoot!)) return null;
  const dest = stowSpot(run.items, src.defId, usable(run), run.pendingLoot!.crate === 'largage');
  return dest ? takeFromLoot(run, src, dest) : { to: 'plein' };
}

/**
 * Échange : revend un objet du joueur (réserve ou sac) pour faire de la place, puis prend l'objet du vaincu.
 * Null (et rien ne change) si l'objet ne rentre toujours pas, même sans celui qu'on donne.
 */
export function swapLoot(run: RunState, uid: number, giveUid: number): { take: LootTake & { to: 'reserve' | 'sac' }; credits: number } | null {
  const src = run.pendingLoot?.items.find((i) => i.uid === uid);
  const give = run.items.find((i) => i.uid === giveUid);
  if (!src || !give || !canTakeMore(run.pendingLoot!)) return null;
  const rest = run.items.filter((i) => i.uid !== giveUid);
  const dest = stowSpot(rest, src.defId, usable(run));
  if (!dest) return null;
  const credits = sellItem(run, giveUid);
  return { take: takeFromLoot(run, src, dest), credits };
}

/** Termine la fouille : ce qui reste dans le sac du vaincu est perdu. */
export function finishLoot(run: RunState): void {
  run.pendingLoot = undefined;
}

/** Paramètres du Goulag : un duel équitable au niveau de la manche, PV pleins. */
export function goulagParams(run: RunState): DuelParams | null {
  if (!run.pendingGoulag) return null;
  const round = Math.min(run.round, FINAL_ROUND);
  return { type: 'goulag', seed: hashParts(run.seed, 'goulag'), round, danger: GOULAG_DANGER, hp: playerMaxHp(run, round), maxHp: playerMaxHp(run, round) };
}

/** Résultat du Goulag. Victoire : retour en jeu, l'action est consommée (l'UI appelle endAction). Défaite : fin de run. */
export function resolveGoulag(run: RunState, win: boolean): void {
  if (!run.pendingGoulag) return;
  run.pendingGoulag = false;
  if (win) run.wins = (run.wins ?? 0) + 1;
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
  keepLockedOffer(run);
  if (run.actionsLeft > 0) return { nextRound: false, final: false };
  run.round++;
  run.zoneId = null;
  run.cards = [];
  run.played = [];
  run.resupply = true;
  // Économie : les objets de revenu posés dans le sac rapportent à chaque nouveau cercle.
  run.lastIncome = roundIncome(run);
  run.credits += run.lastIncome;
  return { nextRound: true, final: run.round >= FINAL_ROUND };
}

/** Crédits rapportés par les objets de revenu posés (Caisse de l'intendant…) au passage au cercle `run.round`. */
export function roundIncome(run: RunState): number {
  return run.items.filter((i) => i.placed && ITEMS[i.defId].income).reduce((t, i) => t + ITEMS[i.defId].income! + Math.max(0, run.round - 1), 0);
}

/** Lance le duel final « Top 1 » (après la 5e manche). */
export function finalDuelParams(run: RunState): DuelParams | null {
  if (run.over || run.round < FINAL_ROUND || run.pendingGoulag || run.resupply) return null;
  if (!run.fight) run.fight = { kind: 'final', cardIndex: -1, hp: playerMaxHp(run, FINAL_ROUND) };
  return currentDuel(run);
}

/** Zone gazée ? (raccourci pour l'UI) */
export function zoneGassed(run: RunState, zone: MapZone, round = run.round): boolean {
  return isGassed(run.map, zone, round);
}

// ---------- Butin ----------

/** Part de chaque catégorie dans le butin et la boutique (%), quel que soit le nombre d'objets qu'elle contient. */
export const CATEGORY_WEIGHTS: Record<Category, number> = {
  arme: 20, munition: 22, accessoire: 20, protection: 12, explosif: 10, medical: 8, composant: 8,
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

const drop = (defId: string): ItemInst => ({ uid: -1, defId, rot: 0, x: 0, y: 0, placed: false });

/** Thème de la zone où l'on est (undefined hors zone ou sans thème). */
function zoneTheme(run: RunState): ZoneTheme | undefined {
  return currentZone(run)?.theme;
}

/** Tire un objet du pool, dans le thème de la zone une fois sur deux (THEME_BIAS) ; le retire du pool. */
function pickFromPool(run: RunState, rng: Rng, pool: string[]): string {
  const theme = zoneTheme(run);
  const themed = pool.filter((id) => themeFits(theme, id));
  const from = themed.length && rng() < THEME_BIAS ? themed : pool;
  const id = pickWeighted(rng, from);
  pool.splice(pool.indexOf(id), 1);
  return id;
}

/** Objets tirés dans le pool de l'opérateur, tous différents, parmi ceux déjà apparus à cette manche (`minRound`). */
function randomItems(run: RunState, rng: Rng, count: number): ItemInst[] {
  const ids = lootPool(run.operator).filter((id) => ITEMS[id].minRound <= run.round);
  const out: ItemInst[] = [];
  for (let i = 0; i < count && ids.length; i++) out.push(drop(pickFromPool(run, rng, ids)));
  return out;
}

/** Une arme au hasard parmi les armes du pool déjà apparues à cette manche. */
function randomWeapon(run: RunState, rng: Rng, exclude: string[]): string | undefined {
  const ids = lootPool(run.operator).filter((id) => ITEMS[id].weapon && ITEMS[id].minRound <= run.round && !exclude.includes(id));
  return ids.length ? pick(rng, ids) : undefined;
}

/**
 * Ingrédient qui complète une recette déjà commencée : recette de l'opérateur dont au moins un ingrédient
 * est dans les objets du joueur et dont il manque un ingrédient trouvable. Undefined s'il n'y en a pas.
 */
export function missingIngredient(run: RunState, rng: Rng, exclude: string[] = []): string | undefined {
  const pool = lootPool(run.operator);
  const owned = run.items.map((i) => i.defId);
  const cands: string[] = [];
  for (const r of RECIPES) {
    if (!r.inputs.every((id) => pool.includes(id)) || !r.inputs.some((id) => owned.includes(id))) continue;
    // Ingrédients manquants, en comptant les doublons (deux frags pour une recette de doublon).
    const left = [...owned];
    for (const id of r.inputs) {
      const k = left.indexOf(id);
      if (k >= 0) left.splice(k, 1);
      else if (!exclude.includes(id) && ITEMS[id].minRound <= run.round) cands.push(id);
    }
  }
  return cands.length ? pick(rng, cands) : undefined;
}

/** Le joueur possède déjà cet objet (sac ou réserve). */
export function ownsItem(run: RunState, defId: string): boolean {
  return run.items.some((i) => i.defId === defId);
}

/** Chance qu'une caisse épique propose un objet légendaire ; chance qu'une boutique en propose un. */
export const EPIC_LEGENDARY_CHANCE = 0.6;
export const SHOP_LEGENDARY_CHANCE = 0.18;

/** Légendaires encore trouvables : déjà apparus à cette manche, pas encore possédés, utilisables par l'opérateur. */
export function legendaryPool(run: RunState): string[] {
  return LEGENDARY_IDS.filter((id) => ITEMS[id].minRound <= run.round && !ownsItem(run, id) && canUse(run.operator, id));
}

/** Objets proposés par une caisse : une arme, la garantie du type de caisse, puis des objets du pool, tous différents. */
function crateOffers(run: RunState, crate: CrateKind, rng: Rng): ItemInst[] {
  const ids: string[] = [];
  const w = randomWeapon(run, rng, ids);
  if (w) ids.push(w);
  if (crate === 'caisse_renforcee') {
    const ing = missingIngredient(run, rng, ids);
    if (ing) ids.push(ing);
  }
  if (crate === 'caisse_epique') {
    const crafted = craftedPool(run.operator).filter((id) => !ids.includes(id));
    if (crafted.length) ids.push(pick(rng, crafted));
    const legs = legendaryPool(run);
    if (legs.length && rng() < EPIC_LEGENDARY_CHANCE) ids.push(pick(rng, legs));
  }
  const pool = lootPool(run.operator).filter((id) => ITEMS[id].minRound <= run.round && !ids.includes(id));
  while (ids.length < CRATES[crate].offers && pool.length) ids.push(pickFromPool(run, rng, pool));
  return ids.map(drop);
}

/** Range les objets proposés côte à côte (rangées de 8 cases au plus), pour l'écran de choix. uid 1, 2… */
function layoutOffers(items: ItemInst[]): ItemInst[] {
  let x = 0;
  let y = 0;
  let rowH = 0;
  return items.map((it, i) => {
    const d = dims(it);
    if (x > 0 && x + d.w > 8) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    const out = { ...it, uid: i + 1, x, y, placed: true };
    x += d.w + 1;
    rowH = Math.max(rowH, d.h);
    return out;
  });
}

/** Objets assemblés que l'opérateur peut obtenir : recettes dont tous les ingrédients sont dans son pool. */
export function craftedPool(op: OperatorId): string[] {
  const pool = lootPool(op);
  return RECIPES.filter((r) => r.inputs.every((id) => pool.includes(id))).map((r) => r.output);
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

export function itemSellValue(defId: string): number {
  return Math.max(1, Math.floor(itemPrice(defId) * SELL_RATIO));
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
    else credits += itemSellValue(d.defId);
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
  const it = makeItem(run, offer.defId);
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
  const v = itemSellValue(it.defId);
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
  if (run.resupply) return `ravitaillement:${run.round}`;
  return `${run.round}:${run.zoneId}:${run.played[run.played.length - 1] ?? -1}`;
}

/** Ferme la boutique en cours : seule l'offre verrouillée reste, pour la boutique suivante. */
function keepLockedOffer(run: RunState): void {
  const carry = run.shop?.offers.filter((o) => o.locked && !o.sold) ?? [];
  run.shop = carry.length ? { key: 'verrou', rerolls: 0, offers: carry } : undefined;
}

/** Ferme la boutique du ravitaillement : place à la carte (ou au Top 1). */
export function closeResupply(run: RunState): void {
  run.resupply = false;
  keepLockedOffer(run);
}

/** Offres de la boutique ouverte (tirées à la première ouverture pour cette carte). */
export function shopOffers(run: RunState): ShopOffer[] {
  const key = shopKey(run);
  if (run.shop && run.shop.key === key) return run.shop.offers;
  // L'offre verrouillée de la boutique précédente nous suit.
  const carry = run.shop?.offers.filter((o) => o.locked && !o.sold) ?? [];
  run.shop = { key, rerolls: 0, offers: carry };
  rollShop(run);
  return run.shop.offers;
}

/** Tire les offres de la boutique ; une offre verrouillée (et pas encore achetée) garde sa place. */
export function rollShop(run: RunState): void {
  if (!run.shop) return;
  const kept = run.shop.offers.filter((o) => o.locked && !o.sold);
  const rng = rngFor(run.seed, 'shop', run.shop.key, run.shop.rerolls);
  const hasBag = !kept.some((o) => o.bag) && rng() < SHOP_BAG_CHANCE;
  const nItems = SHOP_OFFERS - kept.length - (hasBag ? 1 : 0);
  const items = randomItems(run, rng, Math.max(0, nItems));
  // Une fois de temps en temps, un objet légendaire remplace la dernière offre (jamais deux).
  const legs = legendaryPool(run).filter((id) => !kept.some((o) => o.item?.defId === id));
  if (items.length && legs.length && !kept.some((o) => o.item && ITEMS[o.item.defId].legendary) && rng() < SHOP_LEGENDARY_CHANCE) {
    items[items.length - 1] = drop(pick(rng, legs));
  }
  const fresh: ShopOffer[] = items.map((item) => ({ item, price: itemPrice(item.defId), sold: false }));
  if (hasBag) {
    const bag = rollBag(rng, run.round);
    fresh.push({ bag, price: BAGS[bag].price, sold: false });
  }
  run.shop.offers = [...kept, ...fresh];
}

/** Verrouille (ou déverrouille) une offre ; verrouiller une offre libère l'autre. Faux si l'offre est invalide. */
export function toggleLock(run: RunState, index: number): boolean {
  const o = run.shop?.offers[index];
  if (!o || o.sold) return false;
  const on = !o.locked;
  for (const x of run.shop!.offers) x.locked = false;
  o.locked = on;
  return true;
}

/** Relance la boutique (rerollCost crédits). */
export function rerollShop(run: RunState): boolean {
  const cost = rerollCost(run);
  if (!run.shop || run.credits < cost) return false;
  run.credits -= cost;
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
    o.locked = false;
    return takeItem(run, o.item);
  }
  if (o.bag) {
    if (reserveBags(run).length >= BAG_RESERVE_MAX) return null;
    run.credits -= o.price;
    o.sold = true;
    o.locked = false;
    const b = makeBag(run, o.bag);
    run.bags.push(b);
    return b;
  }
  return null;
}

// ---------- Sauvegarde ----------

export function saveRun(run: RunState): void {
  noteItems(run.items.map((i) => i.defId));
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
    if (run.version !== 7 || run.over) return null;
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
