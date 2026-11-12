import { describe, expect, it } from 'vitest';
import { botLoadout, generateBot } from '../src/logic/bots';
import { simulateDuel } from '../src/logic/combat';
import { ItemInst } from '../src/logic/grid';
import { duelReport, itemWeight } from '../src/logic/report';
import { PlayerLoadout, computeLoadout } from '../src/logic/stats';

const inst = (uid: number, defId: string, x: number, y: number): ItemInst => ({ uid, defId, rot: 0, x, y, placed: true });
const dummy = (over: Partial<PlayerLoadout> = {}): PlayerLoadout => ({
  maxHp: 1e6, armor: 0, weapons: [], melee: [], actives: [], critMult: 2, armorRegen: 0, flatReduce: 0, markBonus: 0, families: [], ...over,
});

describe('rapport de duel', () => {
  it('les dégâts par objet font le total, et le total est ce que l’adversaire a encaissé', () => {
    for (let s = 0; s < 60; s++) {
      const a = botLoadout(generateBot(s, s % 5));
      const b = botLoadout(generateBot(s + 500, s % 5));
      const rep = duelReport(simulateDuel(a, b, s), a, b);
      for (const [me, foe] of [['a', 'b'], ['b', 'a']] as const) {
        const sum = rep[me].items.reduce((t, r) => t + r.dmg, 0);
        // Arrondis par objet ; le saignement sans source connue n'existe pas (toujours posé par un objet).
        expect(Math.abs(sum - rep[me].dealt)).toBeLessThanOrEqual(rep[me].items.length + 1);
        expect(Math.abs(rep[foe].tookHp + rep[foe].tookArmor - rep[me].dealt)).toBeLessThanOrEqual(2);
        const abs = rep[foe].items.reduce((t, r) => t + r.absorbed, 0);
        if (rep[foe].tookArmor > 0 && Object.keys((me === 'a' ? b : a).armorBy ?? {}).length) {
          expect(Math.abs(abs - rep[foe].tookArmor)).toBeLessThanOrEqual(rep[foe].items.length + 1);
        }
        // Classement du plus utile au moins utile.
        const w = rep[me].items.map(itemWeight);
        for (let i = 1; i < w.length; i++) expect(w[i]).toBeLessThanOrEqual(w[i - 1]);
      }
    }
  });

  it('l’armure absorbée revient aux protections, au prorata de leur armure', () => {
    const def = computeLoadout([inst(1, 'casque', 0, 0), inst(2, 'plaque', 4, 4)], 'viper', 1e6).loadout;
    const by = def.armorBy!;
    expect(Object.keys(by).map(Number).sort()).toEqual([1, 2]);
    const atk = computeLoadout([inst(10, 'fusil_assaut', 2, 2), inst(11, 'chg_556', 2, 3)], 'viper', 300).loadout;
    const rep = duelReport(simulateDuel(def, atk, 4), def, atk);
    const casque = rep.a.items.find((r) => r.uid === 1)!;
    const gilet = rep.a.items.find((r) => r.uid === 2)!;
    expect(rep.a.tookArmor).toBeGreaterThan(0);
    expect(casque.absorbed / gilet.absorbed).toBeCloseTo(by[1] / by[2], 1);
    // Le KR-4 a tiré, touché, et infligé tout ce que le défenseur a encaissé.
    const kr = rep.b.items.find((r) => r.uid === 10)!;
    expect(kr.shots).toBeGreaterThanOrEqual(kr.hits);
    expect(kr.dmg).toBe(rep.b.dealt);
  });

  it('le saignement revient à l’arme qui l’a posé', () => {
    const a = computeLoadout([inst(1, 'couteau_combat', 0, 0)], 'viper', 300).loadout;
    const rep = duelReport(simulateDuel(a, dummy(), 2), a, dummy());
    const k = rep.a.items.find((r) => r.uid === 1)!;
    expect(k.bleed).toBeGreaterThan(0);
    expect(k.dmg).toBeGreaterThan(k.bleed);
    expect(Math.abs(k.dmg - rep.a.dealt)).toBeLessThanOrEqual(1);
  });

  it('objets actifs : déclenchements, soins, étourdissement', () => {
    const items = [inst(1, 'pistolet', 2, 2), inst(2, 'chg_9mm', 4, 2), inst(3, 'frag', 2, 4), inst(4, 'flash', 3, 4), inst(5, 'fumigene', 5, 4)];
    const a = computeLoadout(items, 'viper', 300).loadout;
    const b = botLoadout(generateBot(11, 1));
    const rep = duelReport(simulateDuel(a, b, 3), a, b);
    const get = (uid: number) => rep.a.items.find((r) => r.uid === uid);
    expect(get(3)?.uses).toBeGreaterThan(0);
    expect(get(3)?.dmg).toBeGreaterThan(0);
    expect(get(4)?.stun).toBeGreaterThan(0);
    expect(get(5)?.uses).toBeGreaterThan(0);
    // Le chargeur ne fait rien lui-même : il n'apparaît pas.
    expect(get(2)).toBeUndefined();
  });
});

describe('rapport de duel : touches', () => {
  it('jamais plus de touches que de tirs (plombs, balles doublées)', () => {
    for (let s = 0; s < 60; s++) {
      const a = botLoadout(generateBot(s, 4, { final: true }));
      const b = botLoadout(generateBot(s + 300, 4, { final: true }));
      const rep = duelReport(simulateDuel(a, b, s), a, b);
      for (const side of ['a', 'b'] as const) for (const r of rep[side].items) if (r.shots) expect(r.hits, `${r.uid}`).toBeLessThanOrEqual(r.shots);
    }
  });
});
