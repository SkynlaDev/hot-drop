import { describe, expect, it } from 'vitest';
import { LEGENDARY_IDS } from '../src/data/items';
import { MENACE_MAX, Store, collection, dailyChallenge, emptyProfile, loadProfile, markSeen, recordRun, saveProfile } from '../src/logic/profile';
import { GOULAG_DANGER, START_CREDITS, REROLL_COST, menaceDanger, newRun, playerMaxHp, rerollCost, roundMaxHp } from '../src/logic/run';

const mem = (): Store => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

describe('profil local', () => {
  it('se sauvegarde et se recharge', () => {
    const s = mem();
    const p = emptyProfile();
    p.runs = 3;
    markSeen(p, ['frag', 'frag', 'casque', 'inconnu']);
    saveProfile(p, s);
    const q = loadProfile(s);
    expect(q.runs).toBe(3);
    expect(q.seen).toEqual(['frag', 'casque']);
    expect(loadProfile(mem())).toEqual(emptyProfile());
  });

  it('gagner le Top 1 au plus haut niveau débloque la Menace suivante (jusqu’à 5)', () => {
    const p = emptyProfile();
    const run = newRun('viper', 1);
    run.over = 'win';
    run.round = 5;
    expect(recordRun(p, run).unlocked).toBe(1);
    expect(p.menace.viper).toBe(1);
    expect(p.menace.sentinelle).toBe(0);
    // Regagner en Menace 0 ne débloque rien de plus.
    expect(recordRun(p, run).unlocked).toBeUndefined();
    for (let m = 1; m <= MENACE_MAX; m++) {
      const r = newRun('viper', m, { menace: m });
      r.over = 'win';
      r.round = 5;
      recordRun(p, r);
    }
    expect(p.menace.viper).toBe(MENACE_MAX);
    expect(p.top1).toBe(2 + MENACE_MAX);
    expect(p.history.length).toBeGreaterThan(0);
  });

  it('défaite : record, historique et carnet, pas de déblocage', () => {
    const p = emptyProfile();
    const run = newRun('sentinelle', 2);
    run.over = 'lose';
    run.round = 3;
    run.items.push({ uid: 900, defId: LEGENDARY_IDS[0], rot: 0, x: 2, y: 2, placed: true });
    const out = recordRun(p, run);
    expect(out.record).toBe(true);
    expect(out.unlocked).toBeUndefined();
    expect(p.best.sentinelle).toBe(3);
    expect(p.history[0]).toMatchObject({ operator: 'sentinelle', result: 'lose', round: 3 });
    expect(p.history[0].key[0]).toBe(LEGENDARY_IDS[0]);
    expect(collection(p).legendary[0]).toBe(1);
  });

  it('Menace : danger, crédits, relance, Goulag, PV', () => {
    const r0 = newRun('viper', 5);
    expect(r0.credits).toBe(START_CREDITS);
    expect(r0.goulagUsed).toBe(false);
    expect(menaceDanger(r0)).toBe(0);
    const r5 = newRun('viper', 5, { menace: 5 });
    expect(menaceDanger(r5)).toBe(1);
    expect(r5.credits).toBe(START_CREDITS - 3);
    expect(rerollCost(r5)).toBe(REROLL_COST + 1);
    expect(r5.goulagUsed).toBe(true);
    expect(playerMaxHp(r5, 2)).toBe(Math.round(roundMaxHp(2) * 0.85));
    expect(GOULAG_DANGER).toBe(0);
  });

  it('défi du jour : même graine et opérateur pour une date, autre le lendemain ; ne débloque pas de Menace', () => {
    const a = dailyChallenge('2026-11-14');
    expect(dailyChallenge('2026-11-14')).toEqual(a);
    const days = ['2026-11-15', '2026-11-16', '2026-11-17'].map((d) => dailyChallenge(d).seed);
    expect(days.every((x) => x !== a.seed)).toBe(true);
    const p = emptyProfile();
    const run = newRun(a.operator, a.seed, { menace: 1, daily: '2026-11-14' });
    run.over = 'win';
    run.round = 5;
    const out = recordRun(p, run);
    expect(out.dailyBest).toBe(true);
    expect(out.unlocked).toBeUndefined();
    expect(p.daily['2026-11-14'].result).toBe('win');
  });
});
