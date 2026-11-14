// Mode Zombie : statistiques du soldat en partie, calculées depuis la classe, l'arme (niveau + accessoires),
// les power-ups pris et les évolutions. Logique pure.
import { ACCESSORIES, AccId, EvoId, PERKS, PLAYER, PerkId, PowerId, WEAPONS, WEAPON_DMG_PER_LEVEL, WeaponId } from './data';

export type Levels = Partial<Record<PowerId, number>>;

export interface Loadout {
  weapon: WeaponId;
  weaponLevel: number;
  accessories: AccId[];
  perk: PerkId;
}

export interface Stats {
  // Arme
  dmg: number;
  rate: number;
  pellets: number;
  spread: number;
  bulletSpeed: number;
  range: number;
  pierce: number;
  mag: number;
  reload: number;
  crit: number;
  critMul: number;
  knock: number;
  bounces: number;
  /** Brûlure : part des dégâts de la balle infligée par seconde, pendant 3 s. */
  burn: number;
  /** Explosion à l'impact : part des dégâts, et rayon (0 = pas d'explosion). */
  explode: number;
  explodeR: number;
  shockChance: number;
  shockN: number;
  // Soldat
  maxHp: number;
  regen: number;
  move: number;
  pickup: number;
  /** Multiplicateur des dégâts subis. */
  taken: number;
  /** Multiplicateurs de toutes les explosions (atout Artificier). */
  blastR: number;
  blastDmg: number;
  /** Multiplicateur général des dégâts des soutiens (Gros calibre). */
  allDmg: number;
  healMul: number;
  choices: number;
  rerolls: number;
  // Soutiens (niveau 0 = absent)
  grenades: number;
  grenadeCd: number;
  drone: number;
  mines: number;
  lames: number;
  tourelle: number;
  artillerie: number;
  evos: Set<EvoId>;
}

export function computeStats(lo: Loadout, levels: Levels, evos: ReadonlySet<EvoId> = new Set()): Stats {
  const w = WEAPONS[lo.weapon];
  const L = (id: PowerId) => levels[id] ?? 0;
  // Somme des bonus d'accessoires
  const acc = { dmg: 0, rate: 0, range: 0, spread: 0, crit: 0, mag: 0, reload: 0, speed: 0, move: 0, pierce: 0, burn: 0, shock: 0 };
  for (const a of lo.accessories) for (const [k, v] of Object.entries(ACCESSORIES[a].mods)) acc[k as keyof typeof acc] += v as number;
  const perk = lo.perk;
  const shotgun = w.pellets > 1;
  const allDmg = 1 + 0.15 * L('degats');
  const dmg = w.dmg * (1 + WEAPON_DMG_PER_LEVEL * (lo.weaponLevel - 1)) * (1 + acc.dmg) * allDmg;
  const s: Stats = {
    dmg,
    rate: w.rate * (1 + acc.rate) * (1 + 0.12 * L('cadence')),
    pellets: w.pellets + (shotgun ? 2 : 1) * L('multitir'),
    spread: Math.max(0, w.spread * (1 + acc.spread)),
    bulletSpeed: w.speed * (1 + acc.speed),
    range: w.range * (1 + acc.range) * (perk === 'tireur' ? 1.2 : 1),
    pierce: w.pierce + acc.pierce + L('perforation'),
    mag: Math.max(1, Math.round(w.mag * (1 + acc.mag) * (1 + 0.15 * L('recharge')))),
    reload: w.reload * (1 + acc.reload) * Math.pow(0.88, L('recharge')),
    crit: w.crit + acc.crit + 0.06 * L('critique') + (perk === 'tireur' ? 0.12 : 0),
    critMul: 2 + 0.1 * L('critique'),
    knock: w.knock,
    bounces: L('ricochet'),
    burn: acc.burn + (L('incendiaire') ? 0.2 + 0.1 * L('incendiaire') : 0),
    explode: L('explosif') ? 0.2 + 0.1 * L('explosif') : 0,
    explodeR: L('explosif') ? 40 + 10 * L('explosif') : 0,
    shockChance: acc.shock + (L('electrique') ? 0.08 + 0.06 * L('electrique') : 0),
    shockN: 2 + Math.floor(L('electrique') / 2),
    maxHp: PLAYER.hp + 20 * L('pv') + (perk === 'colosse' ? 40 : 0),
    regen: 0.4 * L('regen') + (perk === 'medecin' ? 0.6 : 0),
    move: PLAYER.speed * w.move * (1 + acc.move) * (1 + 0.08 * L('vitesse')) * (perk === 'eclaireur' ? 1.15 : perk === 'colosse' ? 0.92 : 1),
    pickup: PLAYER.pickup * (1 + 0.35 * L('aimant')) * (perk === 'eclaireur' ? 1.4 : 1),
    taken: Math.pow(0.93, L('armure')) * (perk === 'colosse' ? 0.9 : 1),
    blastR: perk === 'artificier' ? 1.3 : 1,
    blastDmg: perk === 'artificier' ? 1.2 : 1,
    allDmg,
    healMul: perk === 'medecin' ? 1.5 : 1,
    choices: perk === 'veinard' ? 4 : 3,
    rerolls: perk === 'veinard' ? 2 : 1,
    grenades: L('grenades'),
    grenadeCd: Math.max(1.2, (3.5 - 0.35 * (L('grenades') - 1)) * (perk === 'sapeur' ? 0.75 : 1)),
    drone: L('drone'),
    mines: L('mines'),
    lames: L('lames'),
    tourelle: L('tourelle'),
    artillerie: L('artillerie'),
    evos: new Set(evos),
  };
  if (evos.has('napalm')) s.burn *= 1.5;
  if (evos.has('seconde_vie')) s.regen *= 2;
  return s;
}

/** Résumé lisible d'une arme équipée (arsenal, créateur de classe). */
export function weaponSummary(weapon: WeaponId, weaponLevel: number, accessories: AccId[]) {
  const s = computeStats({ weapon, weaponLevel, accessories, perk: 'medecin' }, {});
  return {
    dps: (s.dmg * s.pellets * s.rate * (1 + s.crit * (s.critMul - 1)) * s.mag) / (s.mag + s.rate * s.reload),
    dmg: s.dmg,
    rate: s.rate,
    range: s.range,
    mag: s.mag,
    reload: s.reload,
    pierce: s.pierce,
    crit: s.crit,
    pellets: s.pellets,
  };
}

export const PERK_NAME = (p: PerkId) => PERKS[p].name;
