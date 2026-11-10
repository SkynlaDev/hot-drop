// Bots adverses : un vrai sac généré comme celui d'un joueur (mêmes objets, mêmes règles, même computeLoadout).
import { ITEMS, ItemDef } from '../data/items';
import { OPERATOR_IDS, OperatorId, lootPool } from '../data/operators';
import { RECIPES } from '../data/recipes';
import { ItemInst, Rot, canPlace, cellKey, cellsAt, cellsOf } from './grid';
import { MAX_RARITY } from './rarity';
import { Rng, hashParts, mulberry32, pick, weighted } from './rng';
import { PlayerLoadout, computeLoadout, maxHpFor } from './stats';

export type BotQuality = 'faible' | 'normal' | 'fort';

export interface BotBuild {
  name: string;
  operator: OperatorId;
  items: ItemInst[];
  /** Cases "x,y" utilisables de son sac. */
  usable: string[];
  maxHp: number;
  quality: BotQuality;
}

// Indicatifs originaux.
const CALLSIGNS = [
  'Corbeau', 'Lynx', 'Vipère', 'Faucon', 'Renard', 'Sanglier', 'Hibou', 'Brochet', 'Fennec', 'Belette',
  'Chacal', 'Grizzli', 'Mistral', 'Orage', 'Granit', 'Silex', 'Ardoise', 'Cobalt', 'Tonnerre', 'Givre',
  'Frelon', 'Mante', 'Scorpion', 'Gerfaut', 'Busard', 'Milan', 'Carcajou', 'Loutre', 'Sirocco', 'Basalte',
];

/** Sac rectangulaire du bot selon son niveau : 5×4 de base (colonnes 2 à 6, lignes 2 à 5), puis plus grand. */
const BACKPACKS: [number, number, number, number][] = [
  // x0, y0, x1, y1 (inclus), dans la grille 9×8
  [2, 2, 6, 5], // 5×4
  [1, 2, 6, 5], // 6×4
  [1, 1, 6, 5], // 6×5
  [1, 1, 7, 5], // 7×5
  [1, 1, 7, 6], // 7×6
  [0, 1, 7, 6], // 8×6
];

/** Chances (%) de rareté, de Commun à Légendaire, selon le niveau du bot. */
const RARITY_ODDS = [
  [95, 5, 0, 0, 0],
  [50, 38, 12, 0, 0],
  [35, 38, 22, 5, 0],
  [22, 36, 30, 11, 1],
  [12, 28, 36, 20, 4],
  [5, 18, 37, 30, 10],
  [0, 10, 32, 40, 18],
];

/** Niveau de rareté (ligne de RARITY_ODDS) et nombre d'objets du bot du Top 1 (avant le bonus de bot fort). */
export const FINAL_LEVEL = 5;
export const FINAL_ITEMS = 9;
/** Objets dans le sac d'un bot normal, par manche (4 au 1er cercle, comme un sac de départ). */
export const BOT_ITEMS = [4, 6, 7, 8, 9];

/**
 * Part du bonus de danger de la zone appliquée selon la manche : rien au 1er cercle (tout le monde vient
 * d'atterrir), puis il monte. Le danger des grandes zones pèse surtout en fin de partie.
 */
export const DANGER_RAMP = [0, 0.25, 0.5, 0.5, 0.75];

/** Plus haute rareté minimale autorisée dans le sac selon le niveau (pas de Fusil Aigle au 1er tour). */
const minRarityCap = (lvl: number) => Math.min(MAX_RARITY, 1 + Math.floor(lvl / 2));

/** Chances de bot fort et faible par manche (danger 0). Jamais de bot fort au 1er cercle. */
export const FORT_ODDS = [0, 0.35, 0.45, 0.5, 0.55];
export const FAIBLE_ODDS = [0.3, 0.15, 0.1, 0.05, 0.05];

