// Mode Zombie : progression hors partie (localStorage, aucun serveur).
// Classes personnalisées, XP et accessoires de chaque arme, records, objectifs et déblocages.
import {
  ACCESSORIES, AccId, FIGS, FigId, GOALS, GoalId, PERKS, PerkId, STARTER_PERKS, STARTER_WEAPONS, SlotId, WEAPONS, WEAPON_MAX_LEVEL,
  WeaponId, ZOMBIES, ZType, ELITE, RUN_TIME,
} from './data';

export const SAVE_KEY = 'hotdrop.zombie.v1';
export const CLASS_SLOTS = 3;

export interface ZClass {
  name: string;
  fig: FigId;
  weapon: WeaponId;
  perk: PerkId;
}

export interface WeaponProgress {
  xp: number;
  equipped: Partial<Record<SlotId, AccId>>;
}

export interface Records {
  bestTime: number;
  bestKills: number;
  bestLevel: number;
  totalKills: number;
  runs: number;
  wins: number;
  bossKills: number;
}

export interface ZSave {
  v: 1;
  classes: (ZClass | null)[];
  selected: number;
  weapons: Partial<Record<WeaponId, WeaponProgress>>;
  records: Records;
  goals: GoalId[];
}

export function defaultSave(): ZSave {
  return {
    v: 1,
    classes: [{ name: 'Viper', fig: 'viper', weapon: 'fusil_assaut', perk: 'eclaireur' }, null, null],
    selected: 0,
    weapons: {},
    records: { bestTime: 0, bestKills: 0, bestLevel: 0, totalKills: 0, runs: 0, wins: 0, bossKills: 0 },
    goals: [],
  };
}

/* ------------------------------------------------------------------ */
/* XP d'arme                                                           */
/* ------------------------------------------------------------------ */

/** XP pour passer du niveau `lvl` au suivant. */
export function weaponXpToNext(lvl: number): number {
  return 120 + 80 * (lvl - 1);
}

/** Niveau d'une arme selon son XP totale, et progression dans le niveau. */
export function weaponLevel(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let rest = Math.max(0, Math.floor(xp));
  while (level < WEAPON_MAX_LEVEL && rest >= weaponXpToNext(level)) {
    rest -= weaponXpToNext(level);
    level++;
  }
  return { level, into: level >= WEAPON_MAX_LEVEL ? 0 : rest, need: level >= WEAPON_MAX_LEVEL ? 0 : weaponXpToNext(level) };
}

/** Accessoires débloqués pour une arme à un niveau donné (un par niveau, à partir du niveau 2). */
export function unlockedAccessories(weapon: WeaponId, level: number): AccId[] {
  return WEAPONS[weapon].unlocks.slice(0, Math.max(0, level - 1));
}

/** Accessoire débloqué en atteignant `level` (ou null). */
export function accessoryAtLevel(weapon: WeaponId, level: number): AccId | null {
  return level >= 2 ? WEAPONS[weapon].unlocks[level - 2] ?? null : null;
}

export function weaponProgress(save: ZSave, w: WeaponId): WeaponProgress {
  return save.weapons[w] ?? { xp: 0, equipped: {} };
}

/** Équipe (ou retire si déjà équipé) un accessoire débloqué ; renvoie false s'il est verrouillé. */
export function toggleAccessory(save: ZSave, w: WeaponId, acc: AccId): boolean {
  const p = weaponProgress(save, w);
  if (!unlockedAccessories(w, weaponLevel(p.xp).level).includes(acc)) return false;
  const slot = ACCESSORIES[acc].slot;
  const equipped = { ...p.equipped };
  if (equipped[slot] === acc) delete equipped[slot];
  else equipped[slot] = acc;
  save.weapons[w] = { xp: p.xp, equipped };
  return true;
}

/** Accessoires équipés (valides) d'une arme. */
export function equippedAccessories(save: ZSave, w: WeaponId): AccId[] {
  const p = weaponProgress(save, w);
  const ok = unlockedAccessories(w, weaponLevel(p.xp).level);
  return Object.values(p.equipped).filter((a): a is AccId => !!a && ok.includes(a));
}

/* ------------------------------------------------------------------ */
/* Déblocages                                                          */
/* ------------------------------------------------------------------ */

export function weaponUnlocked(save: ZSave, w: WeaponId): boolean {
  return STARTER_WEAPONS.includes(w) || GOALS.some((g) => g.reward.weapon === w && save.goals.includes(g.id));
}

export function perkUnlocked(save: ZSave, p: PerkId): boolean {
  return STARTER_PERKS.includes(p) || GOALS.some((g) => g.reward.perk === p && save.goals.includes(g.id));
}

/* ------------------------------------------------------------------ */
/* Résultat d'une partie                                               */
/* ------------------------------------------------------------------ */

export interface RunResult {
  weapon: WeaponId;
  time: number;
  level: number;
  /** Kills par type, élites à part. */
  kills: Partial<Record<ZType, number>>;
  elites: number;
  won: boolean;
}

export function totalKills(r: RunResult): number {
  return Object.values(r.kills).reduce((s, n) => s + (n ?? 0), 0);
}

/** XP d'arme gagnée : kills pondérés, 15 par minute tenue, 150 pour une extraction. */
export function runWeaponXp(r: RunResult): number {
  let xp = 0;
  for (const [t, n] of Object.entries(r.kills)) xp += (n ?? 0) * ZOMBIES[t as ZType].weaponXp;
  xp += r.elites * ELITE.weaponXp;
  xp += Math.floor(r.time / 60) * 15;
  if (r.won) xp += 150;
  return Math.round(xp);
}

