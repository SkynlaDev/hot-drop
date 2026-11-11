import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { OPERATORS, OperatorId, lootPool } from '../src/data/operators';
import { BotBuild, botLoadout, generateBot } from '../src/logic/bots';
import { DuelEvent, MAX_FLAT_REDUCE, MAX_TIME, simulateDuel } from '../src/logic/combat';
import { ItemInst, Rot, canPlace, cellKey, cellsOf } from '../src/logic/grid';
import { DRUM_RELOAD, FEU_CAP, FEU_RATE, MARK_BONUS, MELEE_DRY_SPEED, MeleeRt, PlayerLoadout, WeaponRt, computeLoadout, describe as describeItem, estimateDps, magsOf, maxHpFor } from '../src/logic/stats';

const inst = (uid: number, defId: string, x: number, y: number, rot: Rot = 0): ItemInst => ({ uid, defId, rot, x, y, placed: true });
const startItems = (op: OperatorId): ItemInst[] => OPERATORS[op].start.map(([defId, x, y], i) => inst(100 + i, defId, x, y));
const start = (op: OperatorId, hp = maxHpFor(0)) => computeLoadout(startItems(op), op, hp).loadout;

const winRate = (a: () => ReturnType<typeof start>, b: (s: number) => ReturnType<typeof start>, n: number) => {
  let w = 0;
  for (let s = 0; s < n; s++) if (simulateDuel(a(), b(s), s).win) w++;
  return w / n;
};

