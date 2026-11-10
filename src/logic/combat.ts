import {
  ASSAUT_EVERY, ASSAUT_STEP, BLINDES_REDUCTION, MEDIC_EVERY, MEDIC_HEAL, Threat,
} from '../data/threats';
import { mulberry32 } from './rng';
import type { PlayerLoadout } from './stats';

export interface EnemyUnit {
  name: string;
  hp: number;
  armor: number;
  dmg: number;
  interval: number;
  acc: number;
  grenade?: { dmg: number; every: number };
  boss?: boolean;
  /** Tire dès le début du combat (menace Tireurs). */
  opener?: boolean;
}

type Target = 'p' | number;

export type CombatEvent =
  | { t: number; kind: 'shot'; from: Target; uid?: number; to: Target; amount: number; crit: boolean; miss: boolean; pierce: boolean; ricochet?: boolean; hp: number; armor: number }
  | { t: number; kind: 'reload'; uid: number }
  | { t: number; kind: 'frag'; uid: number; amount: number; hits: { to: number; hp: number; armor: number }[] }
  | { t: number; kind: 'smoke'; uid: number; until: number }
  | { t: number; kind: 'flash'; uid: number; until: number }
  | { t: number; kind: 'adrenaline'; uid: number; until: number }
  | { t: number; kind: 'heal'; uid: number; amount: number; hp: number }
  | { t: number; kind: 'medic'; amount: number; hits: { to: number; hp: number }[] }
  | { t: number; kind: 'enemyGrenade'; from: number; amount: number; hp: number; armor: number }
  | { t: number; kind: 'reflect'; to: number; amount: number; hp: number; armor: number }
  | { t: number; kind: 'death'; who: Target };

export interface CombatResult {
  events: CombatEvent[];
  win: boolean;
  timeout: boolean;
  duration: number;
  hpEnd: number;
}

export const MAX_TIME = 45;
const DT = 0.05;
const PLAYER_ACC = 0.85;

interface Body {
  hp: number;
  armor: number;
}

/** Applique des dégâts : l'armure absorbe d'abord, sauf la part qui la perce. Renvoie l'absorbé. */
function applyDamage(b: Body, amount: number, pierce = 0): number {
  const toArmor = Math.min(b.armor, amount * (1 - pierce));
  b.armor -= toArmor;
  b.hp = Math.max(0, b.hp - (amount - toArmor));
  return toArmor;
}

