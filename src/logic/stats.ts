import { CATEGORY_NAMES, FAMILY_INFO, Family, ITEMS } from '../data/items';
import type { OperatorId } from '../data/operators';
import { RECIPES } from '../data/recipes';
import { ItemInst, maskOf, sharedEdge } from './grid';
import { TIER_NAMES, tierOf } from './tier';

export const FAMILY_TIERS = [2, 4];
export const FAMILY_ORDER: Family[] = ['rafale', 'precision', 'demolition', 'rempart', 'tactique'];

/** PV max de tous les combattants (joueur et bots) à un tour donné (0 = 1er cercle). */
export function maxHpFor(round: number): number {
  return 300 + 150 * round;
}

export interface WeaponRt {
  uid: number;
  name: string;
  dmg: number;
  interval: number;
  mag: number;
  reload: number;
  crit: number;
  /** Impacts par tir sur l'adversaire (plombs) : 2 = chaque tir touche deux fois. */
  pellets: number;
  firstCrit: boolean;
  /** Part des dégâts qui traverse l'armure (0..1). */
  armorPierce: number;
  /** Toutes les N balles, la balle touche deux fois (Rafale palier 4). 0 = jamais. */
  doubleEvery: number;
  /** Chargeurs du sac (uid) qui peuvent l'alimenter : adjacents et de son calibre. Chacun = une recharge. */
  magUids: number[];
  /** Recharges que donnent ces chargeurs (un gros calibre en donne 2). */
  magReloads: number;
  /** Recharges intégrées (armes assemblées à alimentation intégrée). */
  ownReloads: number;
  /** Coup de crosse, une fois à sec : dégâts et intervalle. */
  buttDmg: number;
  buttInterval: number;
  /** Un critique retarde les prochains tirs de l'adversaire (s). */
  critStun: number;
  /** Dégâts en plus à chaque touche, qui ignorent l'armure. */
  trueDmg: number;
  /** Feu continu (passif de Viper) : bonus de cadence gagné par seconde de tir sans recharger. */
  heatRate: number;
  /** Plafond du Feu continu (0 = pas de Feu continu). */
  heatCap: number;
  /** Bonus en plus quand cette arme consomme la Marque (munitions traçantes). */
  markBoost: number;
}

/** Arme de mêlée : frappe pendant tout le duel. */
export interface MeleeRt {
  uid: number;
  name: string;
  dmg: number;
  interval: number;
  bleed: number;
  armorPierce: number;
}

export interface ActiveRt {
  uid: number;
  kind: 'frag' | 'smoke' | 'heal' | 'flash' | 'adrenaline' | 'taser' | 'bandage';
  value: number;
  cooldown: number;
  charges: number;
  duration: number;
  threshold: number;
  /** Explosion qui ignore l'armure (Démolition palier 4, thermite). */
  ignoreArmor: boolean;
  /** Bandage : saignement retiré. */
  cure: number;
}

export interface FamilyState {
  family: Family;
  count: number;
  tier: number; // 0, 1 (palier 2) ou 2 (palier 4)
}

export interface PlayerLoadout {
  maxHp: number;
  armor: number;
  weapons: WeaponRt[];
  melee: MeleeRt[];
  /** Chargeurs posés (uid → utilisations par duel), partagés entre les armes qu'ils touchent. */
  mags: { uid: number; uses: number }[];
  actives: ActiveRt[];
  critMult: number;
  /** Armure régénérée par seconde (Rempart palier 4). */
  armorRegen: number;
  /** Chaque balle reçue perd ce nombre de dégâts (minimum 1). */
  flatReduce: number;
  /** Marque (passif de Sentinelle) : bonus de dégâts de la touche qui consomme la marque (0 = pas de Marque). */
  markBonus: number;
  families: FamilyState[];
}

export interface SynergyLink {
  a: number;
  b: number;
  label: string;
  edge: { cx: number; cy: number; dx: number; dy: number };
}

