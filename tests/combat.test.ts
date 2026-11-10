import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { OPERATORS, OperatorId } from '../src/data/operators';
import { BotBuild, botLoadout, generateBot } from '../src/logic/bots';
import { MAX_TIME, simulateDuel } from '../src/logic/combat';
import { ItemInst, Rot, canPlace, cellKey, cellsOf } from '../src/logic/grid';
import { computeLoadout, describe as describeItem, estimateDps, maxHpFor } from '../src/logic/stats';

const inst = (uid: number, defId: string, x: number, y: number, rarity = 0, rot: Rot = 0): ItemInst => ({ uid, defId, rarity, rot, x, y, placed: true });
const startItems = (op: OperatorId): ItemInst[] => OPERATORS[op].start.map(([defId, x, y], i) => inst(100 + i, defId, x, y));
const start = (op: OperatorId, hp = 100) => computeLoadout(startItems(op), op, hp).loadout;

const winRate = (a: () => ReturnType<typeof start>, b: (s: number) => ReturnType<typeof start>, n: number) => {
  let w = 0;
  for (let s = 0; s < n; s++) if (simulateDuel(a(), b(s), s).win) w++;
  return w / n;
};

describe('statistiques 1v1', () => {
  it('PV max : 100 + 20 par manche', () => {
    expect(maxHpFor(0)).toBe(100);
    expect(maxHpFor(4)).toBe(180);
    expect(start('viper', 140).maxHp).toBe(140);
  });

  it('passifs : Viper accélère les 5.56, Sentinelle +10 % de critique', () => {
    const kr = [inst(1, 'fusil_assaut', 2, 2)];
    const v = computeLoadout(kr, 'viper', 100).loadout.weapons[0];
    const s = computeLoadout(kr, 'sentinelle', 100).loadout.weapons[0];
    expect(v.interval).toBeCloseTo(s.interval / 1.1);
    expect(s.crit).toBeCloseTo(v.crit + 0.1);
  });

  it('les pompes touchent deux fois par tir', () => {
    const w = computeLoadout([inst(1, 'pompe', 2, 2)], 'viper', 100).loadout.weapons[0];
    expect(w.pellets).toBe(2);
  });

  it("les fiches ne parlent plus de gilet, d'Établi ni d'escouade", () => {
    for (const id of Object.keys(ITEMS)) {
      for (const r of [0, 4]) {
        const text = describeItem(inst(1, id, 0, 0, r)).lines.join(' ');
        expect(text).not.toMatch(/Établi|escouade|Poitrine|Blindés|ennemi/i);
      }
    }
    expect(describeItem(inst(1, 'frag', 0, 0)).lines.join(' ')).toMatch(/assemblage automatique/);
  });

  it('un sac en vrac perd au moins 25 % de DPS par rapport au même sac bien rangé', () => {
    const builds = [
      [inst(1, 'fusil_assaut', 0, 3, 2), inst(2, 'chg_556', 4, 3, 1), inst(3, 'lunette', 0, 2, 1), inst(5, 'smg', 3, 0, 1), inst(6, 'chg_9mm', 3, 2)],
      [inst(1, 'precision', 0, 3, 2), inst(2, 'chg_762', 0, 2), inst(3, 'lunette', 1, 2, 1), inst(4, 'silencieux', 3, 2, 2), inst(6, 'pistolet', 3, 0)],
      [inst(1, 'smg', 0, 0, 1), inst(2, 'chg_9mm', 3, 0), inst(3, 'fusil_assaut', 0, 3, 1), inst(4, 'chg_556', 4, 3), inst(7, 'poignee', 0, 1), inst(8, 'bipied', 0, 2)],
      startItems('viper'),
      startItems('sentinelle'),
    ];
    for (const b of builds) {
      for (const op of ['viper', 'sentinelle'] as const) {
        const good = estimateDps(computeLoadout(b, op, 100).loadout);
        const bad = estimateDps(computeLoadout(b.map((i, n) => ({ ...i, x: 20 + n * 8, y: 20 })), op, 100).loadout);
        expect(bad / good).toBeLessThan(0.75);
      }
    }
  });
});