/** Simulation déterministe d'un combat : gilet, ennemis, menaces et graine. */
export function simulate(l: PlayerLoadout, enemiesIn: EnemyUnit[], seed: number, threats: Threat[] = []): CombatResult {
  const rng = mulberry32(seed);
  const blindes = threats.includes('blindes');
  const medics = threats.includes('medics');
  const assaut = threats.includes('assaut');
  const p: Body = { hp: l.maxHp, armor: l.armor };
  const en = enemiesIn.map((e) => ({
    e,
    cur: { hp: e.hp, armor: e.armor } as Body,
    next: e.opener ? 0.3 : e.interval * (0.6 + 0.4 * rng()),
    nextNade: e.grenade ? e.grenade.every * 0.6 : Infinity,
  }));
  const ws = l.weapons.map((w) => ({ w, ammo: w.mag, next: w.interval * 0.5, shots: 0 }));
  const as = l.actives.map((a) => ({ a, charges: a.charges, next: a.kind === 'heal' || a.kind === 'adrenaline' ? 0 : a.cooldown * 0.4 }));
  const events: CombatEvent[] = [];
  let smokeUntil = -1;
  let adrenalineUntil = -1;
  let adrenalineBoost = 0;
  let nextMedic = MEDIC_EVERY;
  const living = () => en.map((_, i) => i).filter((i) => en[i].cur.hp > 0);
  const finish = (win: boolean, t: number, timeout = false): CombatResult => ({ events, win, timeout, duration: t, hpEnd: p.hp });

  for (let step = 1; step * DT <= MAX_TIME; step++) {
    const t = Math.round(step * DT * 1000) / 1000;
    if (l.armorRegen > 0 && p.armor < l.armor) p.armor = Math.min(l.armor, p.armor + l.armorRegen * DT);
    const cadence = t < adrenalineUntil ? 1 / (1 + adrenalineBoost) : 1;

    // Armes du joueur
    for (const s of ws) {
      if (t < s.next) continue;
      if (s.ammo <= 0) {
        s.ammo = s.w.mag;
        s.next = t + s.w.reload;
        events.push({ t, kind: 'reload', uid: s.w.uid });
        continue;
      }
      const alive = living();
      if (!alive.length) break;
      const targets = alive.slice(0, s.w.targets);
      const shotNo = s.shots + 1;
      const ricochet = s.w.ricochetEvery > 0 && shotNo % s.w.ricochetEvery === 0 && alive.length > targets.length;
      if (ricochet) targets.push(alive[targets.length]);
      const legendary = s.w.pierceEvery > 0 && shotNo % s.w.pierceEvery === 0;
      targets.forEach((ti, n) => {
        const target = en[ti];
        const miss = rng() > PLAYER_ACC;
        const crit = !miss && ((s.w.firstCrit && s.shots === 0) || rng() < s.w.crit);
        let amount = miss ? 0 : Math.round(s.w.dmg * (crit ? l.critMult : 1));
        if (!miss && blindes && !s.w.ignoreBlindes && !legendary) amount = Math.max(1, amount - BLINDES_REDUCTION);
        if (!miss) applyDamage(target.cur, amount, legendary ? 1 : s.w.armorPierce);
        events.push({
          t, kind: 'shot', from: 'p', uid: s.w.uid, to: ti, amount, crit, miss,
          pierce: !miss && (legendary || s.w.armorPierce > 0), ricochet: ricochet && n === targets.length - 1,
          hp: target.cur.hp, armor: target.cur.armor,
        });
        if (target.cur.hp <= 0) events.push({ t, kind: 'death', who: ti });
      });
      s.shots++;
      s.ammo--;
      s.next = t + s.w.interval * cadence;
    }
    if (!living().length) return finish(true, t);

    // Objets actifs
    for (const s of as) {
      if (s.charges <= 0 || t < s.next) continue;
      const a = s.a;
      if (a.kind === 'frag') {
        const amount = Math.round(a.value);
        const alive = living();
        const hits = alive.map((i) => {
          applyDamage(en[i].cur, amount, a.ignoreArmor ? 1 : 0);
          return { to: i, hp: en[i].cur.hp, armor: en[i].cur.armor };
        });
        events.push({ t, kind: 'frag', uid: a.uid, amount, hits });
        for (const i of alive) if (en[i].cur.hp <= 0) events.push({ t, kind: 'death', who: i });
      } else if (a.kind === 'smoke') {
        smokeUntil = t + a.duration;
        events.push({ t, kind: 'smoke', uid: a.uid, until: smokeUntil });
      } else if (a.kind === 'flash') {
        for (const i of living()) en[i].next = Math.max(en[i].next, t) + a.value;
        events.push({ t, kind: 'flash', uid: a.uid, until: t + a.value });
      } else if (a.kind === 'adrenaline') {
        if (p.hp / l.maxHp >= a.threshold) continue;
        adrenalineUntil = t + a.duration;
        adrenalineBoost = a.value;
        events.push({ t, kind: 'adrenaline', uid: a.uid, until: adrenalineUntil });
      } else {
        if (p.hp / l.maxHp >= a.threshold) continue;
        const amount = Math.min(Math.round(a.value), l.maxHp - p.hp);
        p.hp += amount;
        events.push({ t, kind: 'heal', uid: a.uid, amount, hp: p.hp });
      }
      s.charges--;
      s.next = t + a.cooldown;
    }
    if (!living().length) return finish(true, t);

    // Menace Médics : soins périodiques de l'escouade
    if (medics && t >= nextMedic) {
      nextMedic += MEDIC_EVERY;
      const hits = living().map((i) => {
        en[i].cur.hp = Math.min(en[i].e.hp, en[i].cur.hp + MEDIC_HEAL);
        return { to: i, hp: en[i].cur.hp };
      });
      if (hits.length) events.push({ t, kind: 'medic', amount: MEDIC_HEAL, hits });
    }

    // Ennemis
    const dmgMult = assaut ? 1 + ASSAUT_STEP * Math.floor(t / ASSAUT_EVERY) : 1;
    for (let i = 0; i < en.length; i++) {
      const u = en[i];
      if (u.cur.hp <= 0) continue;
      if (t >= u.next) {
        const acc = u.e.acc * (t < smokeUntil ? 0.5 : 1);
        const miss = rng() > acc;
        const amount = miss ? 0 : Math.round(u.e.dmg * dmgMult);
        const absorbed = miss ? 0 : applyDamage(p, amount);
        events.push({ t, kind: 'shot', from: i, to: 'p', amount, crit: false, miss, pierce: false, hp: p.hp, armor: p.armor });
        u.next = t + u.e.interval;
        if (absorbed > 0 && l.reflect > 0) {
          const ra = Math.max(1, Math.round(absorbed * l.reflect));
          applyDamage(u.cur, ra);
          events.push({ t, kind: 'reflect', to: i, amount: ra, hp: u.cur.hp, armor: u.cur.armor });
          if (u.cur.hp <= 0) events.push({ t, kind: 'death', who: i });
        }
        if (p.hp <= 0) {
          events.push({ t, kind: 'death', who: 'p' });
          return finish(false, t);
        }
      }
      if (u.e.grenade && u.cur.hp > 0 && t >= u.nextNade) {
        const amount = Math.round(u.e.grenade.dmg * dmgMult);
        applyDamage(p, amount);
        events.push({ t, kind: 'enemyGrenade', from: i, amount, hp: p.hp, armor: p.armor });
        u.nextNade = t + u.e.grenade.every;
        if (p.hp <= 0) {
          events.push({ t, kind: 'death', who: 'p' });
          return finish(false, t);
        }
      }
    }
    if (!living().length) return finish(true, t);
  }
  return finish(false, MAX_TIME, true);
}
