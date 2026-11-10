import { CATEGORY_NAMES, FAMILY_INFO, Family, ITEMS } from '../data/items';
import type { OperatorId } from '../data/operators';
import { RECIPES } from '../data/recipes';
import { ItemInst, maskOf, sharedEdge } from './grid';
import { EFFECT_MULT, EXTRA_CHARGES, MAG_MULT, MAX_RARITY, PRICE_MULT, RARITY_NAMES, RECHARGE_MULT } from './rarity';

export const FAMILY_TIERS = [2, 4];
export const FAMILY_ORDER: Family[] = ['rafale', 'precision', 'demolition', 'rempart', 'tactique'];

/** PV max de tous les combattants (joueur et bots) à un tour donné (0 = 1er cercle). */
export function maxHpFor(round: number): number {
  return 100 + 20 * round;
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
  /** Toutes les N balles, la balle ignore l'armure (trait Légendaire). 0 = jamais. */
  pierceEvery: number;
  /** Part des dégâts qui traverse l'armure (0..1). */
  armorPierce: number;
  /** Toutes les N balles, la balle touche deux fois (Rafale palier 4). 0 = jamais. */
  doubleEvery: number;
  /** Un chargeur de son calibre la touche ; sinon la recharge est 2 fois plus lente. */
  fed: boolean;
  /** Un critique retarde les prochains tirs de l'adversaire (s). */
  critStun: number;
  /** Dégâts en plus à chaque touche, qui ignorent l'armure. */
  trueDmg: number;
}

export interface ActiveRt {
  uid: number;
  kind: 'frag' | 'smoke' | 'heal' | 'flash' | 'adrenaline';
  value: number;
  cooldown: number;
  charges: number;
  duration: number;
  threshold: number;
  /** Explosion qui ignore l'armure (Démolition palier 4, thermite). */
  ignoreArmor: boolean;
}

export interface FamilyState {
  family: Family;
  count: number;
  tier: number; // 0, 1 (palier 2) ou 2 (palier 4)
}

export interface PlayerLoadout {
  maxHp: number;
  armor: number;
  reflect: number;
  weapons: WeaponRt[];
  actives: ActiveRt[];
  critMult: number;
  /** Armure régénérée par seconde (Rempart palier 4). */
  armorRegen: number;
  /** Chaque balle reçue perd ce nombre de dégâts (minimum 1). */
  flatReduce: number;
  families: FamilyState[];
}

export interface SynergyLink {
  a: number;
  b: number;
  label: string;
  edge: { cx: number; cy: number; dx: number; dy: number };
}

const pct = (v: number) => `${Math.round(v * 100)} %`;

/** Multiplicateur de recharge d'une arme qu'aucun chargeur de son calibre ne touche. */
export const UNFED_RELOAD = 2;