describe('duel', () => {
  it('est déterministe pour une graine', () => {
    const a = start('viper');
    const b = botLoadout(generateBot(7, 1));
    expect(simulateDuel(a, b, 42)).toEqual(simulateDuel(a, b, 42));
  });

  it('deux sacs identiques : environ 50 %', () => {
    for (const op of ['viper', 'sentinelle'] as const) {
      const r = winRate(() => start(op), () => start(op), 1500);
      expect(r).toBeGreaterThan(0.44);
      expect(r).toBeLessThan(0.56);
    }
    // Sacs de bots identiques, avec objets actifs.
    const bot = botLoadout(generateBot(3, 4, { final: true }));
    const r = winRate(() => bot, () => bot, 1000);
    expect(r).toBeGreaterThan(0.43);
    expect(r).toBeLessThan(0.57);
  });

  it('les deux sacs de départ sont à peu près équilibrés', () => {
    const r = winRate(() => start('viper'), () => start('sentinelle'), 1500);
    expect(r).toBeGreaterThan(0.35);
    expect(r).toBeLessThan(0.65);
  });

  it('jamais d’égalité, événements cohérents', () => {
    for (let s = 0; s < 200; s++) {
      const a = botLoadout(generateBot(s, s % 5));
      const b = botLoadout(generateBot(s + 1000, s % 5));
      const r = simulateDuel(a, b, s);
      expect(typeof r.win).toBe('boolean');
      expect(r.duration).toBeLessThanOrEqual(MAX_TIME);
      if (!r.timeout) {
        const death = r.events[r.events.length - 1];
        expect(death.kind).toBe('death');
        if (death.kind === 'death') expect(death.side).toBe(r.win ? 'b' : 'a');
        expect(r.win ? r.hpEndB : r.hpEndA).toBe(0);
      }
      for (let i = 1; i < r.events.length; i++) expect(r.events[i].t).toBeGreaterThanOrEqual(r.events[i - 1].t);
    }
  });

  it('au temps limite, la plus grande part de PV gagne', () => {
    // Deux sacs sans arme : personne ne meurt.
    const empty = computeLoadout([inst(1, 'casque', 2, 2)], 'viper', 100).loadout;
    const r = simulateDuel(empty, empty, 1, { hpA: 60 });
    expect(r.timeout).toBe(true);
    expect(r.win).toBe(false);
    expect(r.duration).toBe(MAX_TIME);
  });

  it('les PV gardés (hpA) sont repris et pèsent sur le résultat', () => {
    const a = start('viper');
    const r = simulateDuel(a, a, 5, { hpA: 30 });
    const firstShot = r.events.find((e) => e.kind === 'shot' && e.from === 'b' && !e.miss && e.armor === 0);
    if (firstShot && firstShot.kind === 'shot') expect(firstShot.hp).toBeLessThan(30);
    const full = winRate(() => a, () => a, 400);
    let low = 0;
    for (let s = 0; s < 400; s++) if (simulateDuel(a, a, s, { hpA: 35 }).win) low++;
    expect(low / 400).toBeLessThan(full - 0.2);
    expect(simulateDuel(a, a, 9, { hpA: 35 }).hpEndA).toBeLessThanOrEqual(35);
  });

  it('frag, flash et fumigène visent l’adversaire', () => {
    const items = [inst(1, 'pistolet', 2, 2), inst(2, 'chg_9mm', 4, 2), inst(3, 'frag', 2, 4), inst(4, 'flash', 3, 4, 1), inst(5, 'fumigene', 5, 4)];
    const a = computeLoadout(items, 'viper', 100).loadout;
    const b = start('sentinelle');
    const r = simulateDuel(a, b, 3);
    const frag = r.events.find((e) => e.kind === 'frag');
    expect(frag && frag.kind === 'frag' && frag.side).toBe('a');
    expect(r.events.some((e) => e.kind === 'flash' && e.side === 'a')).toBe(true);
    expect(r.events.some((e) => e.kind === 'smoke' && e.side === 'a')).toBe(true);
  });
});

