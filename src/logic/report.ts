// Rapport de duel : ce que chaque objet a apporté, relu depuis les événements du duel (aucune nouvelle simulation).
import type { DuelEvent, DuelResult, Side } from './combat';
import type { PlayerLoadout } from './stats';

export interface ItemReport {
  uid: number;
  /** Dégâts infligés (armure adverse comprise), saignement compris. */
  dmg: number;
  /** Part de `dmg` venue du saignement posé par cet objet. */
  bleed: number;
  /** Tirs ou coups tentés, touches, critiques. */
  shots: number;
  hits: number;
  crits: number;
  /** PV rendus (soins, bandage). */
  heal: number;
  /** Dégâts reçus pris par l'armure, au prorata de l'armure apportée par cet objet. */
  absorbed: number;
  /** Déclenchements d'un objet actif (grenade, soin, fumigène…). */
  uses: number;
  /** Tirs adverses ratés pendant ce fumigène. */
  dodged: number;
  /** Secondes d'étourdissement infligées (flash, taser). */
  stun: number;
  /** Part de `dmg` venue de la Brûlure posée par cet objet. */
  burnDmg: number;
  /** Décharges de Choc déclenchées par cet objet. */
  discharges: number;
  /** Fois où cette arme a dû attendre, faute d'Endurance. */
  tired: number;
}

export interface SideReport {
  /** Objets qui ont apporté quelque chose, du plus utile au moins utile. */
  items: ItemReport[];
  /** Dégâts infligés à l'adversaire. */
  dealt: number;
  /** Dégâts reçus : sur les PV, et pris par l'armure. */
  tookHp: number;
  tookArmor: number;
  healed: number;
}

export type DuelReport = Record<Side, SideReport>;

const other = (s: Side): Side => (s === 'a' ? 'b' : 'a');

function blank(uid: number): ItemReport {
  return { uid, dmg: 0, bleed: 0, shots: 0, hits: 0, crits: 0, heal: 0, absorbed: 0, uses: 0, dodged: 0, stun: 0, burnDmg: 0, discharges: 0, tired: 0 };
}

/** Valeur unique pour classer les objets : ce qu'ils ont fait gagner en PV (infligés, soignés, protégés). */
export function itemWeight(r: ItemReport): number {
  return r.dmg + r.heal + r.absorbed;
}

/**
 * Relit un duel. Le saignement est réparti entre les objets qui l'ont posé, au prorata de la réserve que chacun
 * a laissée (le bandage la réduit pour tous) ; l'armure absorbée est répartie au prorata de l'armure de chaque objet.
 */
