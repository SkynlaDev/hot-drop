import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { OPERATORS, OperatorId, lootPool } from '../src/data/operators';
import { ARCHETYPES, ARCHETYPE_IDS } from '../src/data/archetypes';
import { BotBuild, botLoadout, generateBot } from '../src/logic/bots';
import { BURN_MAX, DISCHARGE_STUN, DuelEvent, MAX_FLAT_REDUCE, MAX_TIME, simulateDuel } from '../src/logic/combat';
import { ItemInst, Rot, canPlace, cellKey, cellsOf } from '../src/logic/grid';
import { DRUM_RELOAD, FEU_CAP, FEU_RATE, MARK_BONUS, MELEE_ONLY_SPEED, MeleeRt, PlayerLoadout, UNFED_RELOAD, WeaponRt, computeLoadout, describe as describeItem, estimateDps, maxHpFor } from '../src/logic/stats';

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
    // Pool commun : seules les signatures sont réservées.
    expect(lootPool('viper')).toContain('colibri');
    expect(lootPool('viper')).not.toContain('tracantes');
    expect(lootPool('sentinelle')).not.toContain('chg_tambour');
  });

  it('les pompes touchent deux fois par tir', () => {
    const w = computeLoadout([inst(1, 'pompe', 2, 2)], 'viper', 100).loadout.weapons[0];
    expect(w.pellets).toBe(2);
  });

  it("les fiches ne parlent plus de gilet, d'Établi ni d'escouade", () => {
    for (const id of Object.keys(ITEMS)) {
      const text = describeItem(inst(1, id, 0, 0)).lines.join(' ');
      expect(text).not.toMatch(/Établi|escouade|Poitrine|Blindés|ennemi|rareté/i);
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
    maxHp: 1e6, armor: 0, weapons: [], melee: [], actives: [], critMult: 2, armorRegen: 0, flatReduce: 0, markBonus: 0, families: [], ...over,
  });
  const gun = (uid: number, over: Partial<WeaponRt> = {}): WeaponRt => ({
    uid, name: `arme ${uid}`, dmg: 10, interval: 0.5, mag: 30, reload: 2, crit: 0, pellets: 1, firstCrit: false,
    armorPierce: 0, doubleEvery: 0, fed: true, critStun: 0, trueDmg: 0, heatRate: 0, heatCap: 0, markBoost: 0, ...over,
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

  it('recharge sans fin ; sans chargeur de son calibre, la recharge est 2 fois plus lente', () => {
    const solo = computeLoadout([inst(1, 'pistolet', 2, 2)], 'viper', 300).loadout;
    const fed = computeLoadout([inst(1, 'pistolet', 2, 2), inst(2, 'chg_9mm', 3, 3)], 'viper', 300).loadout;
    expect(solo.weapons[0].fed).toBe(false);
    expect(fed.weapons[0].fed).toBe(true);
    expect(solo.weapons[0].reload).toBeCloseTo((fed.weapons[0].reload / 0.75) * UNFED_RELOAD);
    const r = simulateDuel(solo, dummy(), 3);
    expect(r.events.filter((e) => e.kind === 'reload' && e.side === 'a').length).toBeGreaterThan(5);
    expect(shots(r.events, 1).length).toBeGreaterThan(ITEMS.pistolet.weapon!.mag * 5);
  });

  it('mêlée : frappe tout le duel, 1,5 fois plus vite dans un sac sans arme à feu', () => {
    const knife: MeleeRt = { uid: 9, name: 'couteau', dmg: 4, interval: 1, bleed: 0, armorPierce: 0 };
    const withGun = simulateDuel(dummy({ maxHp: 100, weapons: [gun(1)], melee: [knife] }), dummy(), 2);
    const bladeOnly = simulateDuel(dummy({ maxHp: 100, melee: [knife] }), dummy(), 2);
    const cuts = (r: typeof withGun) => shots(r.events, 9).filter((e) => e.t >= 10 && e.t < 70).length / 60;
    expect(shots(withGun.events, 9).every((e) => e.melee === 'lame' && e.amount === 4)).toBe(true);
    expect(cuts(withGun)).toBeCloseTo(1, 1);
    // Le pas de simulation (0,05 s) arrondit l'intervalle : à 10 % près.
    expect(Math.abs(cuts(bladeOnly) / cuts(withGun) - MELEE_ONLY_SPEED)).toBeLessThan(0.15);
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
    expect(b.items.some((i) => ITEMS[i.defId].weapon || ITEMS[i.defId].melee)).toBe(true);
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

  it('Viper contre Sentinelle : entre 44 et 56 % à chaque manche et au Top 1 (bots de même tour)', () => {
    // 600 paires : avec 300, un échantillon malchanceux sortait de la marge alors que la vraie valeur était au milieu
    // (5e cercle mesuré à 46-48 % sur 2 400 duels, contenu v3).
    const N = 600;
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
      // 1 200 duels : l'écart-type d'échantillon est d'environ 1,5 point ; marge de 6 points.
      expect(rate, `manche ${round}`).toBeGreaterThan(0.44);
      expect(rate, `manche ${round}`).toBeLessThan(0.56);
    }
  });
});

describe('archétypes des bots', () => {
  it('chaque archétype apparaît, et un bot suit son plan (4e cercle)', () => {
    const seen = new Map<string, number>();
    const share = new Map<string, number>();
    for (let s = 0; s < 400; s++) {
      const b = generateBot(s, 3);
      seen.set(b.archetype, (seen.get(b.archetype) ?? 0) + 1);
      const A = ARCHETYPES[b.archetype];
      const plan = new Set([...A.weapons, ...A.crafted, ...A.extras]);
      share.set(b.archetype, (share.get(b.archetype) ?? 0) + b.items.filter((i) => plan.has(i.defId)).length / b.items.length);
      if (b.archetype === 'lame') expect(b.items.some((i) => ITEMS[i.defId].weapon)).toBe(false);
    }
    for (const id of ARCHETYPE_IDS) {
      expect(seen.get(id) ?? 0, id).toBeGreaterThan(10);
      // En moyenne, plus de la moitié du sac vient du plan (le reste : thème de zone, pool cœur).
      expect(share.get(id)! / seen.get(id)!, id).toBeGreaterThan(0.5);
    }
  });

  it('aucun archétype n’écrase les autres ni ne s’effondre (bots de même tour)', () => {
    for (const round of [1, 3, 5]) {
      const w = new Map<string, [number, number]>();
      for (let s = 0; s < 500; s++) {
        const opts = round === 5 ? { final: true } : {};
        const a = generateBot(s * 2 + 1, Math.min(round, 4), opts);
        const b = generateBot(s * 2 + 2, Math.min(round, 4), opts);
        const win = simulateDuel(botLoadout(a), botLoadout(b), s).win;
        for (const [k, v] of [[a.archetype, win], [b.archetype, !win]] as const) {
          const x = w.get(k) ?? [0, 0];
          x[0] += v ? 1 : 0;
          x[1]++;
          w.set(k, x);
        }
      }
      // Garde-fou large : les écarts connus (Akimbo et Démolition forts, Rempart et Feu continu faibles en fin de
      // partie, liés à la densité des objets) sont à corriger en phase 2 (design/PHASE1.md).
      for (const [k, [won, n]] of w) {
        if (n < 40) continue;
        expect(won / n, `${k} au cercle ${round + 1}`).toBeGreaterThan(0.2);
        expect(won / n, `${k} au cercle ${round + 1}`).toBeLessThan(0.8);
      }
    }
  });
});

describe('combat v2 : Endurance, Brûlure, Choc', () => {
  const dummy = (over: Partial<PlayerLoadout> = {}): PlayerLoadout => ({
    maxHp: 1e6, armor: 0, weapons: [], melee: [], actives: [], critMult: 2, armorRegen: 0, flatReduce: 0, markBonus: 0, families: [], ...over,
  });
  const gun = (uid: number, over: Partial<WeaponRt> = {}): WeaponRt => ({
    uid, name: `arme ${uid}`, dmg: 10, interval: 0.5, mag: 30, reload: 2, crit: 0, pellets: 1, firstCrit: false,
    armorPierce: 0, doubleEvery: 0, fed: true, critStun: 0, trueDmg: 0, heatRate: 0, heatCap: 0, markBoost: 0, ...over,
  });
  const ofKind = <K extends DuelEvent['kind']>(evs: DuelEvent[], k: K) => evs.filter((e): e is Extract<DuelEvent, { kind: K }> => e.kind === k);

  it('Brûlure : dégâts réguliers qui ignorent l’armure, plafonnés, et qui s’éteignent', () => {
    const a = dummy({ maxHp: 100, weapons: [gun(1, { dmg: 1, burn: 1 })] });
    const target = dummy({ armor: 1e5 });
    const r = simulateDuel(a, target, 1);
    const ticks = ofKind(r.events, 'burn').filter((e) => e.side === 'b');
    expect(ticks.length).toBeGreaterThan(10);
    expect(Math.max(...ticks.map((e) => e.stacks))).toBeLessThanOrEqual(BURN_MAX);
    // L'armure énorme ne bouge pas les PV par les balles, mais la Brûlure les entame.
    expect(ticks[ticks.length - 1].hp).toBeLessThan(1e6);
    // Combinaison : la moitié de la Brûlure en moins.
    const resist = simulateDuel(a, dummy({ armor: 1e5, burnResist: 0.5 }), 1);
    const sum = (evs: DuelEvent[]) => ofKind(evs, 'burn').reduce((t, e) => t + e.amount, 0);
    expect(sum(resist.events)).toBeCloseTo(sum(r.events) / 2, -1);
  });

  it('Choc : décharge au seuil, qui retarde les armes et éteint le Feu continu', () => {
    const a = dummy({ maxHp: 1e6, weapons: [gun(1, { dmg: 1, shock: 1, interval: 0.4 })] });
    const viper = dummy({ maxHp: 1e6, weapons: [gun(9, { dmg: 1, heatRate: FEU_RATE, heatCap: FEU_CAP, mag: 1000 })] });
    const r = simulateDuel(a, viper, 2);
    const dis = ofKind(r.events, 'discharge').filter((e) => e.side === 'b');
    expect(dis.length).toBeGreaterThan(3);
    // Juste après une décharge, le Feu continu adverse est retombé à zéro.
    const t0 = dis[2].t;
    const next = ofKind(r.events, 'shot').find((e) => e.from === 'b' && e.t > t0);
    expect(next?.heat ?? 0).toBeLessThan(0.05);
    expect(next!.t - t0).toBeGreaterThanOrEqual(DISCHARGE_STUN - 0.06);
    // Seuil relevé (plaque isolante) : moins de décharges ; immunité : pas de retard ni de remise à zéro.
    const insulated = simulateDuel(a, { ...viper, shockThreshold: 8 }, 2);
    expect(ofKind(insulated.events, 'discharge').length).toBeLessThan(dis.length);
  });

  it('Endurance : deux armes tiennent, quatre s’essoufflent', () => {
    const many = (n: number) => dummy({
      maxHp: 1e6, endMax: 10, endRegen: 1,
      weapons: Array.from({ length: n }, (_, i) => gun(i + 1, { dmg: 1, interval: 0.5, endCost: 0.3, mag: 1000 })),
    });
    const shotsOf = (n: number) => ofKind(simulateDuel(many(n), dummy(), 4).events, 'shot').filter((e) => e.from === 'a').length;
    const two = shotsOf(2);
    const four = shotsOf(4);
    expect(four).toBeLessThan(two * 1.5); // sans Endurance, ce serait le double
    expect(ofKind(simulateDuel(many(4), dummy(), 4).events, 'tired').length).toBeGreaterThan(0);
    expect(ofKind(simulateDuel(many(1), dummy(), 4).events, 'tired').length).toBe(0);
  });

  it('Bobine Tesla : chaque décharge frappe en plus, sans passer par l’armure', () => {
    const a = dummy({ maxHp: 1e6, dischargeDmg: 30, weapons: [gun(1, { dmg: 1, shock: 1, interval: 0.4 })] });
    const r = simulateDuel(a, dummy({ armor: 1e5 }), 3);
    const dis = ofKind(r.events, 'discharge');
    expect(dis.length).toBeGreaterThan(3);
    for (const e of dis) expect(e.amount).toBe(30);
    expect(r.hpEndB).toBeLessThanOrEqual(1e6 - 30 * dis.length);
  });

  it('KR-4 Mitrailleur : le Feu continu ne retombe pas à la recharge', () => {
    const w = (heatKeep: boolean) => gun(1, { dmg: 1, mag: 5, reload: 0.5, heatRate: FEU_RATE, heatCap: FEU_CAP, heatKeep });
    const first = (keep: boolean) => {
      const r = simulateDuel(dummy({ maxHp: 1e6, weapons: [w(keep)] }), dummy(), 5);
      const rel = ofKind(r.events, 'reload')[1].t;
      return ofKind(r.events, 'shot').find((e) => e.t > rel)?.heat ?? 0;
    };
    expect(first(true)).toBeGreaterThan(first(false));
  });

  it('reste déterministe', () => {
    const a = botLoadout(generateBot(5, 3));
    const b = botLoadout(generateBot(6, 3));
    expect(simulateDuel(a, b, 9)).toEqual(simulateDuel(a, b, 9));
  });
});