export interface RunReport {
  weaponXp: number;
  /** XP totale de l'arme avant la partie. */
  xpBefore: number;
  levelBefore: number;
  levelAfter: number;
  newAccessories: AccId[];
  newGoals: GoalId[];
  records: ('time' | 'kills' | 'level')[];
}

/** Objectifs remplis par une partie (et les totaux du compte). */
export function goalsReached(save: ZSave, r: RunResult): GoalId[] {
  const done: GoalId[] = [];
  const kills = totalKills(r);
  const check = (id: GoalId, ok: boolean) => ok && !save.goals.includes(id) && done.push(id);
  check('survive5', r.time >= 300);
  check('boss1', (r.kills.boss ?? 0) > 0 || save.records.bossKills > 0);
  check('kills1500', save.records.totalKills + kills >= 1500);
  check('level20', r.level >= 20);
  check('win1', r.won || r.time >= RUN_TIME);
  check('endless15', r.time >= 900);
  return done;
}

/** Applique le résultat d'une partie à la sauvegarde (en place) et renvoie le rapport. */
export function applyRun(save: ZSave, r: RunResult): RunReport {
  const p = weaponProgress(save, r.weapon);
  const before = weaponLevel(p.xp).level;
  const weaponXp = runWeaponXp(r);
  save.weapons[r.weapon] = { xp: p.xp + weaponXp, equipped: { ...p.equipped } };
  const after = weaponLevel(p.xp + weaponXp).level;
  const newAccessories: AccId[] = [];
  for (let l = before + 1; l <= after; l++) {
    const a = accessoryAtLevel(r.weapon, l);
    if (a) newAccessories.push(a);
  }
  const newGoals = goalsReached(save, r);
  save.goals.push(...newGoals);
  const kills = totalKills(r);
  const rec = save.records;
  const records: RunReport['records'] = [];
  if (r.time > rec.bestTime) {
    rec.bestTime = r.time;
    records.push('time');
  }
  if (kills > rec.bestKills) {
    rec.bestKills = kills;
    records.push('kills');
  }
  if (r.level > rec.bestLevel) {
    rec.bestLevel = r.level;
    records.push('level');
  }
  rec.totalKills += kills;
  rec.runs++;
  if (r.won) rec.wins++;
  rec.bossKills += r.kills.boss ?? 0;
  return { weaponXp, xpBefore: p.xp, levelBefore: before, levelAfter: after, newAccessories, newGoals, records };
}

/* ------------------------------------------------------------------ */
/* Stockage                                                            */
/* ------------------------------------------------------------------ */

function validClass(c: unknown): ZClass | null {
  if (!c || typeof c !== 'object') return null;
  const o = c as Partial<ZClass>;
  if (typeof o.name !== 'string' || !FIGS.includes(o.fig as FigId) || !(o.weapon && o.weapon in WEAPONS) || !(o.perk && o.perk in PERKS)) return null;
  return { name: o.name.slice(0, 16), fig: o.fig as FigId, weapon: o.weapon, perk: o.perk };
}

/** Relit une sauvegarde : tout champ illisible retombe sur sa valeur par défaut. */
export function parseSave(raw: string | null): ZSave {
  const d = defaultSave();
  if (!raw) return d;
  try {
    const o = JSON.parse(raw) as Partial<ZSave>;
    if (o.v !== 1) return d;
    const classes = Array.from({ length: CLASS_SLOTS }, (_, i) => (Array.isArray(o.classes) ? validClass(o.classes[i]) : d.classes[i]));
    const weapons: ZSave['weapons'] = {};
    for (const [w, p] of Object.entries(o.weapons ?? {})) {
      if (!(w in WEAPONS) || !p || typeof p.xp !== 'number') continue;
      const equipped: WeaponProgress['equipped'] = {};
      for (const [s, a] of Object.entries(p.equipped ?? {})) if (a && a in ACCESSORIES && ACCESSORIES[a as AccId].slot === s) equipped[s as SlotId] = a as AccId;
      weapons[w as WeaponId] = { xp: Math.max(0, p.xp), equipped };
    }
    const r = { ...d.records };
    for (const k of Object.keys(r) as (keyof Records)[]) if (typeof o.records?.[k] === 'number') r[k] = o.records[k];
    const goals = Array.isArray(o.goals) ? o.goals.filter((g) => GOALS.some((x) => x.id === g)) : [];
    const selected = typeof o.selected === 'number' && o.selected >= 0 && o.selected < CLASS_SLOTS ? o.selected : 0;
    return { v: 1, classes, selected, weapons, records: r, goals };
  } catch {
    return d;
  }
}

export function loadSave(): ZSave {
  try {
    return parseSave(globalThis.localStorage?.getItem(SAVE_KEY) ?? null);
  } catch {
    return defaultSave();
  }
}

export function storeSave(s: ZSave): void {
  try {
    globalThis.localStorage?.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* stockage plein ou indisponible : la partie continue sans sauvegarde */
  }
}

/** Noms de code proposés au créateur de classe. */
export const CALLSIGNS = [
  'Corbeau', 'Faucheuse', 'Brasier', 'Spectre', 'Rempart', 'Chacal', 'Marteau', 'Vautour', 'Givre', 'Crocs',
  'Sentinelle', 'Ferraille', 'Tonnerre', 'Fantôme', 'Bélier', 'Orage', 'Boucher', 'Silex', 'Lynx', 'Cendre',
];