/** Familles du sac : un objet Légendaire compte pour 2. */
export function familyStates(items: ItemInst[]): FamilyState[] {
  const counts = new Map<Family, number>();
  for (const it of items) {
    if (!it.placed) continue;
    const f = ITEMS[it.defId].family;
    counts.set(f, (counts.get(f) ?? 0) + (it.rarity === MAX_RARITY ? 2 : 1));
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
  const actives: ActiveRt[] = [];
  let armor = 0;
  let reflect = 0;
  let flatReduce = 0;

  for (const it of placed) {
    const d = ITEMS[it.defId];
    const m = EFFECT_MULT[it.rarity];

    if (d.weapon) {
      let interval = d.weapon.interval;
      if (operator === 'viper' && d.caliber === '5.56') interval /= 1.1; // passif de Viper
      if (d.family === 'rafale' && tier('rafale') >= 1) interval /= 1.15;
      let reload = d.weapon.reload * RECHARGE_MULT[it.rarity];
      let crit = 0.05 + (tier('precision') >= 1 ? 0.1 : 0) + (operator === 'sentinelle' ? 0.1 : 0); // passif de Sentinelle
      let firstCrit = !!d.weapon.firstCrit;
      let magBonus = 0;
      let magCount = 0;
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
        const om = EFFECT_MULT[o.rarity];
        if (od.synergy.kind === 'mag' && (od.caliber === d.caliber || d.weapon.feedsAny) && magCount < 3) {
          magCount++;
          magBonus += od.synergy.value * om;
          links.push({ a: o.uid, b: it.uid, label: `−${pct(od.synergy.value * om)} de recharge`, edge });
        } else if (od.synergy.kind === 'scope' && d.tags.includes('arme_longue')) {
          crit += od.synergy.value * om;
          links.push({ a: o.uid, b: it.uid, label: `+${pct(od.synergy.value * om)} de critique`, edge });
        } else if (od.synergy.kind === 'silencer') {
          firstCrit = true;
          links.push({ a: o.uid, b: it.uid, label: '1er tir critique', edge });
        } else if (od.synergy.kind === 'grip') {
          grip = Math.max(grip, od.synergy.value * om);
          links.push({ a: o.uid, b: it.uid, label: `+${pct(od.synergy.value * om)} de cadence`, edge });
        } else if (od.synergy.kind === 'extmag') {
          extMag = Math.max(extMag, od.synergy.value * om);
          links.push({ a: o.uid, b: it.uid, label: `chargeur +${pct(od.synergy.value * om)}`, edge });
        } else if (od.synergy.kind === 'holo' && !d.tags.includes('arme_longue')) {
          crit += od.synergy.value * om;
          links.push({ a: o.uid, b: it.uid, label: `+${pct(od.synergy.value * om)} de critique`, edge });
        } else if (od.synergy.kind === 'bipod' && d.tags.includes('arme_longue')) {
          dmgMult = Math.max(dmgMult, 1 + od.synergy.value * om);
          links.push({ a: o.uid, b: it.uid, label: `+${pct(od.synergy.value * om)} de dégâts`, edge });
        } else if (od.synergy.kind === 'pierce') {
          armorPierce = Math.max(armorPierce, Math.min(1, od.synergy.value * om));
          links.push({ a: o.uid, b: it.uid, label: `perce ${pct(Math.min(1, od.synergy.value * om))} d'armure`, edge });
        }
      }
      if (d.wclass === 'Fusil à pompe' && tier('demolition') >= 2) armorPierce = 1;
      const fed = magCount > 0 || !!d.weapon.selfFed;
      reload *= fed ? Math.max(0.3, 1 - magBonus) : UNFED_RELOAD;
      interval /= 1 + grip;
      weapons.push({
        uid: it.uid,
        name: d.name,
        dmg: d.weapon.dmg * m * dmgMult,
        interval,
        mag: Math.round(d.weapon.mag * MAG_MULT[it.rarity] * (1 + extMag)),
        reload,
        crit: Math.min(crit, 0.9),
        pellets: d.weapon.targets ?? 1,
        firstCrit,
        pierceEvery: it.rarity === MAX_RARITY ? 5 : 0,
        armorPierce,
        doubleEvery: d.family === 'rafale' && tier('rafale') >= 2 ? 8 : 0,
        fed,
        critStun: d.weapon.critStun ?? 0,
        trueDmg: (d.weapon.trueDmg ?? 0) * m,
      });
    }

    if (d.armor) {
      armor += d.armor * m;
      flatReduce += d.flatReduce ?? 0;
      if (it.rarity === MAX_RARITY && d.id === 'plaque') reflect += 0.1;
    }

    if (d.active) {
      const cd = d.active.cooldown * RECHARGE_MULT[it.rarity];
      const kind = d.active.kind;
      const flat = kind === 'smoke' || kind === 'adrenaline';
      let duration = (d.active.duration ?? 0) * (kind === 'smoke' ? m : 1);
      if (kind === 'smoke' && tier('tactique') >= 1) duration *= 1.5;
      const explosive = d.category === 'explosif';
      actives.push({
        uid: it.uid,
        kind,
        value: flat ? d.active.value : d.active.value * m,
        cooldown: cd,
        charges: d.active.charges + EXTRA_CHARGES[it.rarity] + (explosive && tier('demolition') >= 1 ? 1 : 0),
        duration,
        threshold: d.active.threshold ?? 0.5,
        ignoreArmor: kind === 'frag' && (tier('demolition') >= 2 || !!d.active.pierce),
      });
    }
  }

  if (tier('rempart') >= 1) armor *= 1.2;

  return {
    loadout: {
      maxHp,
      armor: Math.round(armor),
      reflect,
      weapons,
      actives,
      critMult: tier('precision') >= 2 ? 2.5 : 2,
      armorRegen: tier('rempart') >= 2 ? 2 : 0,
      flatReduce,
      families,
    },
    links,
  };
}

/** Estimation grossière des dégâts par seconde, pour l'écran de préparation. */
export function estimateDps(l: PlayerLoadout): number {
  let dps = 0;
  for (const w of l.weapons) {
    const cycle = w.mag * w.interval + w.reload;
    const hits = w.pellets * (1 + (w.doubleEvery > 0 ? 1 / w.doubleEvery : 0));
    dps += ((w.dmg * (1 + w.crit * (l.critMult - 1)) + w.trueDmg) * 0.85 * w.mag * hits) / cycle;
  }
  return dps;
}

export function itemPrice(defId: string, rarity: number): number {
  return Math.round(ITEMS[defId].price * PRICE_MULT[rarity]);
}

export function sellValue(inst: ItemInst): number {
  return Math.max(1, Math.floor(itemPrice(inst.defId, inst.rarity) * 0.5));
}

const r1 = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');
const cellCount = (defId: string) => maskOf(defId, 0).flat().filter(Boolean).length;