describe('bots', () => {
  const check = (b: BotBuild) => {
    const usable = new Set(b.usable);
    const seen = new Set<string>();
    for (const it of b.items) {
      expect(it.placed).toBe(true);
      const others = b.items.filter((o) => o !== it);
      expect(canPlace(others, it, it.x, it.y, it.rot, usable)).toBe(true);
      for (const [x, y] of cellsOf(it)) {
        const k = cellKey(x, y);
        expect(usable.has(k)).toBe(true);
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
    }
    expect(new Set(b.items.map((i) => i.uid)).size).toBe(b.items.length);
    expect(b.items.some((i) => ITEMS[i.defId].weapon)).toBe(true);
  };

  it('chaque objet est posé légalement, sans chevauchement, dans les cases du sac', () => {
    for (let s = 0; s < 120; s++) {
      for (let round = 0; round <= 4; round++) check(generateBot(s, round, { danger: (s % 3) / 2 }));
      check(generateBot(s, 5, { final: true }));
      check(generateBot(s, 2, { goulag: true }));
    }
  });

  it('est déterministe, a un nom et les PV de sa manche', () => {
    expect(generateBot(11, 3)).toEqual(generateBot(11, 3));
    const b = generateBot(11, 3);
    expect(b.name.length).toBeGreaterThan(2);
    expect(b.maxHp).toBe(maxHpFor(3));
    expect(botLoadout(b).maxHp).toBe(maxHpFor(3));
  });

  it('le sac grandit avec les manches, les bots forts sont plus fréquents', () => {
    const avg = (round: number, f: (b: BotBuild) => number) => {
      let t = 0;
      for (let s = 0; s < 200; s++) t += f(generateBot(s, round));
      return t / 200;
    };
    expect(generateBot(1, 0).usable.length).toBe(20);
    expect(generateBot(1, 4).usable.length).toBeGreaterThan(20);
    expect(avg(4, (b) => b.items.length)).toBeGreaterThan(avg(0, (b) => b.items.length) + 2);
    expect(avg(4, (b) => (b.quality === 'fort' ? 1 : 0))).toBeGreaterThan(avg(0, (b) => (b.quality === 'fort' ? 1 : 0)) + 0.2);
    expect(generateBot(1, 2, { goulag: true }).quality).toBe('normal');
    expect(generateBot(1, 5, { final: true }).quality).toBe('fort');
  });

  it('qualité : fort bat nettement faible, normal bat faible', () => {
    const pool = (round: number) => {
      const out: Record<string, BotBuild[]> = { faible: [], normal: [], fort: [] };
      for (let s = 0; out.faible.length < 150 || out.fort.length < 150 || out.normal.length < 150; s++) {
        const b = generateBot(s, round);
        out[b.quality].push(b);
      }
      return out;
    };
    for (const round of [1, 3]) {
      const p = pool(round);
      let fw = 0;
      let nw = 0;
      for (let s = 0; s < 150; s++) {
        if (simulateDuel(botLoadout(p.fort[s]), botLoadout(p.faible[s]), s).win) fw++;
        if (simulateDuel(botLoadout(p.normal[s]), botLoadout(p.faible[s]), s).win) nw++;
      }
      expect(fw / 150).toBeGreaterThan(0.7);
      expect(nw / 150).toBeGreaterThan(0.55);
    }
  });

  it('le Top 1 est très fort', () => {
    let w = 0;
    for (let s = 0; s < 150; s++) {
      if (simulateDuel(botLoadout(generateBot(s, 5, { final: true })), botLoadout(generateBot(s, 4, { goulag: true })), s).win) w++;
    }
    expect(w / 150).toBeGreaterThan(0.8);
  });

  it('le sac de départ gagne environ une fois sur deux contre un bot normal du 1er cercle', () => {
    for (const op of ['viper', 'sentinelle'] as const) {
      let w = 0;
      for (let s = 0; s < 300; s++) w += simulateDuel(start(op), botLoadout(generateBot(s, 0, { goulag: true })), s).win ? 1 : 0;
      expect(w / 300).toBeGreaterThan(0.4);
      expect(w / 300).toBeLessThan(0.75);
    }
  });
});
