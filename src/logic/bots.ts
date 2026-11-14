// Bots adverses : un vrai sac généré comme celui d'un joueur (mêmes objets, mêmes règles, même computeLoadout).
import { ITEMS, ItemDef } from '../data/items';
import { ARCHETYPES, ArchetypeId, archetypesFor } from '../data/archetypes';
import { NEUTRAL_FAMILIES, OPERATORS, OPERATOR_IDS, OperatorId, canUse, corePool, lootPool } from '../data/operators';
import { RECIPES } from '../data/recipes';
import { ItemInst, Rot, canPlace, cellKey, cellsAt, cellsOf } from './grid';
import { Rng, hashParts, mulberry32, pick } from './rng';
import { PlayerLoadout, computeLoadout, maxHpFor } from './stats';
import { accessoryFits, starCells, starSpecs } from './stars';
import { THEME_BIAS, ZoneTheme, themeFits } from './zone';

export type BotQuality = 'faible' | 'normal' | 'fort';

export interface BotBuild {
  name: string;
  operator: OperatorId;
  archetype: ArchetypeId;
  items: ItemInst[];
  /** Cases "x,y" utilisables de son sac. */
  usable: string[];
  maxHp: number;
  quality: BotQuality;
  /** Duels gagnés supposés (objets légendaires qui grandissent : Plaques du vétéran). */
  wins?: number;
}

/** Chance qu'une Élite porte un objet légendaire de son plan, à partir de ce tour (le Top 1 en a toujours un). */
export const ELITE_LEGENDARY_CHANCE = 0.4;
export const ELITE_LEGENDARY_FROM = 2;

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
  [0, 0, 8, 6], // 9×7 (Top 1 Rempart : objets gros et nombreux)
];

/**
 * Chance, selon le niveau du bot, que son arme principale, sa protection ou un objet de soutien soit
 * un objet assemblé (recette) : c'est ce qui remplace les raretés dans la montée en puissance des bots.
 */
export const CRAFTED_ODDS = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.85];
/** Chance qu'un objet tiré vienne de l'archétype du bot (sinon de son pool « cœur »). */
export const ARCH_FOCUS = 0.8;
/** Composants : les bots ne les portent pas seuls, ils ont directement les versions assemblées. */
export const BOT_EXCLUDED = new Set(['briquet', 'batterie']);
/** Objets de rang 2 (ingrédients assemblés) : seulement chez les bots du 5e cercle et du Top 1, et plus rarement. */
export const RANK2 = new Set(['souffle_dragon', 'bobine_tesla', 'juggernaut', 'poste_secours', 'lame_rouge', 'rhinoceros', 'kr4_mitrailleur', 'bombe_phosphore']);
export const RANK2_FROM_LEVEL = 4;
export const RANK2_SHARE = 0.25;
export const ARCH_FOCUS_LANDING = 0.4;
/** Manche (0 = 1er cercle) à partir de laquelle un bot peut jouer le build Lame. */
export const LAME_FROM = 3;
/** Bonus de chance d'objet assemblé pour un bot fort. */
const FORT_CRAFTED_BONUS = 0.25;

/** Niveau (index de CRAFTED_ODDS) et nombre d'objets du bot du Top 1 (avant le bonus de bot fort). */
export const FINAL_LEVEL = 6;
export const FINAL_ITEMS = 12;
/** Objets dans le sac d'un bot normal, par manche (4 au 1er cercle, comme un sac de départ). */
export const BOT_ITEMS = [4, 6, 8, 10, 12];

/**
 * Part du bonus de danger de la zone appliquée selon la manche : rien au 1er cercle (tout le monde vient
 * d'atterrir), puis il monte. Le danger des grandes zones pèse surtout en fin de partie.
 */
export const DANGER_RAMP = [0, 0.25, 0.5, 0.5, 0.75];

/** Plus haute manche d'apparition autorisée dans le sac selon le niveau (pas de Fusil Aigle aux premiers niveaux). */
const minRoundCap = (lvl: number) => Math.floor(lvl / 2);

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

export { accessoryFits };

const isWeapon = (id: string) => !!ITEMS[id].weapon;
const isMag = (id: string) => ITEMS[id].synergy?.kind === 'mag';
const isAccessory = (id: string) => !!ITEMS[id].synergy && !isMag(id);
const isMelee = (id: string) => !!ITEMS[id].melee;