/** Fiche d'un objet, valeurs ajustées à sa rareté. */
export function describe(inst: ItemInst): { title: string; subtitle: string; lines: string[] } {
  const d = ITEMS[inst.defId];
  const m = EFFECT_MULT[inst.rarity];
  const lines: string[] = [];
  const cal = d.caliber ? ` · ${d.caliber}` : '';
  const sub = `${RARITY_NAMES[inst.rarity]} · ${d.wclass ?? CATEGORY_NAMES[d.category]}${cal}`;

  if (d.weapon) {
    const wp = d.weapon;
    lines.push(`Dégâts ${r1(wp.dmg * m)} toutes les ${r1(wp.interval)} s`);
    lines.push(`Chargeur ${Math.round(wp.mag * MAG_MULT[inst.rarity])} · recharge ${r1(wp.reload * RECHARGE_MULT[inst.rarity])} s`);
    if (wp.selfFed) lines.push('Alimentation intégrée : jamais à sec');
    else if (wp.feedsAny) lines.push(`Alimentation : n'importe quel chargeur adjacent, sinon recharge ×${UNFED_RELOAD}`);
    else lines.push(`Alimentation : un chargeur ${d.caliber} adjacent, sinon recharge ×${UNFED_RELOAD}`);
    if (wp.firstCrit) lines.push('Son 1er tir est toujours critique');
    if (wp.armorPierce) lines.push(`Ignore ${pct(wp.armorPierce)} de l'armure`);
    if (wp.critStun) lines.push(`Ses critiques retardent les tirs adverses de ${r1(wp.critStun)} s`);
    if (wp.trueDmg) lines.push(`Incendiaire : +${Math.round(wp.trueDmg * m)} dégâts qui ignorent l'armure`);
    if (wp.targets && wp.targets > 1) lines.push(`Plombs : chaque tir touche ${wp.targets} fois`);
    if (inst.rarity === MAX_RARITY) lines.push("Trait légendaire : 1 balle sur 5 ignore l'armure");
  }
  if (d.armor) {
    lines.push(`Armure +${Math.round(d.armor * m)}`);
    if (inst.rarity === MAX_RARITY && d.id === 'plaque') lines.push('Trait légendaire : renvoie 10 % des dégâts bloqués');
    if (d.flatReduce) lines.push(`Chaque balle reçue perd ${d.flatReduce} dégâts`);
  }
  if (d.active) {
    const a = d.active;
    const cd = r1(a.cooldown * RECHARGE_MULT[inst.rarity]);
    const ch = a.charges + EXTRA_CHARGES[inst.rarity];
    if (a.kind === 'frag') lines.push(`${Math.round(a.value * m)} dégâts à l'adversaire${a.pierce ? ", ignore l'armure" : ''}`);
    if (a.kind === 'smoke') lines.push(`Précision adverse −50 % pendant ${r1((a.duration ?? 0) * m)} s`);
    if (a.kind === 'heal') lines.push(`Soigne ${Math.round(a.value * m)} PV quand les PV passent sous 50 %`);
    if (a.kind === 'flash') lines.push(`Étourdit les armes adverses ${r1(a.value * m)} s`);
    if (a.kind === 'adrenaline') lines.push(`+${pct(a.value)} de cadence pendant ${r1(a.duration ?? 0)} s sous 30 % PV`);
    lines.push(`${ch} charge${ch > 1 ? 's' : ''} par combat · délai ${cd} s`);
  }
  if (d.synergy) {
    const v = pct(d.synergy.value * m);
    if (d.synergy.kind === 'mag') lines.push(`Adjacent à une arme ${d.caliber} : −${v} de temps de recharge (max 3)`);
    if (d.synergy.kind === 'scope') lines.push(`Adjacent à une arme longue : +${v} de critique`);
    if (d.synergy.kind === 'silencer') lines.push('Adjacent à une arme : son 1er tir est critique');
    if (d.synergy.kind === 'pierce') lines.push(`Adjacent à une arme : perce ${v} de l'armure`);
    if (d.synergy.kind === 'grip') lines.push(`Adjacent à une arme : +${v} de cadence`);
    if (d.synergy.kind === 'extmag') lines.push(`Adjacent à une arme : chargeur +${v}`);
    if (d.synergy.kind === 'holo') lines.push(`Adjacent à une arme courte : +${v} de critique`);
    if (d.synergy.kind === 'bipod') lines.push(`Adjacent à une arme longue : +${v} de dégâts`);
  }
  if (d.crafted) lines.push('Objet assemblé (recette)');
  for (const r of RECIPES.filter((rc) => rc.inputs.includes(d.id))) {
    const label = `${r.inputs.map((id) => ITEMS[id].short).join(' + ')} → ${ITEMS[r.output].name}`;
    lines.push(`Recette : ${label} (ingrédients adjacents : assemblage automatique)`);
  }
  const f = FAMILY_INFO[d.family];
  lines.push(`Famille ${f.name}${inst.rarity === MAX_RARITY ? ' (compte double)' : ''} : 2 → ${f.tier2.toLowerCase()} · 4 → ${f.tier4.toLowerCase()}`);
  const n = cellCount(inst.defId);
  lines.push(`${n} case${n > 1 ? 's' : ''} · revente ${sellValue(inst)} cr`);
  return { title: d.name, subtitle: sub, lines };
}