/** Probabilités de qualité (fort, faible) selon le tour et le danger de la zone (déjà ramené à la manche). */
export function qualityOdds(round: number, danger = 0): { fort: number; faible: number } {
  const r = Math.max(0, Math.min(round, FORT_ODDS.length - 1));
  if (round === 0) return { fort: 0, faible: FAIBLE_ODDS[0] };
  const fort = Math.min(0.6, FORT_ODDS[r] + 0.1 * danger);
  const faible = Math.max(0.05, FAIBLE_ODDS[r] - 0.1 * danger);
  return { fort, faible };
}

/** Accessoire compatible avec cette arme (son bonus s'applique). */
export function accessoryFits(acc: ItemDef, w: ItemDef): boolean {
  const k = acc.synergy?.kind;
  const long = w.tags.includes('arme_longue');
  if (k === 'mag') return acc.caliber === w.caliber || !!w.weapon?.feedsAny;
  if (k === 'scope' || k === 'bipod') return long;
  if (k === 'holo') return !long;
  return !!k;
}

const isWeapon = (id: string) => !!ITEMS[id].weapon;
const isMag = (id: string) => ITEMS[id].synergy?.kind === 'mag';
const isAccessory = (id: string) => !!ITEMS[id].synergy && !isMag(id);

/** Génère le sac d'un bot, déterministe pour (graine, tour, options). */
export function generateBot(seed: number, round: number, opts: { danger?: number; final?: boolean; goulag?: boolean } = {}): BotBuild {
  // 1er cercle : tout le monde vient d'atterrir. Quelle que soit la zone, un bot a un sac de départ
  // (jamais fort, objets de départ, tous Communs, sac de base) : la taille de la zone ne change que les cartes.
  const landing = round === 0 && !opts.final;
  const danger = (opts.danger ?? 0) * (opts.final ? 1 : DANGER_RAMP[Math.min(round, DANGER_RAMP.length - 1)]);
  const rng = mulberry32(hashParts('bot', seed, round, opts.danger ?? 0, opts.final ? 1 : 0, opts.goulag ? 1 : 0));
  const operator = pick(rng, OPERATOR_IDS);
  const name = rng() < 0.4 ? `${pick(rng, CALLSIGNS)}-${1 + Math.floor(rng() * 9)}` : pick(rng, CALLSIGNS);

  let quality: BotQuality = 'normal';
  if (opts.final) quality = 'fort';
  else if (!opts.goulag) {
    const q = qualityOdds(round, danger);
    const r = rng();
    quality = r < q.fort ? 'fort' : r < q.fort + q.faible ? 'faible' : 'normal';
  }

  // Niveau : tour + danger, ajusté par la qualité. Le Top 1 a les raretés de la ligne FINAL_LEVEL.
  const qBonus = quality === 'fort' ? 1 : quality === 'faible' ? -1 : 0;
  const lvl = Math.max(0, Math.min(RARITY_ODDS.length - 1, Math.round(opts.final ? FINAL_LEVEL : round + danger + qBonus)));
  const bp = BACKPACKS[Math.min(BACKPACKS.length - 1, opts.final ? 5 : round + (danger >= 1 ? 1 : 0))];
  const usable: string[] = [];
  for (let y = bp[1]; y <= bp[3]; y++) for (let x = bp[0]; x <= bp[2]; x++) usable.push(cellKey(x, y));

  // Nombre d'objets : 4 au 1er tour (comme un sac de départ), puis plus ; ±1 selon la qualité.
  const baseItems = opts.final ? FINAL_ITEMS : BOT_ITEMS[Math.min(round, BOT_ITEMS.length - 1)] + Math.round(danger);
  const nItems = Math.max(3, baseItems + (quality === 'fort' ? 1 : quality === 'faible' ? -1 : 0));
  const cap = minRarityCap(lvl);
  // Aux premiers niveaux, pas d'objets chers (plaque céramique…) hors armes.
  const itemCap = [5, 7][lvl] ?? Infinity;
  const pool = lootPool(operator).filter((id) => ITEMS[id].minRarity <= cap && (isWeapon(id) || ITEMS[id].price <= itemCap));
  const crafted = RECIPES.filter((r) => r.inputs.every((id) => lootPool(operator).includes(id))).map((r) => r.output);
  const rollRarity = (id: string) => landing ? 0 : Math.max(ITEMS[id].minRarity, weighted(rng, RARITY_ODDS[lvl].map((w, i) => [i, w] as const)));

  // Composition : armes, chargeurs et accessoires assortis, protection, puis le reste.
  const ids: string[] = [];
  // Armes plafonnées par prix aux premiers niveaux : un bot du 1er cercle a une arme de départ.
  const priceCap = [7, 8, 10][lvl] ?? Infinity;
  const weapons = pool.filter((id) => isWeapon(id) && ITEMS[id].price <= priceCap);
  // 2e arme de plus en plus probable quand le sac se remplit (de 6 à 8 objets).
  const nWeapons = nItems >= 6 && rng() < (nItems - 5) / 3 ? 2 : 1;
  const craftedOk = quality === 'fort' && lvl >= 2;
  const craftedWeapons = crafted.filter(isWeapon);
  const craftedOther = crafted.filter((id) => !isWeapon(id));
  const chosenWeapons: string[] = [];
  for (let i = 0; i < nWeapons; i++) {
    if (i === 0 && craftedOk && rng() < 0.7) chosenWeapons.push(pick(rng, craftedWeapons));
    else chosenWeapons.push(pick(rng, weapons));
  }
  const mags = pool.filter(isMag);
  const accs = pool.filter(isAccessory);
  const perWeapon: string[][] = chosenWeapons.map((w) => {
    const wd = ITEMS[w];
    const out: string[] = [];
    if (!wd.weapon!.selfFed) {
      const fit = mags.filter((m) => accessoryFits(ITEMS[m], wd));
      if (fit.length) out.push(pick(rng, fit));
    }
    const fitAcc = accs.filter((a) => accessoryFits(ITEMS[a], wd));
    if (fitAcc.length) out.push(pick(rng, fitAcc));
    return out;
  });
  ids.push(chosenWeapons[0], ...perWeapon[0]);
  const armors = pool.filter((id) => ITEMS[id].armor);
  ids.push(craftedOk && chosenWeapons[0] && !ITEMS[chosenWeapons[0]].crafted ? pick(rng, craftedOther.filter((id) => ITEMS[id].armor)) ?? pick(rng, armors) : pick(rng, armors));
  if (chosenWeapons[1]) ids.push(chosenWeapons[1], ...perWeapon[1]);
  const support = pool.filter((id) => ITEMS[id].active);
  // Le reste : au plus 2 exemplaires d'un même objet.
  const room = (id: string | undefined): id is string => !!id && ids.filter((x) => x === id).length < 2;
  for (let guard = 0; ids.length < nItems && guard < 50; guard++) {
    const r = rng();
    let id: string | undefined;
    if (r < 0.5) id = pick(rng, support);
    else if (r < 0.75) {
      // Chargeur ou accessoire en plus pour une arme du sac.
      const wd = ITEMS[pick(rng, chosenWeapons)];
      id = pick(rng, [...mags, ...accs].filter((a) => accessoryFits(ITEMS[a], wd)));
    } else id = pick(rng, armors);
    if (room(id)) ids.push(id);
  }
  ids.length = Math.min(ids.length, nItems);

  // Rangement bâclé (chargeur ou accessoire posé n'importe où) : fréquent chez les faibles, rare ensuite.
  const sloppy = quality === 'faible' ? 0.5 : quality === 'normal' ? Math.max(0.05, 0.3 - 0.06 * round) : 0;
  const items = placeBot(ids.map((id) => ({ id, rarity: rollRarity(id) })), new Set(usable), rng, sloppy);
  return { name, operator, items, usable, maxHp: maxHpFor(round), quality };
}