describe('statistiques 1v1', () => {
  it('PV max : 300 + 150 par manche (duels de 15 à 25 s)', () => {
    expect(maxHpFor(0)).toBe(300);
    expect(maxHpFor(4)).toBe(900);
    expect(start('viper', 140).maxHp).toBe(140);
  });

  it('passifs : Feu continu pour Viper, Marque pour Sentinelle', () => {
    const kr = [inst(1, 'fusil_assaut', 2, 2)];
    const v = computeLoadout(kr, 'viper', 100).loadout;
    const s = computeLoadout(kr, 'sentinelle', 100).loadout;
    expect(v.weapons[0].heatCap).toBeCloseTo(FEU_CAP);
    expect(v.weapons[0].heatRate).toBeCloseTo(FEU_RATE);
    expect(v.markBonus).toBe(0);
    expect(s.weapons[0].heatCap).toBe(0);
    expect(s.markBonus).toBeCloseTo(MARK_BONUS);
    // Plus de bonus de cadence ni de critique à plat : mêmes stats de base.
    expect(v.weapons[0].interval).toBeCloseTo(s.weapons[0].interval);
    expect(v.weapons[0].crit).toBeCloseTo(s.weapons[0].crit);
  });

  it('nouveaux objets : tambour, refroidisseur, traçantes, Déluge', () => {
    const smg = (extra: ItemInst[]) => computeLoadout([inst(1, 'smg', 2, 2), ...extra], 'viper', 100).loadout.weapons[0];
    const base = smg([]);
    const drum = smg([inst(2, 'chg_tambour', 2, 3)]);
    expect(drum.mag).toBe(base.mag * 2);
    expect(drum.reload).toBeCloseTo(base.reload * (1 + DRUM_RELOAD));
    const cool = smg([inst(2, 'refroidisseur', 2, 3)]);
    expect(cool.heatRate).toBeCloseTo(FEU_RATE * 2);
    const deluge = computeLoadout([inst(1, 'ours_deluge', 2, 2)], 'viper', 100).loadout.weapons[0];
    expect(deluge.heatCap).toBeCloseTo(FEU_CAP + 0.2);
    const tr = computeLoadout([inst(1, 'revolver', 2, 2), inst(2, 'tracantes', 2, 3)], 'sentinelle', 100).loadout.weapons[0];
    expect(tr.markBoost).toBeCloseTo(0.3);
    expect(computeLoadout([inst(1, 'colibri', 2, 2)], 'sentinelle', 100).loadout.weapons[0].crit).toBeCloseTo(0.25);
    for (const id of ['chg_tambour', 'refroidisseur', 'colibri', 'tracantes', 'ours_deluge', 'faucon_traqueur']) {
      expect(describeItem(inst(1, id, 0, 0)).lines.length).toBeGreaterThan(2);
    }
    expect(describeItem(inst(1, 'refroidisseur', 0, 0)).lines.join(' ')).toMatch(/Feu continu/);
    expect(describeItem(inst(1, 'tracantes', 0, 0)).lines.join(' ')).toMatch(/Marque/);
    expect(lootPool('viper')).toEqual(expect.arrayContaining(['chg_tambour', 'refroidisseur']));
    expect(lootPool('sentinelle')).toEqual(expect.arrayContaining(['colibri', 'tracantes']));
    expect(lootPool('viper')).not.toContain('colibri');
  });

  it('les pompes touchent deux fois par tir', () => {
    const w = computeLoadout([inst(1, 'pompe', 2, 2)], 'viper', 100).loadout.weapons[0];
    expect(w.pellets).toBe(2);
  });

  it("les fiches ne parlent plus de gilet, d'Établi ni d'escouade", () => {
    for (const id of Object.keys(ITEMS)) {
      const text = describeItem(inst(1, id, 0, 0)).lines.join(' ');
      expect(text).not.toMatch(/Établi|escouade|Poitrine|Blindés|ennemi|rareté|légendaire/i);
    }
    expect(describeItem(inst(1, 'frag', 0, 0)).lines.join(' ')).toMatch(/assemblage automatique/);
  });

  it('un sac en vrac perd au moins 13 % de DPS par rapport au même sac bien rangé', () => {
    const builds = [
      [inst(1, 'fusil_assaut', 0, 3), inst(2, 'chg_556', 4, 3), inst(3, 'lunette', 0, 2), inst(5, 'smg', 3, 0), inst(6, 'chg_9mm', 3, 2)],
      [inst(1, 'precision', 0, 3), inst(2, 'chg_762', 0, 2), inst(3, 'lunette', 1, 2), inst(4, 'silencieux', 3, 2), inst(6, 'pistolet', 3, 0)],
      [inst(1, 'smg', 0, 0), inst(2, 'chg_9mm', 3, 0), inst(3, 'fusil_assaut', 0, 3), inst(4, 'chg_556', 4, 3), inst(7, 'poignee', 0, 1), inst(8, 'bipied', 0, 2)],
      startItems('viper'),
      startItems('sentinelle'),
    ];
    for (const b of builds) {
      for (const op of ['viper', 'sentinelle'] as const) {
        const good = estimateDps(computeLoadout(b, op, 100).loadout);
        const bad = estimateDps(computeLoadout(b.map((i, n) => ({ ...i, x: 20 + n * 8, y: 20 })), op, 100).loadout);
        // 13 % et plus : sans chargeur adjacent, une arme n'a que son propre chargeur pour le duel.
        // (La mêlée frappe où qu'elle soit rangée, et un fusil de précision ne vide pas son 1er chargeur en 20 s.)
        expect(bad / good).toBeLessThan(0.87);
      }
    }
  });

  it('en duel, le sac de départ bien rangé bat nettement le même sac en vrac', () => {
    for (const op of ['viper', 'sentinelle'] as const) {
      const loose = computeLoadout(startItems(op).map((i, n) => ({ ...i, x: 20 + n * 8, y: 20 })), op, maxHpFor(0)).loadout;
      expect(winRate(() => start(op), () => loose, 600), op).toBeGreaterThan(0.65);
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
    expect(r).toBeGreaterThan(0.4);
    expect(r).toBeLessThan(0.6);
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
    const hits = r.events.filter((e): e is Extract<DuelEvent, { kind: 'shot' }> => e.kind === 'shot' && e.from === 'b' && !e.miss);
    expect(Math.max(...hits.map((e) => e.hp))).toBeLessThanOrEqual(30);
    expect(hits.some((e) => e.hp < 30)).toBe(true);
    const full = winRate(() => a, () => a, 400);
    let low = 0;
    for (let s = 0; s < 400; s++) if (simulateDuel(a, a, s, { hpA: 35 }).win) low++;
    expect(low / 400).toBeLessThan(full - 0.2);
    expect(simulateDuel(a, a, 9, { hpA: 35 }).hpEndA).toBeLessThanOrEqual(35);
  });

  it('frag, flash et fumigène visent l’adversaire', () => {
    const items = [inst(1, 'pistolet', 2, 2), inst(2, 'chg_9mm', 4, 2), inst(3, 'frag', 2, 4), inst(4, 'flash', 3, 4), inst(5, 'fumigene', 5, 4)];
    const a = computeLoadout(items, 'viper', 100).loadout;
    const b = start('sentinelle');
    const r = simulateDuel(a, b, 3);
    const frag = r.events.find((e) => e.kind === 'frag');
    expect(frag && frag.kind === 'frag' && frag.side).toBe('a');
    expect(r.events.some((e) => e.kind === 'flash' && e.side === 'a')).toBe(true);
    expect(r.events.some((e) => e.kind === 'smoke' && e.side === 'a')).toBe(true);
  });
});

describe('mécaniques des opérateurs', () => {
  /** Cible sans arme, aux PV énormes : le duel va au temps limite. */
  const dummy = (over: Partial<PlayerLoadout> = {}): PlayerLoadout => ({
    maxHp: 1e6, armor: 0, weapons: [], melee: [], mags: [], actives: [], critMult: 2, armorRegen: 0, flatReduce: 0, markBonus: 0, families: [], ...over,
  });
  const gun = (uid: number, over: Partial<WeaponRt> = {}): WeaponRt => ({
    uid, name: `arme ${uid}`, dmg: 10, interval: 0.5, mag: 30, reload: 2, crit: 0, pellets: 1, firstCrit: false,
    armorPierce: 0, doubleEvery: 0, magUids: [], magReloads: 0, ownReloads: 99, buttDmg: 4, buttInterval: 1, critStun: 0, trueDmg: 0, heatRate: 0, heatCap: 0, markBoost: 0, ...over,
  });
  const shots = (evs: DuelEvent[], uid?: number) =>
    evs.filter((e): e is Extract<DuelEvent, { kind: 'shot' }> => e.kind === 'shot' && e.from === 'a' && (uid === undefined || e.uid === uid));

  it('Feu continu : la cadence monte en tirant, plafonne, et retombe à la recharge', () => {
    const a = dummy({ maxHp: 100, weapons: [gun(1, { heatRate: FEU_RATE, heatCap: FEU_CAP })] });
    const r = simulateDuel(a, dummy(), 3);
    const s = shots(r.events, 1);
    const reloadAt = r.events.find((e) => e.kind === 'reload')!.t;
    const before = s.filter((e) => e.t < reloadAt);
    expect(before[0].heat ?? 0).toBe(0);
    for (let i = 1; i < before.length; i++) expect(before[i].heat ?? 0).toBeGreaterThanOrEqual(before[i - 1].heat ?? 0);
    expect(Math.max(...s.map((e) => e.heat ?? 0))).toBeCloseTo(FEU_CAP);
    // Le 1er tir après la recharge repart de zéro.
    expect(s.find((e) => e.t > reloadAt)!.heat ?? 0).toBe(0);
    // Plus de tirs qu'avec la même arme sans Feu continu.
    const cold = simulateDuel(dummy({ maxHp: 100, weapons: [gun(1)] }), dummy(), 3);
    expect(s.length).toBeGreaterThan(shots(cold.events, 1).length * 1.1);
  });

  it('munitions par duel : son chargeur + un par chargeur adjacent, puis la crosse', () => {
    // Sans chargeur : 1 chargeur, aucune recharge, puis la crosse.
    const solo = computeLoadout([inst(1, 'pistolet', 2, 2)], 'viper', 300).loadout;
    expect(magsOf(solo.weapons[0])).toBe(1);
    const r = simulateDuel(solo, dummy(), 3);
    expect(r.events.some((e) => e.kind === 'reload' && e.side === 'a')).toBe(false);
    expect(shots(r.events, 1).filter((e) => !e.melee && !e.double).length).toBe(ITEMS.pistolet.weapon!.mag);
    const dry = r.events.find((e) => e.kind === 'dry' && e.side === 'a')!;
    expect(dry).toBeDefined();
    const butts = shots(r.events, 1).filter((e) => e.melee === 'crosse');
    expect(butts.length).toBeGreaterThan(10);
    expect(butts.every((e) => e.t > dry.t)).toBe(true);
    // Deux chargeurs adjacents : deux recharges, la dernière annoncée.
    const fed = computeLoadout([inst(1, 'pistolet', 2, 2), inst(2, 'chg_9mm', 3, 3), inst(3, 'chg_9mm', 2, 3)], 'viper', 300).loadout;
    expect(magsOf(fed.weapons[0])).toBe(3);
    const reloads = simulateDuel(fed, dummy(), 3).events.filter((e): e is Extract<DuelEvent, { kind: 'reload' }> => e.kind === 'reload' && e.side === 'a');
    expect(reloads.map((e) => e.left)).toEqual([1, 0]);
  });

  it('un chargeur adjacent à deux armes ne sert qu’une fois', () => {
    const a = computeLoadout([inst(1, 'pistolet', 2, 2), inst(2, 'chg_9mm', 2, 3), inst(3, 'pistolet', 2, 4)], 'viper', 300).loadout;
    expect(a.weapons.map(magsOf)).toEqual([2, 2]);
    const r = simulateDuel(a, dummy(), 4);
    expect(r.events.filter((e) => e.kind === 'reload' && e.side === 'a').length).toBe(1);
    expect(r.events.filter((e) => e.kind === 'dry' && e.side === 'a').length).toBe(2);
  });

  it('mêlée : frappe tout le duel, plus vite quand les armes à feu sont à sec', () => {
    const knife: MeleeRt = { uid: 9, name: 'couteau', dmg: 4, interval: 1, bleed: 0, armorPierce: 0 };
    const a = dummy({ maxHp: 100, weapons: [gun(1, { mag: 10, ownReloads: 0 })], melee: [knife] });
    const r = simulateDuel(a, dummy(), 2);
    const dryAt = r.events.find((e) => e.kind === 'dry')!.t;
    const cuts = shots(r.events, 9);
    expect(cuts.every((e) => e.melee === 'lame' && e.amount === 4)).toBe(true);
    const before = cuts.filter((e) => e.t < dryAt - 1).length / (dryAt - 1);
    const after = cuts.filter((e) => e.t > dryAt + 1 && e.t < dryAt + 21).length / 20;
    expect(before).toBeGreaterThan(0.8);
    expect(after / before).toBeCloseTo(MELEE_DRY_SPEED, 0);
  });

  it('saignement : ignore l’armure, se vide peu à peu ; le bandage le retire', () => {
    const blade: MeleeRt = { uid: 9, name: 'couteau de combat', dmg: 1, interval: 1, bleed: 4, armorPierce: 0 };
    const a = dummy({ maxHp: 100, melee: [blade] });
    const b = dummy({ maxHp: 100, armor: 1e6 });
    const r = simulateDuel(a, b, 1);
    const bleeds = r.events.filter((e): e is Extract<DuelEvent, { kind: 'bleed' }> => e.kind === 'bleed' && e.side === 'b');
    expect(bleeds.length).toBeGreaterThan(5);
    expect(bleeds[bleeds.length - 1].hp).toBeLessThan(100);
    // Le bandage se déclenche dès 8 de saignement.
    const items = [inst(1, 'bandage', 2, 2)];
    const withBandage = { ...computeLoadout(items, 'viper', 100).loadout, armor: 1e6 };
    const r2 = simulateDuel(a, withBandage, 1);
    const band = r2.events.find((e) => e.kind === 'bandage');
    expect(band && band.kind === 'bandage' && band.cured).toBeGreaterThan(0);
  });

  it('taser : se déclenche quand l’adversaire recharge et l’immobilise', () => {
    const a = computeLoadout([inst(1, 'taser', 2, 2)], 'viper', 300).loadout;
    const b = dummy({ maxHp: 300, weapons: [gun(1, { mag: 4, interval: 0.3 })] });
    const r = simulateDuel(a, b, 1);
    const tz = r.events.find((e): e is Extract<DuelEvent, { kind: 'taser' }> => e.kind === 'taser')!;
    const reload = r.events.find((e) => e.kind === 'reload' && e.side === 'b')!;
    expect(tz.t).toBeGreaterThanOrEqual(reload.t);
    expect(tz.until - tz.t).toBeCloseTo(1.5);
    // Plus aucun tir adverse pendant l'immobilisation (recharge comprise).
    expect(r.events.some((e) => e.kind === 'shot' && e.from === 'b' && e.t > tz.t && e.t < tz.until)).toBe(false);
  });

  it('Marque : un critique marque, la touche suivante d’une AUTRE arme fait +50 % et consomme la marque', () => {
    const a = dummy({ maxHp: 100, markBonus: MARK_BONUS, weapons: [gun(1, { crit: 0.5 }), gun(2, { crit: 0.5, interval: 0.7 })] });
    const r = simulateDuel(a, dummy(), 8);
    let markedBy = -1;
    let consumed = 0;
    for (const e of shots(r.events)) {
      if (e.miss) continue;
      if (markedBy >= 0 && markedBy !== e.uid) {
        expect(e.marked).toBe(true);
        expect(e.amount).toBe(Math.round(10 * ((e.crit ? 2 : 1) + MARK_BONUS)));
        markedBy = -1;
        consumed++;
      } else {
        expect(e.marked).toBeUndefined();
        expect(e.amount).toBe(e.crit ? 20 : 10);
      }
      if (e.crit && markedBy < 0) {
        expect(e.mark).toBe(true);
        markedBy = e.uid;
      }
    }
    expect(consumed).toBeGreaterThan(10);
    // Une seule arme : rien à consommer, donc pas de marque du tout.
    const solo = simulateDuel(dummy({ maxHp: 100, markBonus: MARK_BONUS, weapons: [gun(1, { crit: 0.5 })] }), dummy(), 8);
    expect(shots(solo.events).some((e) => e.mark || e.marked)).toBe(false);
    // Sans le passif (Viper), ni marque ni bonus.
    const viper = simulateDuel(dummy({ maxHp: 100, weapons: [gun(1, { crit: 0.5 }), gun(2, { crit: 0.5 })] }), dummy(), 8);
    expect(shots(viper.events).some((e) => e.mark || e.marked)).toBe(false);
  });

  it('la réduction par balle ne retire jamais plus de 25 % des dégâts', () => {
    const a = dummy({ maxHp: 100, weapons: [gun(1, { dmg: 6 })] });
    const r = simulateDuel(a, dummy({ flatReduce: 50 }), 1);
    const hit = shots(r.events).filter((e) => !e.miss);
    expect(hit.length).toBeGreaterThan(10);
    for (const e of hit) expect(e.amount).toBe(Math.round(6 * (1 - MAX_FLAT_REDUCE)));
    // Une grosse balle perd toujours la valeur entière de la réduction (2 sur 40).
    const big = simulateDuel(dummy({ maxHp: 100, weapons: [gun(1, { dmg: 40 })] }), dummy({ flatReduce: 2 }), 1);
    for (const e of shots(big.events).filter((x) => !x.miss)) expect(e.amount).toBe(38);
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
      expect(w / 300).toBeGreaterThan(0.45);
      expect(w / 300).toBeLessThan(0.7);
    }
  });

  it('1er cercle : bots fraîchement largués, quelle que soit la taille de la zone (jamais forts, sans objet assemblé, sac de base)', () => {
    for (const danger of [0, 0.5, 1]) {
      for (let s = 0; s < 150; s++) {
        const b = generateBot(s, 0, { danger });
        expect(b.quality).not.toBe('fort');
        expect(b.usable.length).toBe(20);
        expect(b.items.length).toBeLessThanOrEqual(5); // 4 objets + l'arme de mêlée
        expect(b.items.every((i) => !ITEMS[i.defId].crafted)).toBe(true);
      }
    }
  });

  it('le sac de départ (sans assemblage) gagne au moins 60 % contre les bots du 1er cercle, toute zone', () => {
    for (const op of ['viper', 'sentinelle'] as const) {
      for (const danger of [0, 0.5, 1]) {
        const rate = winRate(() => start(op), (s) => botLoadout(generateBot(s, 0, { danger })), 300);
        expect(rate, `${op} danger ${danger}`).toBeGreaterThanOrEqual(0.6);
      }
    }
  });

  it('Viper contre Sentinelle : entre 45 et 55 % à chaque manche et au Top 1 (bots de même tour)', () => {
    const N = 300;
    for (const round of [0, 1, 2, 3, 4, 5]) {
      const v: BotBuild[] = [];
      const s: BotBuild[] = [];
      for (let k = 0; v.length < N || s.length < N; k++) {
        const b = round === 5 ? generateBot(k, 5, { final: true }) : generateBot(k, round);
        (b.operator === 'viper' ? v : s).push(b);
      }
      let w = 0;
      for (let i = 0; i < N; i++) {
        const a = botLoadout(v[i]);
        const b = botLoadout(s[i]);
        // Chaque paire joue les deux côtés.
        if (simulateDuel(a, b, i * 2).win) w++;
        if (!simulateDuel(b, a, i * 2 + 1).win) w++;
      }
      const rate = w / (2 * N);
      expect(rate, `manche ${round}`).toBeGreaterThan(0.45);
      expect(rate, `manche ${round}`).toBeLessThan(0.55);
    }
  });
});