/** Génère le sac d'un bot, déterministe pour (graine, tour, options). */
export function generateBot(seed: number, round: number, opts: { danger?: number; final?: boolean; goulag?: boolean; elite?: boolean; theme?: ZoneTheme } = {}): BotBuild {
  // 1er cercle : tout le monde vient d'atterrir. Quelle que soit la zone, un bot a un sac de départ
  // (jamais fort, objets de départ, aucun objet assemblé, sac de base) : la taille de la zone ne change que les cartes.
  const landing = round === 0 && !opts.final;
  const danger = (opts.danger ?? 0) * (opts.final ? 1 : DANGER_RAMP[Math.min(round, DANGER_RAMP.length - 1)]);
  const rng = mulberry32(hashParts('bot', seed, round, opts.danger ?? 0, opts.final ? 1 : 0, opts.goulag ? 1 : 0));
  const operator = pick(rng, OPERATOR_IDS);
  // Le build Lame demande des pièces : pas avant le 4e cercle, ni au Top 1.
  const archetype = pick(rng, archetypesFor(operator).filter((a) => a !== 'lame' || (round >= LAME_FROM && !opts.final)));
  const name = rng() < 0.4 ? `${pick(rng, CALLSIGNS)}-${1 + Math.floor(rng() * 9)}` : pick(rng, CALLSIGNS);

  let quality: BotQuality = 'normal';
  if (opts.final || opts.elite) quality = 'fort';
  else if (!opts.goulag) {
    const q = qualityOdds(round, danger);
    const r = rng();
    quality = r < q.fort ? 'fort' : r < q.fort + q.faible ? 'faible' : 'normal';
  }

  // Niveau : tour + danger, ajusté par la qualité. Le Top 1 a le niveau FINAL_LEVEL.
  const qBonus = quality === 'fort' ? 1 : quality === 'faible' ? -1 : 0;
  const lvl = Math.max(0, Math.min(CRAFTED_ODDS.length - 1, Math.round(opts.final ? FINAL_LEVEL : round + danger + qBonus)));
  const A0 = ARCHETYPES[archetype];
  const bp = BACKPACKS[Math.min(BACKPACKS.length - 1, (opts.final ? 5 : round + (danger >= 1 ? 1 : 0)) + (A0.bigBag && !landing ? 1 : 0))];
  const usable: string[] = [];
  for (let y = bp[1]; y <= bp[3]; y++) for (let x = bp[0]; x <= bp[2]; x++) usable.push(cellKey(x, y));

  // Nombre d'objets : 4 au 1er tour (comme un sac de départ), puis plus ; ±1 selon la qualité.
  const baseItems = opts.final ? FINAL_ITEMS : BOT_ITEMS[Math.min(round, BOT_ITEMS.length - 1)] + Math.round(danger);
  const nItems = Math.max(3, baseItems + (quality === 'fort' ? 1 : quality === 'faible' ? -1 : 0) + (landing ? 0 : A0.extraItems ?? 0));
  const cap = minRoundCap(lvl);
  // Aux premiers niveaux, pas d'objets chers (plaque céramique…) hors armes.
  const itemCap = [5, 7][lvl] ?? Infinity;
  // Pool : tout ce que l'opérateur peut trouver (pool commun), avec une préférence forte pour l'archétype.
  // Hors archétype, le bot reste dans son pool « cœur » pour garder un sac cohérent.
  const capOk = (id: string) => ITEMS[id].minRound <= cap && (isWeapon(id) || ITEMS[id].price <= itemCap);
  // 1er cercle : pas encore d'objets de signature (ils se trouvent en jouant).
  // Objets du combat v2 : réservés au joueur jusqu'au calibrage des bots (design/COMBAT-V2.md, étape 4).
  const pool = lootPool(operator).filter((id) => capOk(id) && !(landing && ITEMS[id].signature) && !BOT_EXCLUDED.has(id));
  const core = new Set(corePool(operator));
  const coreFams = [OPERATORS[operator].family, ...NEUTRAL_FAMILIES];
  // Objets assemblés : « cœur » si leur famille l'est (corePool ne contient pas d'objets assemblés).
  const inCoreOf = (id: string) => core.has(id) || (!!ITEMS[id].crafted && coreFams.includes(ITEMS[id].family));
  // Objets de rang 2 : niveau suffisant, et seulement une partie du temps (RANK2_SHARE).
  const rank2Ok = lvl >= RANK2_FROM_LEVEL && rng() < RANK2_SHARE;
  const crafted = [...new Set(RECIPES.filter((r) => canUse(operator, r.output) && !BOT_EXCLUDED.has(r.output) && (rank2Ok || !RANK2.has(r.output))).map((r) => r.output))];
  const craftChance = landing ? 0 : Math.min(0.95, CRAFTED_ODDS[lvl] + (quality === 'fort' ? FORT_CRAFTED_BONUS : 0));
  const A = ARCHETYPES[archetype];
  const wanted = new Set([...A.weapons, ...A.crafted, ...A.extras]);
  /** Un objet de la liste : de l'archétype le plus souvent, sinon du pool cœur. */
  // 1er cercle : on vient d'atterrir, le plan se devine à peine.
  const focus = landing ? ARCH_FOCUS_LANDING : ARCH_FOCUS;
  const prefer = (list: string[], p = focus): string | undefined => {
    const mine = list.filter((id) => wanted.has(id));
    if (mine.length && rng() < p) return pick(rng, mine);
    const inCore = list.filter(inCoreOf);
    return inCore.length ? pick(rng, inCore) : list.length ? pick(rng, list) : undefined;
  };

  // Composition : armes, chargeurs et accessoires assortis, protection, puis le reste.
  const ids: string[] = [];
  // Armes plafonnées par prix aux premiers niveaux : un bot du 1er cercle a une arme de départ.
  const priceCap = [7, 8, 10][lvl] ?? Infinity;
  // Les armes de l'archétype échappent au plafond de prix (hors 1er cercle) : un Tir lourd a son fusil.
  const weapons = pool.filter((id) => isWeapon(id) && (ITEMS[id].price <= priceCap || (!landing && wanted.has(id))));
  const gunless = A.weapons.length === 0;
  // 2e arme de plus en plus probable quand le sac se remplit (de 6 à 8 objets).
  // La Marque ne sert qu'avec deux armes : une marque, l'autre achève.
  const nWeapons = gunless ? 0 : A.twoGuns && nItems >= 5 ? 2 : nItems >= 6 && rng() < (nItems - 5) / 3 ? 2 : 1;
  const craftedWeapons = crafted.filter((id) => isWeapon(id) && !isMelee(id));
  const craftedArmors = crafted.filter((id) => ITEMS[id].armor);
  const craftedSupport = crafted.filter((id) => ITEMS[id].active);
  const chosenWeapons: string[] = [];
  for (let i = 0; i < nWeapons; i++) {
    const c = craftedWeapons.length && rng() < craftChance ? prefer(craftedWeapons, 0.9) : undefined;
    const w = c ?? prefer(weapons);
    if (w) chosenWeapons.push(w);
  }
  const mags = pool.filter(isMag);
  const accs = pool.filter(isAccessory);
  const perWeapon: string[][] = chosenWeapons.map((w) => {
    const wd = ITEMS[w];
    const out: string[] = [];
    if (!wd.weapon!.selfFed) {
      const m = prefer(mags.filter((x) => accessoryFits(ITEMS[x], wd)));
      if (m) out.push(m);
    }
    const a = A.noAccessory ? undefined : prefer(accs.filter((x) => accessoryFits(ITEMS[x], wd)));
    if (a) out.push(a);
    return out;
  });
  if (chosenWeapons[0]) ids.push(chosenWeapons[0], ...perWeapon[0]);
  // Mêlée : en plus du compte d'objets (un couteau au 1er cercle) ; le build Lame en fait son cœur.
  const melees = pool.filter(isMelee);
  const craftedMelee = crafted.filter(isMelee);
  const pickMelee = () => (craftedMelee.length && rng() < craftChance ? prefer(craftedMelee, 0.9) : undefined) ?? prefer(melees);
  const melee = landing && !gunless ? 'couteau' : pickMelee();
  if (gunless) for (let i = 0; i < (nItems >= 6 ? 2 : 1); i++) {
    const m = pickMelee();
    if (m) ids.push(m);
  }
  const armors = pool.filter((id) => ITEMS[id].armor);
  const armor = (craftedArmors.length && rng() < craftChance ? prefer(craftedArmors, 0.9) : undefined) ?? prefer(armors);
  if (armor) ids.push(armor);
  if (chosenWeapons[1]) ids.push(chosenWeapons[1], ...perWeapon[1]);
  const support = pool.filter((id) => ITEMS[id].active && !isMelee(id));
  // Thème de la zone : une fois sur deux, l'objet en plus vient du thème (c'est ce qu'on trouvera en le fouillant).
  const themed = pool.filter((id) => !isWeapon(id) && themeFits(opts.theme, id));
  const armorShare = A.armorShare ?? 0.25;
  // Le reste : au plus 2 exemplaires d'un même objet.
  const room = (id: string | undefined): id is string => !!id && ids.filter((x) => x === id).length < 2;
  for (let guard = 0; ids.length < nItems && guard < 50; guard++) {
    const r = rng();
    let id: string | undefined;
    if (themed.length && rng() < THEME_BIAS) id = pick(rng, themed);
    else if (r < armorShare) id = (craftedArmors.length && rng() < craftChance ? prefer(craftedArmors, 0.9) : undefined) ?? prefer(armors);
    else if (r < armorShare + 0.4) id = (craftedSupport.length && rng() < craftChance ? prefer(craftedSupport, 0.9) : undefined) ?? prefer(support);
    else if (chosenWeapons.length && !A.noAccessory) {
      // Chargeur ou accessoire en plus pour une arme du sac.
      const wd = ITEMS[pick(rng, chosenWeapons)];
      id = prefer([...mags, ...accs].filter((a) => accessoryFits(ITEMS[a], wd)));
    } else id = gunless ? pickMelee() : prefer([...armors, ...support]);
    if (room(id)) ids.push(id);
  }
  ids.length = Math.min(ids.length, nItems);
  if (melee) ids.push(melee);

  // Objet légendaire du plan : toujours au Top 1, parfois chez une Élite (c'est aussi du butin à fouiller).
  if (opts.final || (opts.elite && round >= ELITE_LEGENDARY_FROM && rng() < ELITE_LEGENDARY_CHANCE)) {
    const legs = A.legendaries.filter((id) => canUse(operator, id));
    if (legs.length) ids.push(pick(rng, legs));
  }

  // Rangement bâclé (chargeur ou accessoire posé n'importe où) : fréquent chez les faibles, rare ensuite.
  // Le Goulag est un duel équitable : un bot qui range bien son sac.
  const sloppy = opts.goulag ? 0 : quality === 'faible' ? 0.5 : quality === 'normal' ? Math.max(0.05, 0.3 - 0.06 * round) : 0;
  const items = placeBot(ids, new Set(usable), rng, sloppy);
  return { name, operator, archetype, items, usable, maxHp: maxHpFor(round), quality, wins: opts.final ? 10 : 2 * round };
}

