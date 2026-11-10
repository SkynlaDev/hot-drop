import { beforeEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { lootPool } from '../src/data/operators';
import { autoCraft, craft, findCraftable } from '../src/logic/recipes';
import {
  BASE_CELLS, BagInst, COLS, ItemInst, ROWS, Rot, bagsConnected, canMoveBag, canPlace, canPlaceBag, canRemoveBag, cellsAt,
  maskOf, rotationIsNoop, sharedEdge, usableCells,
} from '../src/logic/grid';
import { MAX_RARITY, ROUND_ODDS, rollRarity } from '../src/logic/rarity';
import { mulberry32, rngFor } from '../src/logic/rng';
import {
  BAG_RESERVE_MAX, DuelParams, FINAL_ROUND, RESERVE_MAX, RunState, addBags, addDrops, buyOffer, canFuse, clearRun, currentDuel,
  dropInZone, endAction, finalDuelParams, fuse, goulagParams, loadRun, newRun, placeBag, playCard, rerollShop, reserve,
  resolveDuel, resolveGoulag, roundMaxHp, sanitizeLayout, saveRun, selectableZones, shopOffers, unplaceBag,
} from '../src/logic/run';
import {
  ACTIONS_PER_ZONE, CARDS_BY_SIZE, MapZone, ROUNDS, ZONE_COUNT, circle, dist, drawCards, genMap, isFight, isGassed, zonesInCircle,
} from '../src/logic/zone';

const inst = (uid: number, defId: string, x: number, y: number, rarity = 0, rot: Rot = 0): ItemInst => ({ uid, defId, rarity, rot, x, y, placed: true });
const bag = (uid: number, defId: string, x: number, y: number, rot: Rot = 0, placed = true): BagInst => ({ uid, defId, rot, x, y, placed });
const BASE = new Set(BASE_CELLS);
const botItems = (): ItemInst[] => [inst(900, 'pistolet', 2, 2), inst(901, 'chg_9mm', 4, 2), inst(902, 'casque', 2, 4)];

/** Joue une carte et la termine (duels gagnés, pleine vie). */
function playThrough(run: RunState, index: number, win = true): void {
  const r = playCard(run, index);
  expect(r).not.toBeNull();
  if (r!.kind === 'duel') {
    let res = resolveDuel(run, { win, hpEnd: 50, botItems: botItems() });
    while (res.next) res = resolveDuel(run, { win, hpEnd: 50, botItems: botItems() });
    if (res.actionDone && !run.over) endAction(run);
  } else {
    endAction(run);
  }
}

/** Index de la première carte non jouée d'un type donné (ou n'importe laquelle). */
const firstCard = (run: RunState, pred: (t: string) => boolean = () => true) =>
  run.cards.findIndex((c, i) => !run.played.includes(i) && pred(c.type));

describe('grille', () => {
  it('9×8, sac de base en colonnes 2 à 6 et lignes 2 à 5', () => {
    expect(COLS).toBe(9);
    expect(ROWS).toBe(8);
    expect(BASE_CELLS.length).toBe(20);
    expect(BASE.has('2,2') && BASE.has('6,5')).toBe(true);
    expect(BASE.has('1,2') || BASE.has('7,5') || BASE.has('2,1') || BASE.has('2,6')).toBe(false);
  });

  it('refuse le hors-grille, les cases inutilisables et les chevauchements', () => {
    const items = [inst(1, 'casque', 2, 2)];
    const p = { ...inst(2, 'pistolet', 0, 0), placed: false };
    expect(canPlace(items, p, 2, 2, 0, BASE)).toBe(false); // chevauche
    expect(canPlace(items, p, 8, 0, 0)).toBe(false); // dépasse de la grille
    expect(canPlace(items, p, 0, 0, 0)).toBe(true); // dans la grille…
    expect(canPlace(items, p, 0, 0, 0, BASE)).toBe(false); // … mais hors du sac
    expect(canPlace(items, p, 4, 2, 0, BASE)).toBe(true);
  });

  it('tourne les formes de 90° dans le sens horaire', () => {
    // Pistolet en L : XX / X.
    expect(maskOf('pistolet', 1)).toEqual([[true, true], [false, true]]);
    expect(cellsAt({ defId: 'pistolet', rot: 0 }, 0, 0)).toEqual([[0, 0], [1, 0], [0, 1]]);
    expect(rotationIsNoop('casque', 0)).toBe(true);
    expect(rotationIsNoop('lunette', 0)).toBe(false);
  });

  it('détecte les bords partagés', () => {
    const a = inst(1, 'chg_9mm', 2, 2);
    expect(sharedEdge(a, inst(2, 'chg_9mm', 3, 2))).toEqual({ cx: 2, cy: 2, dx: 1, dy: 0 });
    expect(sharedEdge(a, inst(3, 'chg_9mm', 3, 3))).toBeNull();
  });
});

describe('sacoches', () => {
  it('les formes des sacoches passent par maskOf', () => {
    expect(maskOf('pochette', 0)).toEqual([[true, true]]);
    expect(maskOf('pochette', 1)).toEqual([[true], [true]]);
    expect(maskOf('sac_tactique', 0).length).toBe(3);
    expect(maskOf('ceinture', 1).length).toBe(4);
  });

  it('une sacoche posée ajoute ses cases aux cases utilisables', () => {
    const bags = [bag(1, 'sacoche', 7, 2), bag(2, 'pochette', 0, 0, 0, false)];
    const u = usableCells(bags);
    expect(u.size).toBe(24);
    for (const k of ['7,2', '8,2', '7,3', '8,3']) expect(u.has(k)).toBe(true);
    expect(u.has('0,0')).toBe(false); // sacoche en réserve
  });

  it('une sacoche doit toucher le sac ou une sacoche, sans chevauchement', () => {
    const b = bag(1, 'pochette', 0, 0, 0, false);
    expect(canPlaceBag([b], [], b, 7, 2, 0)).toBe(true); // collée à droite du sac
    expect(canPlaceBag([b], [], b, 2, 1, 0)).toBe(true); // au-dessus
    expect(canPlaceBag([b], [], b, 0, 0, 0)).toBe(false); // isolée
    expect(canPlaceBag([b], [], b, 6, 2, 0)).toBe(false); // sur le sac de base
    expect(canPlaceBag([b], [], b, 8, 2, 0)).toBe(false); // dépasse de la grille
    const other = bag(2, 'ceinture', 7, 2, 1); // verticale en colonne 7, lignes 2 à 5
    expect(canPlaceBag([b, other], [], b, 7, 4, 1)).toBe(false); // chevauche
    expect(canPlaceBag([b, other], [], b, 8, 2, 1)).toBe(true); // touche la ceinture seulement
  });

  it('on ne déplace pas une sacoche chargée, ni une sacoche qui en retient une autre', () => {
    const s = bag(1, 'sacoche', 7, 2);
    const p = bag(2, 'pochette', 7, 4, 1); // sous la sacoche, touche aussi le sac
    const items = [inst(10, 'chg_9mm', 8, 3)];
    expect(canMoveBag(items, s)).toBe(false);
    expect(canPlaceBag([s, p], items, s, 0, 2, 0)).toBe(false);
    expect(canMoveBag([], s)).toBe(true);
    // Pochette accrochée uniquement à la sacoche (colonne 8, lignes 4-5) : retirer la sacoche la détacherait.
    const p2 = bag(3, 'pochette', 8, 4, 1);
    expect(bagsConnected([s, p2])).toBe(true);
    expect(canRemoveBag([s, p2], [], s)).toBe(false);
    expect(canRemoveBag([s, p2], [], p2)).toBe(true);
  });

  it('placeBag / unplaceBag dans une run, réserve limitée', () => {
    const run = newRun('viper', 1);
    const poch = run.bags[0];
    expect(poch.placed).toBe(false);
    expect(placeBag(run, poch.uid, 0, 0, 0)).toBe(false);
    expect(placeBag(run, poch.uid, 7, 2, 0)).toBe(true);
    expect(usableCells(run.bags).has('8,2')).toBe(true);
    run.items.push(inst(run.nextUid++, 'chg_9mm', 8, 2));
    expect(unplaceBag(run, poch.uid)).toBe(false);
    run.items.pop();
    expect(unplaceBag(run, poch.uid)).toBe(true);
    addBags(run, ['sacoche', 'sacoche', 'sacoche']);
    expect(run.bags.filter((b) => !b.placed).length).toBe(BAG_RESERVE_MAX);
  });
});

describe('carte battle royale', () => {
  it('9 zones de 3 tailles, noms uniques, déterministe', () => {
    const m = genMap(42);
    expect(m.zones.length).toBe(ZONE_COUNT);
    expect(new Set(m.zones.map((z) => z.size))).toEqual(new Set(['petite', 'moyenne', 'grande']));
    expect(new Set(m.zones.map((z) => z.name)).size).toBe(ZONE_COUNT);
    expect(genMap(42)).toEqual(m);
    expect(genMap(43)).not.toEqual(m);
  });

  it('au moins 2 zones jouables à chaque manche, de tailles mélangées à la dernière', () => {
    for (let seed = 0; seed < 300; seed++) {
      const m = genMap(seed);
      for (let r = 0; r < ROUNDS; r++) expect(zonesInCircle(m, r).length).toBeGreaterThanOrEqual(2);
      expect(new Set(zonesInCircle(m, ROUNDS - 1).map((z) => z.size)).size).toBeGreaterThanOrEqual(2);
    }
  });

  it('le gaz se resserre : tout est jouable au début, de moins en moins ensuite', () => {
    for (let seed = 0; seed < 50; seed++) {
      const m = genMap(seed);
      expect(zonesInCircle(m, 0).length).toBe(ZONE_COUNT);
      for (let r = 1; r < ROUNDS; r++) expect(circle(m, r).r).toBeLessThan(circle(m, r - 1).r);
      expect(zonesInCircle(m, ROUNDS - 1).length).toBeLessThan(ZONE_COUNT);
      const gassed = m.zones.find((z) => isGassed(m, z, ROUNDS - 1))!;
      expect(dist(gassed, circle(m, ROUNDS - 1))).toBeGreaterThan(circle(m, ROUNDS - 1).r);
    }
  });
});

describe('cartes', () => {
  const zone = (size: MapZone['size'], id = 0): MapZone => ({ id, name: 'Test', size, x: 500, y: 500 });

  it('nombre de cartes selon la taille, au moins un combat, au plus une boutique', () => {
    for (const size of ['petite', 'moyenne', 'grande'] as const) {
      for (let seed = 0; seed < 300; seed++) {
        const cards = drawCards(seed, seed % ROUNDS, zone(size, seed % 9));
        expect(cards.length).toBe(CARDS_BY_SIZE[size]);
        expect(cards.some(isFight)).toBe(true);
        expect(cards.filter((c) => c.type === 'shop').length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('squad à 2 duels, 3 à partir de la 3e manche ; déterministe', () => {
    const squadDuels = (round: number) => {
      for (let seed = 0; seed < 100; seed++) {
        const c = drawCards(seed, round, zone('grande')).find((x) => x.type === 'squad');
        if (c) return c.duels;
      }
      return -1;
    };
    expect(squadDuels(0)).toBe(2);
    expect(squadDuels(1)).toBe(2);
    expect(squadDuels(2)).toBe(3);
    expect(squadDuels(4)).toBe(3);
    expect(drawCards(7, 1, zone('moyenne'))).toEqual(drawCards(7, 1, zone('moyenne')));
  });

  it('les grandes zones ont plus de squads que les petites', () => {
    const count = (size: MapZone['size']) => {
      let n = 0;
      let total = 0;
      for (let seed = 0; seed < 400; seed++) {
        const cards = drawCards(seed, 1, zone(size));
        n += cards.filter((c) => c.type === 'squad').length;
        total += cards.length;
      }
      return n / total;
    };
    expect(count('grande')).toBeGreaterThan(count('petite') * 2);
  });
});

describe('run', () => {
  it('départ : objets de l’opérateur posés dans le sac, 10 crédits, une pochette en réserve', () => {
    for (const op of ['viper', 'sentinelle'] as const) {
      const run = newRun(op, 5);
      expect(run.credits).toBe(10);
      expect(run.items.every((i) => i.placed)).toBe(true);
      const kept = run.items.map((i) => ({ ...i }));
      sanitizeLayout(run);
      expect(run.items).toEqual(kept);
      expect(run.bags.map((b) => b.defId)).toEqual(['pochette']);
    }
  });

  it('une run complète : 5 manches de 3 actions, puis le Top 1', () => {
    const run = newRun('viper', 123);
    for (let r = 0; r < ROUNDS; r++) {
      expect(run.round).toBe(r);
      const zones = selectableZones(run);
      expect(zones.length).toBeGreaterThanOrEqual(2);
      expect(dropInZone(run, zones[0].id)).toBe(true);
      expect(selectableZones(run)).toEqual([]);
      expect(run.actionsLeft).toBe(ACTIONS_PER_ZONE);
      for (let a = 0; a < ACTIONS_PER_ZONE; a++) playThrough(run, firstCard(run));
      expect(run.zoneId).toBeNull();
    }
    expect(run.round).toBe(FINAL_ROUND);
    expect(selectableZones(run)).toEqual([]);
    const f = finalDuelParams(run)!;
    expect(f.type).toBe('final');
    expect(f.maxHp).toBe(roundMaxHp(FINAL_ROUND));
    expect(resolveDuel(run, { win: true, hpEnd: 10, botItems: [] }).over).toBe('win');
    expect(run.over).toBe('win');
  });

  it('refuse une zone gazée et une carte déjà jouée', () => {
    const run = newRun('viper', 9);
    run.round = ROUNDS - 1;
    const gassed = run.map.zones.find((z) => isGassed(run.map, z, run.round))!;
    expect(dropInZone(run, gassed.id)).toBe(false);
    dropInZone(run, selectableZones(run)[0].id);
    const i = firstCard(run, (t) => t !== 'squad' && t !== 'solo');
    const j = i >= 0 ? i : 0;
    playThrough(run, j);
    expect(playCard(run, j)).toBeNull();
  });

  it('squad : PV reportés entre les duels, gros butin à la fin', () => {
    const run = newRun('viper', 1);
    run.round = 2;
    const z = selectableZones(run)[0];
    dropInZone(run, z.id);
    run.cards[0] = { type: 'squad', duels: 3 };
    const p = playCard(run, 0) as { kind: 'duel' } & DuelParams;
    expect(p.kind).toBe('duel');
    expect(p.squad).toEqual({ duel: 0, total: 3 });
    expect(p.hp).toBe(roundMaxHp(2));
    expect(endAction(run)).toBeNull(); // combat en cours
    const r1 = resolveDuel(run, { win: true, hpEnd: 77, botItems: botItems() });
    expect(r1.actionDone).toBe(false);
    expect(r1.next!.hp).toBe(77);
    expect(r1.next!.squad.duel).toBe(1);
    expect(r1.next!.seed).not.toBe(p.seed);
    expect(r1.loot.items.length).toBe(1);
    resolveDuel(run, { win: true, hpEnd: 40, botItems: botItems() });
    const before = reserve(run).length;
    const r3 = resolveDuel(run, { win: true, hpEnd: 5, botItems: botItems() });
    expect(r3.actionDone).toBe(true);
    expect(reserve(run).length - before).toBe(2);
    expect(r3.loot.credits).toBeGreaterThan(r1.loot.credits);
    expect(endAction(run)).toEqual({ nextRound: false, final: false });
  });

  it('le butin d’un duel vient du sac du bot', () => {
    const run = newRun('viper', 2);
    dropInZone(run, selectableZones(run)[0].id);
    run.cards[0] = { type: 'solo', duels: 1 };
    playCard(run, 0);
    const res = resolveDuel(run, { win: true, hpEnd: 50, botItems: [inst(900, 'smg_ours', 2, 2, 3)] });
    expect(res.loot.items.map((i) => [i.defId, i.rarity])).toEqual([['smg_ours', 3]]);
    expect(res.loot.credits).toBe(6);
  });

  it('Goulag : 1re défaite → Goulag ; gagné → on continue ; 2e défaite → fin', () => {
    const run = newRun('sentinelle', 3);
    dropInZone(run, selectableZones(run)[0].id);
    run.cards[0] = { type: 'squad', duels: 2 };
    run.cards[1] = { type: 'solo', duels: 1 };
    playCard(run, 0);
    const lost = resolveDuel(run, { win: false, hpEnd: 0, botItems: botItems() });
    expect(lost.goulag).toBe(true);
    expect(run.pendingGoulag).toBe(true);
    expect(run.fight).toBeUndefined(); // reste de la squad annulé
    expect(endAction(run)).toBeNull(); // Goulag d'abord
    const g = goulagParams(run)!;
    expect(g.type).toBe('goulag');
    expect(g.danger).toBe(0);
    resolveGoulag(run, true);
    expect(run.over).toBeUndefined();
    expect(endAction(run)!.nextRound).toBe(false);
    expect(run.actionsLeft).toBe(ACTIONS_PER_ZONE - 1);
    playCard(run, 1);
    const lost2 = resolveDuel(run, { win: false, hpEnd: 0, botItems: botItems() });
    expect(lost2.goulag).toBe(false);
    expect(run.over).toBe('lose');
  });

  it('Goulag perdu = fin de run ; Top 1 perdu = fin de run', () => {
    const a = newRun('viper', 4);
    dropInZone(a, selectableZones(a)[0].id);
    a.cards[0] = { type: 'solo', duels: 1 };
    playCard(a, 0);
    resolveDuel(a, { win: false, hpEnd: 0, botItems: [] });
    resolveGoulag(a, false);
    expect(a.over).toBe('lose');

    const b = newRun('viper', 4);
    b.round = FINAL_ROUND;
    finalDuelParams(b);
    resolveDuel(b, { win: false, hpEnd: 0, botItems: [] });
    expect(b.over).toBe('lose');
  });

  it('caisse : 1 objet du pool de l’opérateur (parfois une sacoche), sans combat', () => {
    let bags = 0;
    for (let seed = 0; seed < 100; seed++) {
      const run = newRun('sentinelle', seed);
      dropInZone(run, selectableZones(run)[0].id);
      run.cards[0] = { type: 'caisse', duels: 0 };
      const r = playCard(run, 0)!;
      expect(r.kind).toBe('caisse');
      if (r.kind !== 'caisse') continue;
      expect(r.loot.items.length).toBe(1);
      expect(lootPool('sentinelle')).toContain(r.loot.items[0].defId);
      bags += r.loot.bags.length;
      expect(run.fight).toBeUndefined();
    }
    expect(bags).toBeGreaterThan(10);
    expect(bags).toBeLessThan(55);
  });

  it('boutique : 5 offres du pool, relance payante, achat en réserve', () => {
    const run = newRun('viper', 8);
    dropInZone(run, selectableZones(run)[0].id);
    run.cards[0] = { type: 'shop', duels: 0 };
    expect(playCard(run, 0)).toEqual({ kind: 'shop' });
    const offers = shopOffers(run);
    expect(offers.length).toBe(5);
    for (const o of offers) if (o.item) expect(lootPool('viper')).toContain(o.item.defId);
    run.credits = 100;
    const first = JSON.stringify(offers);
    expect(rerollShop(run)).toBe(true);
    expect(run.credits).toBe(98);
    expect(JSON.stringify(shopOffers(run))).not.toBe(first);
    const i = run.shop!.offers.findIndex((o) => o.item);
    const bought = buyOffer(run, i)!;
    expect(bought.uid).toBeGreaterThan(0);
    expect(run.shop!.offers[i].sold).toBe(true);
    expect(buyOffer(run, i)).toBeNull();
    let sawBag = false;
    for (let k = 0; k < 30 && !sawBag; k++) {
      rerollShop(run);
      sawBag = run.shop!.offers.some((o) => o.bag);
    }
    expect(sawBag).toBe(true);
  });

  it('le butin en trop est revendu quand la réserve est pleine', () => {
    const run = newRun('viper', 1);
    const drops = Array.from({ length: RESERVE_MAX + 2 }, () => ({ ...inst(-1, 'frag', 0, 0), placed: false }));
    const credits = run.credits;
    const res = addDrops(run, drops);
    expect(res.taken.length).toBe(RESERVE_MAX);
    expect(res.credits).toBeGreaterThan(0);
    expect(run.credits).toBe(credits + res.credits);
  });
});

describe('rareté', () => {
  it('6 lignes de chances (5 manches + final), qui montent', () => {
    expect(ROUND_ODDS.length).toBe(ROUNDS + 1);
    for (const row of ROUND_ODDS) expect(row.reduce((a, b) => a + b, 0)).toBe(100);
    const rng = mulberry32(1);
    const avg = (round: number) => {
      let s = 0;
      for (let i = 0; i < 2000; i++) s += rollRarity(rng, round);
      return s / 2000;
    };
    expect(avg(4)).toBeGreaterThan(avg(0) + 1);
  });

  it('respecte la rareté minimale et la garantie', () => {
    const rng = rngFor('x');
    for (let i = 0; i < 200; i++) {
      expect(rollRarity(rng, 0, 2)).toBeGreaterThanOrEqual(2);
      expect(rollRarity(rng, 0, 0, 3)).toBeGreaterThanOrEqual(3);
      expect(rollRarity(rng, 9, 0, 9)).toBeLessThanOrEqual(MAX_RARITY);
    }
  });
});

describe('fusion', () => {
  it('fusionne deux objets identiques de même rareté', () => {
    const run = newRun('viper', 1);
    const a = { ...inst(100, 'frag', 0, 0, 1), placed: false };
    const b = { ...inst(101, 'frag', 0, 0, 1), placed: false };
    run.items.push(a, b);
    expect(canFuse(a, b)).toBe(true);
    expect(canFuse(a, { ...b, rarity: 2 })).toBe(false);
    expect(canFuse(a, a)).toBe(false);
    fuse(run, a, b);
    expect(a.rarity).toBe(2);
    expect(run.items.some((i) => i.uid === 101)).toBe(false);
    expect(canFuse({ ...a, rarity: MAX_RARITY }, { ...b, rarity: MAX_RARITY })).toBe(false);
  });
});

describe('recettes automatiques', () => {
  it('une recette n’est prête que si ses ingrédients se touchent', () => {
    expect(findCraftable([inst(1, 'frag', 2, 2), inst(2, 'fumigene', 3, 2)]).length).toBe(1);
    expect(findCraftable([inst(1, 'frag', 2, 2), inst(2, 'fumigene', 4, 2)]).length).toBe(0);
  });

  it('assembler retire les ingrédients, garde la meilleure rareté et pose dans les cases utilisables', () => {
    const run = newRun('viper', 1);
    run.items = [inst(1, 'plaque', 2, 2, 1), inst(2, 'casque', 3, 2, 2)];
    const made = craft(run, findCraftable(run.items)[0]);
    expect(made.defId).toBe('armure_lourde');
    expect(made.rarity).toBe(2);
    expect(made.placed).toBe(true);
    const u = usableCells(run.bags);
    for (const [x, y] of cellsAt(made, made.x, made.y)) expect(u.has(`${x},${y}`)).toBe(true);
  });

  it('autoCraft assemble tout ce qui est prêt, sur sacoches comprises', () => {
    const run = newRun('viper', 1);
    run.bags = [bag(50, 'sacoche', 7, 2)];
    run.items = [inst(1, 'frag', 7, 2), inst(2, 'fumigene', 8, 2), inst(3, 'ifak', 2, 2), inst(4, 'seringue', 4, 2), inst(5, 'chg_9mm', 6, 5)];
    const done = autoCraft(run);
    expect(done.map((c) => c.recipe.output).sort()).toEqual(['kit_trauma', 'thermite']);
    expect(run.items.map((i) => i.defId).sort()).toEqual(['chg_9mm', 'kit_trauma', 'thermite']);
    expect(run.items.every((i) => i.placed)).toBe(true);
    expect(autoCraft(run)).toEqual([]);
  });

  it('chaque recette donne un objet assemblé, à partir d’objets non assemblés', () => {
    for (const r of RECIPES) {
      expect(ITEMS[r.output].crafted).toBe(true);
      for (const id of r.inputs) expect(ITEMS[id].crafted).toBeFalsy();
    }
  });
});

describe('sauvegarde', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  });

  it('aller-retour, clé v6', () => {
    const run = newRun('viper', 77);
    placeBag(run, run.bags[0].uid, 7, 2, 0);
    dropInZone(run, selectableZones(run)[0].id);
    playThrough(run, firstCard(run));
    saveRun(run);
    expect(store.has('hotdrop.run.v6')).toBe(true);
    expect(loadRun()).toEqual(run);
    clearRun();
    expect(loadRun()).toBeNull();
  });

  it('une run terminée ne se recharge pas', () => {
    const run = newRun('viper', 77);
    run.over = 'lose';
    saveRun(run);
    expect(loadRun()).toBeNull();
  });

  it('sanitizeLayout remet en réserve sacoches détachées et objets hors des cases utilisables', () => {
    const run = newRun('viper', 1);
    run.bags = [bag(50, 'pochette', 0, 0), bag(51, 'pochette', 7, 2)];
    run.items.push(inst(60, 'chg_9mm', 0, 0), inst(61, 'chg_9mm', 8, 2));
    sanitizeLayout(run);
    expect(run.bags.map((b) => b.placed)).toEqual([false, true]);
    expect(run.items.find((i) => i.uid === 60)!.placed).toBe(false);
    expect(run.items.find((i) => i.uid === 61)!.placed).toBe(true);
  });
});

describe('duels', () => {
  it('les paramètres de duel sont stables (rechargement)', () => {
    const run = newRun('viper', 11);
    dropInZone(run, selectableZones(run)[0].id);
    run.cards[0] = { type: 'solo', duels: 1 };
    const p = playCard(run, 0) as { kind: 'duel' } & DuelParams;
    const { kind: _k, ...params } = p;
    expect(currentDuel(run)).toEqual(params);
    expect(JSON.parse(JSON.stringify(run)).fight).toEqual(run.fight);
  });

  it('la danger dépend de la taille de la zone', () => {
    const run = newRun('viper', 12);
    const grande = selectableZones(run).find((z) => z.size === 'grande')!;
    dropInZone(run, grande.id);
    run.cards[0] = { type: 'solo', duels: 1 };
    expect((playCard(run, 0) as DuelParams).danger).toBe(1);
  });
});