export function botLoadout(b: BotBuild): PlayerLoadout {
  return computeLoadout(b.items, b.operator, b.maxHp).loadout;
}

/**
 * Rangement d'un sac : armes d'abord, puis chargeurs du bon calibre contre les armes, puis accessoires
 * contre une arme compatible, puis le reste en bordure. `sloppy` = chance de poser un chargeur ou
 * un accessoire n'importe où. Les objets qui ne rentrent pas sont abandonnés.
 */
export function placeBot(list: { id: string; rarity: number }[], usable: Set<string>, rng: Rng, sloppy = 0): ItemInst[] {
  const placed: ItemInst[] = [];
  const order = [
    ...list.filter((e) => isWeapon(e.id)),
    ...list.filter((e) => isMag(e.id)),
    ...list.filter((e) => isAccessory(e.id)),
    ...list.filter((e) => !isWeapon(e.id) && !ITEMS[e.id].synergy).sort((x, y) => cells(y.id) - cells(x.id)),
  ];
  let uid = 1;
  const bounds = [...usable].map((k) => k.split(',').map(Number));
  const minX = Math.min(...bounds.map((b) => b[0]));
  const maxX = Math.max(...bounds.map((b) => b[0]));
  const minY = Math.min(...bounds.map((b) => b[1]));
  const maxY = Math.max(...bounds.map((b) => b[1]));
  // Clés numériques internes (plus rapides que les chaînes "x,y").
  const nk = (x: number, y: number) => (x + 16) * 64 + (y + 16);
  const use = new Set([...usable].map((k) => { const [x, y] = k.split(',').map(Number); return nk(x, y); }));
  /** Case occupée → objet posé. */
  const owner = new Map<number, ItemInst>();

  for (const e of order) {
    const inst: ItemInst = { uid: uid++, defId: e.id, rarity: e.rarity, rot: 0, x: 0, y: 0, placed: true };
    const d = ITEMS[e.id];
    const free = (x: number, y: number) => use.has(nk(x, y)) && !owner.has(nk(x, y));
    const weapon = isWeapon(e.id);
    const synergy = !!d.synergy;
    const careless = synergy && rng() < sloppy;
    const cands: { x: number; y: number; rot: Rot; score: number }[] = [];
    for (const rot of [0, 1, 2, 3] as Rot[]) {
      for (let y = minY - 4; y <= maxY; y++) {
        for (let x = minX - 4; x <= maxX; x++) {
          const foot = cellsAt(inst, x, y, rot);
          if (!foot.every(([cx, cy]) => free(cx, cy))) continue; // filtre rapide, canPlace confirme plus bas
          const fk = new Set(foot.map(([cx, cy]) => nk(cx, cy)));
          let around = 0; // cases libres autour de l'empreinte
          const touching = new Set<ItemInst>();
          for (const [cx, cy] of foot) {
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const k = nk(cx + dx, cy + dy);
              if (fk.has(k)) continue;
              const o = owner.get(k);
              if (o) touching.add(o);
              else if (use.has(k)) around++;
            }
          }
          let score = rng() * 0.5;
          if (careless) score += rng() * 10;
          else if (weapon) score += around; // de la place autour pour ses chargeurs et accessoires
          else if (synergy) {
            const fits = [...touching].filter((p) => isWeapon(p.defId) && accessoryFits(d, ITEMS[p.defId])).length;
            score += fits * 100 - around;
          } else score -= around; // le reste se range dans les coins pour laisser de la place
          cands.push({ x, y, rot, score });
        }
      }
    }
    cands.sort((p, q) => q.score - p.score);
    const best = cands.find((c) => canPlace(placed, inst, c.x, c.y, c.rot, usable));
    if (best) {
      Object.assign(inst, { x: best.x, y: best.y, rot: best.rot });
      placed.push(inst);
      for (const [cx, cy] of cellsOf(inst)) owner.set(nk(cx, cy), inst);
    }
  }
  return placed;
}

function cells(id: string): number {
  return ITEMS[id].shape.join('').split('').filter((c) => c === 'X').length;
}