export function botLoadout(b: BotBuild): PlayerLoadout {
  return computeLoadout(b.items, b.operator, b.maxHp, { wins: b.wins }).loadout;
}

/**
 * Rangement d'un sac : armes d'abord, puis chargeurs du bon calibre contre les armes, puis accessoires
 * contre une arme compatible, puis le reste en bordure. `sloppy` = chance de poser un chargeur ou
 * un accessoire n'importe où. Les objets qui ne rentrent pas sont abandonnés.
 */
export function placeBot(list: string[], usable: Set<string>, rng: Rng, sloppy = 0): ItemInst[] {
  const placed: ItemInst[] = [];
  // Les protections passent avant les accessoires : un sac plein abandonne un viseur plutôt que son armure.
  const isArmor = (id: string) => !!ITEMS[id].armor && !isWeapon(id);
  // Armes de mêlée juste après les armes à feu : un build Lame ne doit jamais perdre ses lames faute de place.
  const order = [
    ...list.filter((id) => isWeapon(id)),
    ...list.filter((id) => isMelee(id)),
    ...list.filter((id) => isMag(id)),
    ...list.filter(isArmor).sort((x, y) => cells(y) - cells(x)),
    ...list.filter((id) => isAccessory(id)),
    ...list.filter((id) => !isWeapon(id) && !isMelee(id) && !ITEMS[id].synergy && !isArmor(id)).sort((x, y) => cells(y) - cells(x)),
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

  for (const id of order) {
    const inst: ItemInst = { uid: uid++, defId: id, rot: 0, x: 0, y: 0, placed: true };
    const d = ITEMS[id];
    const free = (x: number, y: number) => use.has(nk(x, y)) && !owner.has(nk(x, y));
    const weapon = isWeapon(id);
    const synergy = !!d.synergy;
    const careless = synergy && rng() < sloppy;
    // Étoiles des objets déjà posés qui attendent cet objet : cases qui les allumeraient.
    const wantedAt = new Map<number, number>();
    for (const p of placed) {
      for (const sp of starSpecs(p.defId)) {
        if (!sp.effect || !sp.wants(d)) continue;
        for (const [cx, cy] of starCells(p.defId, p.x, p.y, p.rot, sp)) wantedAt.set(nk(cx, cy), (wantedAt.get(nk(cx, cy)) ?? 0) + 1);
      }
    }
    const ownStars = starSpecs(id).filter((sp) => sp.effect);
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
          // Étoiles allumées (objets à étoiles) : celles des objets posés, puis les siennes.
          let lit = 0;
          for (const [cx, cy] of foot) lit += wantedAt.get(nk(cx, cy)) ?? 0;
          for (const sp of ownStars) {
            if (starCells(id, x, y, rot, sp).some(([cx, cy]) => { const o = owner.get(nk(cx, cy)); return !!o && sp.wants(ITEMS[o.defId]); })) lit++;
          }
          if (!careless) score += lit * 40;
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
