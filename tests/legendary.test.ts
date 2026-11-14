import { describe, expect, it } from 'vitest';
import { ITEMS, LEGENDARY_IDS, LOOT_IDS } from '../src/data/items';
import { ARCHETYPES, ARCHETYPE_IDS } from '../src/data/archetypes';
import { generateBot } from '../src/logic/bots';
import { DuelEvent, simulateDuel } from '../src/logic/combat';
import { ItemInst, Rot } from '../src/logic/grid';
import { duelReport } from '../src/logic/report';
import { legendaryPool, newRun, ownsItem } from '../src/logic/run';
import { computeLoadout, describe as describeItem } from '../src/logic/stats';
import { tierOf } from '../src/logic/tier';

const inst = (uid: number, defId: string, x: number, y: number, rot: Rot = 0): ItemInst => ({ uid, defId, rot, x, y, placed: true });
const gun = (uid = 1): ItemInst[] => [inst(uid, 'fusil_assaut', 2, 2), inst(uid + 1, 'chg_556', 2, 3)];
const L = (items: ItemInst[], wins = 0, hp = 300) => computeLoadout(items, 'viper', hp, { wins }).loadout;
const evs = (a: ItemInst[], b: ItemInst[], seed = 1, hp = 300) => simulateDuel(L(a, 0, hp), L(b, 0, hp), seed).events as DuelEvent[];

describe('objets légendaires', () => {
  it('niveau Légendaire, hors du butin ordinaire, chacun change une règle', () => {
    expect(LEGENDARY_IDS.length).toBeGreaterThanOrEqual(9);
    for (const id of LEGENDARY_IDS) {
      expect(tierOf(id)).toBe(2);
      expect(LOOT_IDS).not.toContain(id);
      expect(ITEMS[id].keystone, id).toBeTruthy();
      expect(ITEMS[id].minRound).toBeGreaterThanOrEqual(1);
      expect(describeItem({ defId: id }).lines.some((l) => l.includes('Légendaire'))).toBe(true);
    }
  });

  it("Médaille de l'ange gardien : relève une fois, à 35 % des PV", () => {
    const e = evs([...gun(), inst(5, 'smg', 5, 4), inst(6, 'chg_9mm', 5, 6), inst(7, 'ration', 0, 0)], [...gun(), inst(9, 'ange_gardien', 6, 6)], 3);
    const rev = e.filter((x) => x.kind === 'revive');
    expect(rev.length).toBe(1);
    expect(rev[0]).toMatchObject({ side: 'b', uid: 9, hp: Math.round(300 * 0.35) });
  });

  it('Bouclier anti-émeute : les 6 premières touches reçues sont bloquées', () => {
    const e = evs(gun(), [...gun(10), inst(12, 'bouclier_emeute', 5, 2)], 2);
    const blocked = e.filter((x) => x.kind === 'shot' && x.from === 'a' && x.blocked);
    expect(blocked.length).toBe(6);
    const firstHit = e.findIndex((x) => x.kind === 'shot' && x.from === 'a' && !x.miss && !x.blocked);
    const lastBlock = e.findIndex((x) => x === blocked[5]);
    expect(firstHit).toBeGreaterThan(lastBlock);
    const rep = duelReport({ events: e }, L(gun()), L([...gun(10), inst(12, 'bouclier_emeute', 5, 2)]));
    expect(rep.b.items.find((r) => r.uid === 12)?.blocked).toBe(6);
  });

  it('Poche de sang : le vol de vie soigne pendant le duel', () => {
    const e = evs([...gun(), inst(5, 'poche_sang', 6, 2)], gun(10), 4, 600);
    const heals = e.filter((x) => x.kind === 'heal' && x.side === 'a' && x.uid === 5);
    expect(heals.length).toBeGreaterThan(0);
  });

  it('Détonateur de recharge : un éclat à chaque recharge', () => {
    const e = evs([...gun(), inst(5, 'detonateur', 6, 2)], [...gun(10), inst(12, 'plaque', 5, 4)], 5, 900);
    const reloads = e.filter((x) => x.kind === 'reload' && x.side === 'a').length;
    const blasts = e.filter((x) => x.kind === 'frag' && x.side === 'a' && x.uid === 5).length;
    expect(reloads).toBeGreaterThan(0);
    expect(blasts).toBe(reloads);
  });

  it('Lunette thermique : les critiques posent de la Brûlure', () => {
    const e = evs([...gun(), inst(5, 'lunette_thermique', 6, 2)], gun(10), 6, 900);
    const crits = e.filter((x) => x.kind === 'shot' && x.from === 'a' && x.crit);
    expect(crits.length).toBeGreaterThan(0);
    for (const c of crits) if (c.kind === 'shot') expect(c.burn).toBeGreaterThanOrEqual(3);
  });

  it('Condensateur : 5 Choc toutes les 8 touches (décharges)', () => {
    const e = evs([...gun(), inst(5, 'condensateur', 6, 2)], gun(10), 7, 900);
    expect(e.some((x) => x.kind === 'discharge' && x.side === 'b')).toBe(true);
  });

  it('Plaques du vétéran : +1 dégât par duel gagné, plafonné à +10', () => {
    const base = L(gun(), 0).weapons[0].dmg;
    expect(L([...gun(), inst(5, 'plaques_veteran', 6, 2)], 4).weapons[0].dmg).toBeCloseTo(base + 4);
    expect(L([...gun(), inst(5, 'plaques_veteran', 6, 2)], 30).weapons[0].dmg).toBeCloseTo(base + 10);
  });

  it('Insigne des Lames et Cocktail de combat', () => {
    const knife = L([inst(1, 'couteau', 2, 2), inst(2, 'insigne_lames', 6, 6)]).melee[0];
    expect(knife.bleed).toBe(4);
    expect(knife.interval).toBeCloseTo(1 / 1.25);
    const ck = L([...gun(), inst(5, 'cocktail', 6, 6)]);
    expect(ck.endMax).toBe(16);
    expect(ck.endRegen).toBeCloseTo(1.4);
  });

  it('apparition : jamais au 1er cercle, unique par partie', () => {
    const run = newRun('viper', 42);
    expect(legendaryPool(run)).toEqual([]);
    run.round = 1;
    expect(legendaryPool(run).length).toBeGreaterThan(0);
    run.items.push({ uid: 999, defId: 'ange_gardien', rot: 0, x: 0, y: 0, placed: false });
    expect(ownsItem(run, 'ange_gardien')).toBe(true);
    expect(legendaryPool(run)).not.toContain('ange_gardien');
  });

  it('le bot du Top 1 porte un légendaire de son plan ; les archétypes en ont tous', () => {
    for (const id of ARCHETYPE_IDS) expect(ARCHETYPES[id].legendaries.length).toBeGreaterThan(0);
    let withLeg = 0;
    for (let s = 0; s < 20; s++) {
      const b = generateBot(500 + s, 5, { final: true, danger: 2 });
      if (b.items.some((i) => ITEMS[i.defId].legendary)) withLeg++;
    }
    expect(withLeg).toBeGreaterThanOrEqual(16);
  });
});