export function duelReport(result: Pick<DuelResult, 'events'>, a: PlayerLoadout, b: PlayerLoadout): DuelReport {
  const L: Record<Side, PlayerLoadout> = { a, b };
  const items: Record<Side, Map<number, ItemReport>> = { a: new Map(), b: new Map() };
  const it = (side: Side, uid: number) => {
    let r = items[side].get(uid);
    if (!r) items[side].set(uid, (r = blank(uid)));
    return r;
  };
  const sides: Record<Side, SideReport> = {
    a: { items: [], dealt: 0, tookHp: 0, tookArmor: 0, healed: 0 },
    b: { items: [], dealt: 0, tookHp: 0, tookArmor: 0, healed: 0 },
  };
  /** Réserve de saignement sur chaque camp, par objet adverse qui l'a posée. */
  const bleedBy: Record<Side, Map<number, number>> = { a: new Map(), b: new Map() };
  const smoke: Record<Side, { uid: number; until: number } | null> = { a: null, b: null };
  /** Cumuls de Brûlure posés sur chaque camp, par objet adverse (pour répartir les dégâts des ticks). */
  const burnBy: Record<Side, Map<number, number>> = { a: new Map(), b: new Map() };
  const addBurn = (target: Side, uid: number, n?: number) => {
    if (!n) return;
    burnBy[target].set(uid, (burnBy[target].get(uid) ?? 0) + n);
  };
  /** Tir en cours de chaque arme (plombs, balle doublée) : déjà compté comme touche ? */
  const shotHit = new Map<string, boolean>();

  /** `target` encaisse `amount`, dont `absorbed` par son armure. */
  const take = (target: Side, amount: number, absorbed: number) => {
    sides[target].tookArmor += absorbed;
    sides[target].tookHp += amount - absorbed;
    sides[other(target)].dealt += amount;
  };

  for (const e of result.events as DuelEvent[]) {
    switch (e.kind) {
      case 'shot': {
        const r = it(e.from, e.uid);
        // Un tir = une touche au plus, même s'il frappe deux fois (plombs, balle doublée).
        const key = `${e.from}:${e.uid}`;
        if (!e.double) {
          r.shots++;
          shotHit.set(key, false);
        }
        if (!e.miss && !shotHit.get(key)) {
          r.hits++;
          shotHit.set(key, true);
        }
        if (e.miss) {
          const sm = smoke[other(e.from)];
          if (sm && e.t < sm.until) it(other(e.from), sm.uid).dodged++;
          break;
        }
        if (e.crit) r.crits++;
        r.dmg += e.amount;
        take(other(e.from), e.amount, e.absorbed ?? 0);
        if (e.bleed) {
          const m = bleedBy[other(e.from)];
          m.set(e.uid, (m.get(e.uid) ?? 0) + e.bleed);
        }
        addBurn(other(e.from), e.uid, e.burn);
        break;
      }
      case 'bleed': {
        // Saignement versé par `side` : réparti entre les objets adverses qui l'ont posé.
        const m = bleedBy[e.side];
        const total = [...m.values()].reduce((s, v) => s + v, 0);
        sides[e.side].tookHp += e.amount;
        sides[other(e.side)].dealt += e.amount;
        if (total <= 0) break;
        // Les ticks annoncés sont arrondis : on répartit tout le tick, la réserve suivie ne sert qu'aux proportions.
        for (const [uid, v] of m) {
          const part = (e.amount * v) / total;
          const r = it(other(e.side), uid);
          r.dmg += part;
          r.bleed += part;
          m.set(uid, Math.max(0, v - part));
        }
        break;
      }
      case 'bandage': {
        const r = it(e.side, e.uid);
        r.uses++;
        r.heal += e.amount;
        sides[e.side].healed += e.amount;
        const m = bleedBy[e.side];
        const total = [...m.values()].reduce((s, v) => s + v, 0);
        if (total > 0) for (const [uid, v] of m) m.set(uid, v * Math.max(0, 1 - e.cured / total));
        break;
      }
      case 'heal': {
        const r = it(e.side, e.uid);
        r.uses++;
        r.heal += e.amount;
        sides[e.side].healed += e.amount;
        break;
      }
      case 'taser':
      case 'frag': {
        const r = it(e.side, e.uid);
        r.uses++;
        r.hits++;
        r.dmg += e.amount;
        if (e.kind === 'taser') r.stun += e.until - e.t;
        take(other(e.side), e.amount, e.absorbed ?? 0);
        addBurn(other(e.side), e.uid, e.burn);
        break;
      }
      case 'flash':
        it(e.side, e.uid).uses++;
        it(e.side, e.uid).stun += e.until - e.t;
        addBurn(other(e.side), e.uid, e.burn);
        break;
      case 'burn': {
        // Tick de Brûlure sur `side` : réparti entre les objets adverses selon les cumuls qu'ils ont posés.
        sides[e.side].tookHp += e.amount;
        sides[other(e.side)].dealt += e.amount;
        const m = burnBy[e.side];
        const total = [...m.values()].reduce((t, v) => t + v, 0);
        if (total > 0) {
          for (const [uid, v] of m) {
            const part = (e.amount * v) / total;
            const r = it(other(e.side), uid);
            r.dmg += part;
            r.burnDmg += part;
          }
        }
        break;
      }
      case 'discharge': {
        const r = it(other(e.side), e.uid);
        r.discharges++;
        if (e.amount) {
          r.dmg += e.amount;
          take(e.side, e.amount, 0);
        }
        break;
      }
      case 'tired':
        it(e.side, e.uid).tired++;
        break;
      case 'smoke':
        it(e.side, e.uid).uses++;
        smoke[e.side] = { uid: e.uid, until: e.until };
        break;
      case 'adrenaline':
        it(e.side, e.uid).uses++;
        break;
      case 'reload':
      case 'death':
        break;
    }
  }

  for (const side of ['a', 'b'] as Side[]) {
    // Armure : l'absorbé est réparti selon l'armure apportée par chaque protection.
    const by = Object.entries(L[side].armorBy ?? {});
    const total = by.reduce((s, [, v]) => s + v, 0);
    if (total > 0 && sides[side].tookArmor > 0) {
      for (const [uid, v] of by) it(side, Number(uid)).absorbed += (sides[side].tookArmor * v) / total;
    }
    const round = (r: ItemReport): ItemReport => ({
      ...r, dmg: Math.round(r.dmg), bleed: Math.round(r.bleed), burnDmg: Math.round(r.burnDmg), heal: Math.round(r.heal), absorbed: Math.round(r.absorbed),
      stun: Math.round(r.stun * 10) / 10,
    });
    sides[side].items = [...items[side].values()]
      .map(round)
      .filter((r) => itemWeight(r) > 0 || r.uses > 0 || r.shots > 0)
      .sort((x, y) => itemWeight(y) - itemWeight(x) || y.uses - x.uses);
    sides[side].dealt = Math.round(sides[side].dealt);
    sides[side].tookHp = Math.round(sides[side].tookHp);
    sides[side].tookArmor = Math.round(sides[side].tookArmor);
    sides[side].healed = Math.round(sides[side].healed);
  }
  return sides;
}