const pct = (v: number) => `${Math.round(v * 100)} %`;

/** Feu continu (Viper) : +5 % de cadence par seconde de tir sans recharger, au plus +30 %. */
export const FEU_RATE = 0.05;
export const FEU_CAP = 0.3;
/** Marque (Sentinelle) : la touche suivante d'une autre arme fait +50 %. */
export const MARK_BONUS = 0.5;
/** Précision palier 4 : chargeurs des armes de précision agrandis. */
export const PRECISION_MAG = 1.6;
/** Chargeur tambour : recharge plus lente de l'arme adjacente. */
export const DRUM_RELOAD = 0.4;

/** Recharges intégrées d'une arme à alimentation intégrée (objets assemblés). */
export const SELF_FED_RELOADS = 2;
/** Coup de crosse selon la classe d'arme : [dégâts, intervalle]. */
export const BUTT: Record<string, [number, number]> = {
  Pistolet: [4, 1.0], SMG: [4, 1.0], "Fusil d'assaut": [6, 1.2], 'Fusil à pompe': [6, 1.2], 'Fusil de précision': [7, 1.4],
};
/** Cadence de la mêlée quand toutes les armes à feu sont à sec. */
export const MELEE_DRY_SPEED = 1.5;

/** Familles du sac : nombre d'objets posés de chaque famille. */
export function familyStates(items: ItemInst[]): FamilyState[] {
  const counts = new Map<Family, number>();
  for (const it of items) {
    if (!it.placed) continue;
    const f = ITEMS[it.defId].family;
    counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  return FAMILY_ORDER.filter((f) => counts.has(f)).map((family) => {
    const count = counts.get(family)!;
    return { family, count, tier: FAMILY_TIERS.filter((t) => count >= t).length };
  });
}

/** Statistiques de combat d'un sac, pour un opérateur et des PV max donnés. */
export function computeLoadout(items: ItemInst[], operator: OperatorId, maxHp: number): { loadout: PlayerLoadout; links: SynergyLink[] } {
  const placed = items.filter((i) => i.placed);
  const families = familyStates(items);
  const tier = (f: Family) => families.find((s) => s.family === f)?.tier ?? 0;
  const links: SynergyLink[] = [];
  const weapons: WeaponRt[] = [];
  const melee: MeleeRt[] = [];
  const mags: { uid: number; uses: number }[] = [];
  const actives: ActiveRt[] = [];
  let armor = 0;
  let flatReduce = 0;

  for (const it of placed) {
    const d = ITEMS[it.defId];

    if (d.weapon) {
      let interval = d.weapon.interval;
      if (d.family === 'rafale' && tier('rafale') >= 1) interval /= 1.15;
      let reload = d.weapon.reload;
      let crit = 0.05 + (d.weapon.critBonus ?? 0) + (tier('precision') >= 1 ? 0.1 : 0);
      // Feu continu, passif de Viper : plafond relevé par l'arme elle-même, montée accélérée par un refroidisseur adjacent.
      let heatCap = operator === 'viper' ? FEU_CAP + (d.weapon.heatBonus ?? 0) : 0;
      let cooler = 0;
      let markBoost = d.weapon.markBoost ?? 0;
      let drum = 0;
      let firstCrit = !!d.weapon.firstCrit;
      let magBonus = 0;
      let magCount = 0;
      const magUids: number[] = [];
      let magReloads = 0;
      let butt = 1;
      let armorPierce = d.weapon.armorPierce ?? 0;
      let dmgMult = 1;
      let grip = 0;
      let extMag = 0;
      for (const o of placed) {
        if (o === it) continue;
        const od = ITEMS[o.defId];
        if (!od.synergy) continue;
        const edge = sharedEdge(o, it);
        if (!edge) continue;
        if (od.synergy.kind === 'mag' && (od.caliber === d.caliber || d.weapon.feedsAny)) {
          magUids.push(o.uid);
          magReloads += od.reloads ?? 1;
          if (magCount < 3) {
            magCount++;
            magBonus += od.synergy.value;
          }
          links.push({ a: o.uid, b: it.uid, label: `+${od.reloads ?? 1} chargeur${(od.reloads ?? 1) > 1 ? 's' : ''}, −${pct(od.synergy.value)} de recharge`, edge });
        } else if (od.synergy.kind === 'butt') {
          butt = Math.max(butt, 1 + od.synergy.value);
          links.push({ a: o.uid, b: it.uid, label: `crosse ×${1 + od.synergy.value}`, edge });
        } else if (od.synergy.kind === 'scope' && d.tags.includes('arme_longue')) {
          crit += od.synergy.value;
          links.push({ a: o.uid, b: it.uid, label: `+${pct(od.synergy.value)} de critique`, edge });
        } else if (od.synergy.kind === 'silencer') {
          firstCrit = true;
          links.push({ a: o.uid, b: it.uid, label: '1er tir critique', edge });
        } else if (od.synergy.kind === 'grip') {
          grip = Math.max(grip, od.synergy.value);
          links.push({ a: o.uid, b: it.uid, label: `+${pct(od.synergy.value)} de cadence`, edge });
        } else if (od.synergy.kind === 'extmag') {
          extMag = Math.max(extMag, od.synergy.value);
          links.push({ a: o.uid, b: it.uid, label: `chargeur +${pct(od.synergy.value)}`, edge });
        } else if (od.synergy.kind === 'holo' && !d.tags.includes('arme_longue')) {
          crit += od.synergy.value;
          links.push({ a: o.uid, b: it.uid, label: `+${pct(od.synergy.value)} de critique`, edge });
        } else if (od.synergy.kind === 'bipod' && d.tags.includes('arme_longue')) {
          dmgMult = Math.max(dmgMult, 1 + od.synergy.value);
          links.push({ a: o.uid, b: it.uid, label: `+${pct(od.synergy.value)} de dégâts`, edge });
        } else if (od.synergy.kind === 'drum') {
          drum = Math.max(drum, od.synergy.value);
          links.push({ a: o.uid, b: it.uid, label: `chargeur +${pct(od.synergy.value)}, recharge +${pct(DRUM_RELOAD)}`, edge });
        } else if (od.synergy.kind === 'cooler') {
          cooler = Math.max(cooler, od.synergy.value);
          links.push({ a: o.uid, b: it.uid, label: `Feu continu +${pct(od.synergy.value)} plus rapide`, edge });
        } else if (od.synergy.kind === 'tracer') {
          markBoost = Math.max(markBoost, od.synergy.value);
          links.push({ a: o.uid, b: it.uid, label: `Marque +${pct(od.synergy.value)}`, edge });
        } else if (od.synergy.kind === 'pierce') {
          armorPierce = Math.max(armorPierce, Math.min(1, od.synergy.value));
          links.push({ a: o.uid, b: it.uid, label: `perce ${pct(Math.min(1, od.synergy.value))} d'armure`, edge });
        }
      }
      if (d.wclass === 'Fusil à pompe' && tier('demolition') >= 2) armorPierce = 1;
      reload *= Math.max(0.3, 1 - magBonus);
      const [bd, bi] = BUTT[d.wclass ?? 'Pistolet'] ?? BUTT.Pistolet;
      if (drum > 0) reload *= 1 + DRUM_RELOAD;
      interval /= 1 + grip;
      weapons.push({
        uid: it.uid,
        name: d.name,
        dmg: d.weapon.dmg * dmgMult,
        interval,
        mag: Math.round(d.weapon.mag * (1 + extMag) * (1 + drum) * (d.family === 'precision' && tier('precision') >= 2 ? PRECISION_MAG : 1)),
        reload,
        crit: Math.min(crit, 0.9),
        pellets: d.weapon.targets ?? 1,
        firstCrit,
        armorPierce,
        doubleEvery: d.family === 'rafale' && tier('rafale') >= 2 ? 3 : 0,
        magUids,
        magReloads,
        ownReloads: d.weapon.selfFed ? SELF_FED_RELOADS : 0,
        buttDmg: bd * butt,
        buttInterval: bi,
        critStun: d.weapon.critStun ?? 0,
        trueDmg: d.weapon.trueDmg ?? 0,
        heatRate: FEU_RATE * (1 + cooler),
        heatCap,
        markBoost,
      });
    }

    if (d.melee) {
      melee.push({ uid: it.uid, name: d.name, dmg: d.melee.dmg, interval: d.melee.interval, bleed: d.melee.bleed ?? 0, armorPierce: d.melee.armorPierce ?? 0 });
    }
    if (d.synergy?.kind === 'mag') mags.push({ uid: it.uid, uses: d.reloads ?? 1 });

    if (d.armor) {
      armor += d.armor;
      flatReduce += d.flatReduce ?? 0;
    }

    if (d.active) {
      const cd = d.active.cooldown;
      const kind = d.active.kind;
      let duration = d.active.duration ?? 0;
      if (kind === 'smoke' && tier('tactique') >= 1) duration *= 1.5;
      const explosive = d.category === 'explosif';
      actives.push({
        uid: it.uid,
        kind,
        value: d.active.value,
        cooldown: cd,
        charges: d.active.charges + (explosive && tier('demolition') >= 1 ? 1 : 0),
        duration,
        threshold: d.active.threshold ?? 0.5,
        ignoreArmor: kind === 'frag' && (tier('demolition') >= 2 || !!d.active.pierce),
        cure: d.active.cure ?? 0,
      });
    }
  }

  if (tier('rempart') >= 1) armor *= 1.2;

  return {
    loadout: {
      maxHp,
      armor: Math.round(armor),
      weapons,
      melee,
      mags,
      actives,
      critMult: tier('precision') >= 2 ? 2.25 : 2,
      armorRegen: tier('rempart') >= 2 ? 2 : 0,
      flatReduce,
      markBonus: operator === 'sentinelle' ? MARK_BONUS : 0,
      families,
    },
    links,
  };
}

/** Estimation grossière des dégâts par seconde, pour l'écran de préparation. */
/** Fenêtre (s) sur laquelle le DPS estimé est moyenné : la durée d'un duel ordinaire. */
export const DPS_WINDOW = 20;

/**
 * DPS moyen sur un duel de DPS_WINDOW secondes, munitions comprises : chaque arme vide ses chargeurs
 * (le sien, les intégrés, les adjacents), puis frappe à la crosse. La mêlée frappe tout du long.
 */
export function estimateDps(l: PlayerLoadout): number {
  let dmg = 0;
  let allDryAt = 0;
  for (const w of l.weapons) {
    // Feu continu : bonus moyen de cadence sur un chargeur (montée linéaire jusqu'au plafond).
    const burst = w.mag * w.interval;
    const ramp = w.heatRate > 0 ? w.heatCap / w.heatRate : 0;
    const heat = w.heatCap <= 0 ? 0 : burst <= ramp ? (w.heatRate * burst) / 2 : w.heatCap - (w.heatCap * ramp) / (2 * burst);
    const hits = w.pellets * (1 + (w.doubleEvery > 0 ? 1 / w.doubleEvery : 0));
    const perMag = (w.dmg * (1 + w.crit * (l.critMult - 1)) + w.trueDmg) * 0.85 * w.mag * hits;
    const fire = burst / (1 + heat);
    const mags = magsOf(w);
    // Temps pour vider tous ses chargeurs (recharges comprises), borné par la fenêtre.
    const emptyAt = mags * fire + (mags - 1) * w.reload;
    if (emptyAt >= DPS_WINDOW) {
      dmg += (perMag * DPS_WINDOW) / (fire + w.reload);
      allDryAt = DPS_WINDOW;
    } else {
      dmg += perMag * mags + (w.buttDmg / w.buttInterval) * (DPS_WINDOW - emptyAt);
      allDryAt = Math.max(allDryAt, emptyAt);
    }
  }
  if (!l.weapons.length) allDryAt = 0;
  for (const m of l.melee) {
    const rate = (m.dmg + m.bleed) / m.interval;
    dmg += rate * allDryAt + rate * MELEE_DRY_SPEED * (DPS_WINDOW - allDryAt);
  }
  return dmg / DPS_WINDOW;
}

/** Chargeurs pleins d'une arme pour un duel : le sien + recharges intégrées + chargeurs adjacents (partagés). */
export function magsOf(w: WeaponRt): number {
  return 1 + w.ownReloads + w.magReloads;
}

export function itemPrice(defId: string): number {
  return ITEMS[defId].price;
}

export function sellValue(inst: Pick<ItemInst, 'defId'>): number {
  return Math.max(1, Math.floor(itemPrice(inst.defId) * 0.5));
}

const r1 = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');
const cellCount = (defId: string) => maskOf(defId, 0).flat().filter(Boolean).length;

/** Fiche d'un objet. */
export function describe(inst: Pick<ItemInst, 'defId'>): { title: string; subtitle: string; lines: string[] } {
  const d = ITEMS[inst.defId];
  const lines: string[] = [];
  const cal = d.caliber ? ` · ${d.caliber}` : '';
  const sub = `${TIER_NAMES[tierOf(inst.defId)]} · ${d.wclass ?? CATEGORY_NAMES[d.category]}${cal}`;

  if (d.weapon) {
    const wp = d.weapon;
    lines.push(`Dégâts ${r1(wp.dmg)} toutes les ${r1(wp.interval)} s`);
    lines.push(`Chargeur ${wp.mag} balles · recharge ${r1(wp.reload)} s`);
    if (wp.selfFed) lines.push(`Alimentation intégrée : ${SELF_FED_RELOADS} chargeurs de plus par duel`);
    else if (wp.feedsAny) lines.push("Munitions : son chargeur, +1 par chargeur adjacent (tout calibre). À sec : crosse");
    else lines.push(`Munitions : son chargeur, +1 par chargeur ${d.caliber} adjacent. À sec : crosse`);
    if (wp.firstCrit) lines.push('Son 1er tir est toujours critique');
    if (wp.armorPierce) lines.push(`Ignore ${pct(wp.armorPierce)} de l'armure`);
    if (wp.critStun) lines.push(`Ses critiques retardent les tirs adverses de ${r1(wp.critStun)} s`);
    if (wp.trueDmg) lines.push(`Incendiaire : +${Math.round(wp.trueDmg)} dégâts qui ignorent l'armure`);
    if (wp.targets && wp.targets > 1) lines.push(`Plombs : chaque tir touche ${wp.targets} fois`);
    if (wp.critBonus) lines.push(`+${pct(wp.critBonus)} de critique`);
    if (wp.heatBonus) lines.push(`Viper : Feu continu jusqu'à +${pct(FEU_CAP + wp.heatBonus)} au lieu de +${pct(FEU_CAP)}`);
    if (wp.markBoost) lines.push(`Sentinelle : quand elle consomme la Marque, +${pct(wp.markBoost)} de dégâts en plus`);
  }
  if (d.melee) {
    const ml = d.melee;
    lines.push(`Mêlée : ${r1(ml.dmg)} dégâts toutes les ${r1(ml.interval)} s, pendant tout le duel`);
    if (ml.bleed) lines.push(`Saignement +${ml.bleed} par coup (ignore l'armure)`);
    if (ml.armorPierce) lines.push(`Ignore ${pct(ml.armorPierce)} de l'armure`);
    lines.push(`Frappe ${MELEE_DRY_SPEED} fois plus vite quand tes armes à feu sont à sec`);
  }
  if (d.armor) {
    lines.push(`Armure +${d.armor}`);
    if (d.flatReduce) lines.push(`Chaque balle reçue perd ${d.flatReduce} dégâts`);
  }
  if (d.active) {
    const a = d.active;
    const cd = r1(a.cooldown);
    const ch = a.charges;
    if (a.kind === 'frag') lines.push(`${Math.round(a.value)} dégâts à l'adversaire${a.pierce ? ", ignore l'armure" : ''}`);
    if (a.kind === 'smoke') lines.push(`Précision adverse −50 % pendant ${r1(a.duration ?? 0)} s`);
    if (a.kind === 'heal') lines.push(`Soigne ${Math.round(a.value)} PV quand les PV passent sous 50 %`);
    if (a.kind === 'flash') lines.push(`Étourdit les armes adverses ${r1(a.value)} s`);
    if (a.kind === 'adrenaline') lines.push(`+${pct(a.value)} de cadence pendant ${r1(a.duration ?? 0)} s sous 30 % PV`);
    if (a.kind === 'taser') lines.push(`${a.value} dégâts, immobilise l'adversaire ${r1(a.duration ?? 0)} s (quand il recharge, sinon à 6 s)`);
    if (a.kind === 'bandage') lines.push(`Retire ${a.cure} de saignement et soigne ${a.value} PV (saignement ≥ 8 ou PV sous 50 %)`);
    lines.push(`${ch} charge${ch > 1 ? 's' : ''} par combat · délai ${cd} s`);
  }
  if (d.synergy) {
    const v = pct(d.synergy.value);
    if (d.synergy.kind === 'mag') lines.push(`Adjacent à une arme ${d.caliber} : ${(d.reloads ?? 1) > 1 ? `${d.reloads} recharges` : 'une recharge'} de plus par duel, et −${v} de temps de recharge (max 3)`);
    if (d.synergy.kind === 'butt') lines.push('Adjacent à une arme : ses coups de crosse font 2 fois plus mal');
    if (d.synergy.kind === 'scope') lines.push(`Adjacent à une arme longue : +${v} de critique`);
    if (d.synergy.kind === 'silencer') lines.push('Adjacent à une arme : son 1er tir est critique');
    if (d.synergy.kind === 'pierce') lines.push(`Adjacent à une arme : perce ${v} de l'armure`);
    if (d.synergy.kind === 'grip') lines.push(`Adjacent à une arme : +${v} de cadence`);
    if (d.synergy.kind === 'extmag') lines.push(`Adjacent à une arme : chargeur +${v}`);
    if (d.synergy.kind === 'holo') lines.push(`Adjacent à une arme courte : +${v} de critique`);
    if (d.synergy.kind === 'bipod') lines.push(`Adjacent à une arme longue : +${v} de dégâts`);
    if (d.synergy.kind === 'drum') lines.push(`Adjacent à une arme : chargeur +${v}, recharge +${pct(DRUM_RELOAD)} (nourrit le Feu continu)`);
    if (d.synergy.kind === 'cooler') lines.push(`Adjacent à une arme : son Feu continu monte ${v} plus vite (passif de Viper)`);
    if (d.synergy.kind === 'tracer') lines.push(`Adjacent à une arme : quand elle consomme la Marque, +${v} de dégâts en plus (passif de Sentinelle)`);
  }
  if (d.crafted) lines.push('Objet assemblé (recette)');
  for (const r of RECIPES.filter((rc) => rc.inputs.includes(d.id))) {
    const label = `${r.inputs.map((id) => ITEMS[id].short).join(' + ')} → ${ITEMS[r.output].name}`;
    lines.push(`Recette : ${label} (ingrédients adjacents : assemblage automatique)`);
  }
  const f = FAMILY_INFO[d.family];
  lines.push(`Famille ${f.name} : 2 → ${f.tier2.toLowerCase()} · 4 → ${f.tier4.toLowerCase()}`);
  const n = cellCount(inst.defId);
  lines.push(`${n} case${n > 1 ? 's' : ''} · revente ${sellValue(inst)} cr`);
  return { title: d.name, subtitle: sub, lines };
}
