import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { DuelEvent, simulateDuel } from '../src/logic/combat';
import { ItemInst, Rot } from '../src/logic/grid';
import { autoCraft } from '../src/logic/recipes';
import { endAction, newRun, roundIncome } from '../src/logic/run';
import { TACTIQUE_SPEED, computeLoadout } from '../src/logic/stats';

const inst = (uid: number, defId: string, x: number, y: number, rot: Rot = 0): ItemInst => ({ uid, defId, rot, x, y, placed: true });
const L = (items: ItemInst[], hp = 300) => computeLoadout(items, 'viper', hp).loadout;

describe('contenu v3 : drones, radio, Molotov, pointes creuses, économie', () => {
  it('le drone tire sans Endurance, même quand le sac est essoufflé', () => {
    const l = L([inst(1, 'drone', 0, 0), inst(2, 'fusil_assaut', 2, 2), inst(3, 'chg_556', 2, 3)], 2000);
    const drone = l.weapons.find((w) => w.uid === 1)!;
    expect(drone.endCost).toBe(0);
    expect(drone.drone).toBe(true);
    const ev = simulateDuel(l, L([inst(9, 'plaque', 0, 0)], 2000), 1).events as DuelEvent[];
    expect(ev.some((e) => e.kind === 'tired' && e.side === 'a' && e.uid === 1)).toBe(false);
    expect(ev.filter((e) => e.kind === 'shot' && e.from === 'a' && e.uid === 1).length).toBeGreaterThan(20);
  });

  it('palier 4 de Tactique : drones et radios 30 % plus rapides', () => {
    const solo = L([inst(1, 'drone', 0, 0), inst(2, 'radio', 2, 0)]);
    const four = L([inst(1, 'drone', 0, 0), inst(2, 'radio', 2, 0), inst(3, 'taser', 4, 0), inst(4, 'couteau', 6, 0)]);
    expect(four.families.find((f) => f.family === 'tactique')!.tier).toBe(2);
    expect(four.weapons[0].interval).toBeCloseTo(solo.weapons[0].interval / TACTIQUE_SPEED);
    const cd = (l: ReturnType<typeof L>) => l.actives.find((a) => a.uid === 2)!.cooldown;
    expect(cd(four)).toBeCloseTo(cd(solo) / TACTIQUE_SPEED);
  });

  it("la radio frappe sans coûter d'Endurance ; le Molotov brûle", () => {
    const radio = L([inst(1, 'radio', 0, 0)]).actives[0];
    expect(radio.strike).toBe(true);
    const mol = L([inst(1, 'molotov', 0, 0)]).actives[0];
    expect(mol.burn).toBe(5);
    const ev = simulateDuel(L([inst(1, 'radio', 0, 0), inst(2, 'pistolet', 3, 3), inst(3, 'chg_9mm', 5, 3)]), L([inst(9, 'casque', 0, 0)]), 2).events as DuelEvent[];
    expect(ev.some((e) => e.kind === 'frag' && e.side === 'a' && e.uid === 1)).toBe(true);
  });

  it("pointes creuses : +20 % de dégâts à l'arme touchée, sans l'alimenter", () => {
    const base = L([inst(1, 'pistolet', 2, 2)]).weapons[0];
    const hp = L([inst(1, 'pistolet', 2, 2), inst(2, 'pointe_creuse', 2, 3)]).weapons[0];
    expect(hp.dmg).toBeCloseTo(base.dmg * 1.2);
    expect(hp.fed).toBe(false);
  });

  it("Caisse de l'intendant : des crédits à chaque nouveau cercle, de plus en plus", () => {
    const run = newRun('viper', 3);
    run.pendingLoot = undefined;
    run.items.push(inst(500, 'tirelire', 0, 0));
    run.round = 1;
    expect(roundIncome(run)).toBe(2);
    run.round = 3;
    expect(roundIncome(run)).toBe(4);
    run.items.find((i) => i.uid === 500)!.placed = false;
    expect(roundIncome(run)).toBe(0);
    // Passage de cercle réel : la dernière action d'une zone paie.
    run.items.find((i) => i.uid === 500)!.placed = true;
    run.round = 0;
    run.zoneId = 0;
    run.actionsLeft = 1;
    const before = run.credits;
    expect(endAction(run)?.nextRound).toBe(true);
    expect(run.credits - before).toBe(2);
    expect(run.lastIncome).toBe(2);
  });

  it('nouvelles recettes : drone + batterie, radio + frag, molotov ×2, et l’Essaim de rang 2', () => {
    for (const out of ['drone_assaut', 'appui_mortier', 'designateur', 'bidon_napalm', 'essaim', 'coffre_fort']) {
      expect(RECIPES.some((r) => r.output === out), out).toBe(true);
      expect(ITEMS[out].crafted).toBe(true);
    }
    const run = newRun('viper', 5);
    run.pendingLoot = undefined;
    run.items = [inst(1, 'drone', 2, 2), inst(2, 'batterie', 4, 2), inst(3, 'radio', 2, 4), inst(4, 'frag', 3, 4)];
    run.nextUid = 10;
    const done = autoCraft(run).map((c) => c.recipe.output);
    expect(done).toContain('drone_assaut');
    expect(done).toContain('appui_mortier');
    expect(done).toContain('essaim');
    expect(run.items.map((i) => i.defId)).toEqual(['essaim']);
  });
});

describe('Sapeur : Réaction en chaîne', () => {
  it('chaque explosion renforce les suivantes, plafonné ; seul le Sapeur en profite', async () => {
    const { CHAIN_DMG, CHAIN_MAX } = await import('../src/logic/stats');
    const items = [inst(1, 'charge_c4', 0, 0), inst(2, 'frag', 2, 0), inst(3, 'sous_munitions', 3, 0), inst(4, 'molotov', 4, 0)];
    const sap = computeLoadout(items, 'sapeur', 3000).loadout;
    expect(sap.chain).toEqual({ dmg: CHAIN_DMG, cd: expect.any(Number), max: CHAIN_MAX });
    expect(computeLoadout(items, 'viper', 3000).loadout.chain).toBeUndefined();
    expect(computeLoadout([...items, inst(5, 'amorces', 5, 0)], 'sapeur', 3000).loadout.chain!.max).toBe(CHAIN_MAX + 2);
    const ev = simulateDuel(sap, L([inst(9, 'casque', 0, 0)], 3000), 3).events as DuelEvent[];
    const frags = ev.filter((e) => e.kind === 'frag' && e.side === 'a' && e.uid === 2);
    // La 2e frag tombe après d'autres explosions : plus forte que la valeur de base (étoiles comprises).
    expect(frags.length).toBeGreaterThanOrEqual(2);
    if (frags[1].kind === 'frag' && frags[0].kind === 'frag') expect(frags[1].amount).toBeGreaterThan(frags[0].amount);
  });
});
