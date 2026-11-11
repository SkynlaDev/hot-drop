import { beforeEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { lootPool } from '../src/data/operators';
import { autoCraft, craft, findCraftable } from '../src/logic/recipes';
import {
  BASE_CELLS, BagInst, COLS, ItemInst, ROWS, Rot, bagsConnected, canMoveBag, canPlace, canPlaceBag, canRemoveBag, cellsAt,
  maskOf, rotationIsNoop, sharedEdge, usableCells,
} from '../src/logic/grid';
import { rngFor } from '../src/logic/rng';
import {
  BAG_RESERVE_MAX, DuelParams, FINAL_ROUND, RESERVE_MAX, RunState, addBags, addDrops, buyOffer, clearRun, currentDuel,
  dropInZone, endAction, finalDuelParams, goulagParams, loadRun, newRun, placeBag, playCard, rerollShop, reserve,
  CRATES, HEAL_BETWEEN_DUELS, craftedPool, duelCredits, finishLoot, lootItem, swapLoot, resolveDuel, resolveGoulag, roundMaxHp, sanitizeLayout, saveRun, selectableZones, shopOffers,
  unplaceBag,
} from '../src/logic/run';
import {
  ACTIONS_PER_ZONE, CARDS_BY_SIZE, EPIC_CRATE_CHANCE, MapZone, ROUNDS, ZONE_COUNT, circle, dist, drawCards, genMap, isFight, isGassed, zonesInCircle,
} from '../src/logic/zone';

const inst = (uid: number, defId: string, x: number, y: number, rot: Rot = 0): ItemInst => ({ uid, defId, rot, x, y, placed: true });
const bag = (uid: number, defId: string, x: number, y: number, rot: Rot = 0, placed = true): BagInst => ({ uid, defId, rot, x, y, placed });
const BASE = new Set(BASE_CELLS);
const botItems = (): ItemInst[] => [inst(900, 'pistolet', 2, 2), inst(901, 'chg_9mm', 4, 2), inst(902, 'casque', 2, 4)];

/** Joue une carte et la termine (duels gagnés, pleine vie). */
function playThrough(run: RunState, index: number, win = true): void {
  const r = playCard(run, index);
  expect(r).not.toBeNull();
  if (r!.kind === 'duel') {
    let res = resolveDuel(run, { win, hpEnd: 50, botItems: botItems() });
    if (run.pendingLoot) finishLoot(run);
    while (res.next) {
      res = resolveDuel(run, { win, hpEnd: 50, botItems: botItems() });
      if (run.pendingLoot) finishLoot(run);
    }
    if (res.actionDone && !run.over) endAction(run);
  } else {
    if (run.pendingLoot) finishLoot(run); // caisse : choix laissé vide
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

  it('duo à 2 duels ; escouade à 3, 4 à partir du 4e cercle ; déterministe', () => {
    const duels = (type: 'duo' | 'squad', round: number) => {
      for (let seed = 0; seed < 100; seed++) {
        const c = drawCards(seed, round, zone('grande')).find((x) => x.type === type);
        if (c) return c.duels;
      }
      return -1;
    };
    expect(duels('duo', 0)).toBe(2);
    expect(duels('duo', 4)).toBe(2);
    expect(duels('squad', 0)).toBe(3);
    expect(duels('squad', 2)).toBe(3);
    expect(duels('squad', 3)).toBe(4);
    expect(duels('squad', 4)).toBe(4);
    expect(drawCards(7, 1, zone('moyenne'))).toEqual(drawCards(7, 1, zone('moyenne')));
  });

  it('caisse épique : grandes zones seulement, dès le 2e cercle, au plus une par largage, au moins un combat gardé', () => {
    for (const size of ['petite', 'moyenne', 'grande'] as const) {
      let zones = 0;
      for (let seed = 0; seed < 400; seed++) {
        const cards = drawCards(seed, 1 + (seed % (ROUNDS - 1)), zone(size, seed % 9));
        const n = cards.filter((c) => c.type === 'caisse_epique').length;
        expect(n).toBeLessThanOrEqual(1);
        expect(cards.filter((c) => c.type === 'caisse_renforcee').length).toBeLessThanOrEqual(1);
        const first = drawCards(seed, 0, zone(size, seed % 9));
        expect(first.some((c) => c.type === 'caisse_epique' || c.type === 'caisse_renforcee')).toBe(false);
        expect(cards.some(isFight)).toBe(true);
        expect(cards.length).toBe(CARDS_BY_SIZE[size]);
        zones += n;
      }
      if (EPIC_CRATE_CHANCE[size] === 0) expect(zones).toBe(0);
      else expect(Math.abs(zones / 400 - EPIC_CRATE_CHANCE[size])).toBeLessThan(0.08);
    }
  });

  it('crédits : solo < duo < escouade, bonus de fin plus gros pour l’escouade', () => {
    for (const r of [0, 2, 4]) {
      const total = (kind: 'solo' | 'duo' | 'squad', n: number) =>
        Array.from({ length: n }, (_, k) => duelCredits(kind, r, k === n - 1)).reduce((a, b) => a + b, 0);
      expect(total('duo', 2)).toBeGreaterThan(2 * total('solo', 1) - 2);
      expect(total('squad', 3)).toBeGreaterThan(total('duo', 2) + total('solo', 1));
    }
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

  it('escouade : PV reportés et à moitié soignés entre les duels, chaque bot vaincu se fouille, bonus à la fin', () => {
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
    expect(r1.next!.hp).toBe(Math.round(77 + (roundMaxHp(2) - 77) * HEAL_BETWEEN_DUELS));
    expect(r1.next!.squad.duel).toBe(1);
    expect(r1.next!.seed).not.toBe(p.seed);
    expect(r1.lootChoices!.map((i) => i.defId)).toEqual(botItems().map((i) => i.defId));
    // Le duel suivant attend le choix du butin.
    expect(resolveDuel(run, { win: true, hpEnd: 40, botItems: botItems() }).loot.credits).toBe(0);
    expect((lootItem(run, 901) as { item: ItemInst }).item.defId).toBe('chg_9mm');
    finishLoot(run);
    const r2 = resolveDuel(run, { win: true, hpEnd: 40, botItems: botItems() });
    expect(r2.next).toBeDefined();
    finishLoot(run);
    const before = reserve(run).length;
    const r3 = resolveDuel(run, { win: true, hpEnd: 5, botItems: botItems() });
    expect(r3.actionDone).toBe(true);
    expect(r3.loot.credits).toBeGreaterThan(r1.loot.credits); // bonus de fin de squad
    expect(endAction(run)).toBeNull(); // fouille d'abord
    expect(lootItem(run, 902)).not.toBeNull();
    expect(lootItem(run, 900)).not.toBeNull();
    finishLoot(run);
    expect(reserve(run).length - before).toBe(2);
    expect(endAction(run)).toEqual({ nextRound: false, final: false });
  });

  it('fouille : on prend tout ce qu’on veut dans le sac du bot, puis on termine', () => {
    const run = newRun('viper', 2);
    dropInZone(run, selectableZones(run)[0].id);
    run.cards[0] = { type: 'solo', duels: 1 };
    playCard(run, 0);
    const bot = [inst(900, 'smg_ours', 2, 2), inst(901, 'casque', 5, 2), inst(902, 'frag', 6, 2)];
    const res = resolveDuel(run, { win: true, hpEnd: 50, botItems: bot, botUsable: ['2,2', '3,2'] });
    expect(res.loot.items).toEqual([]);
    expect(res.loot.credits).toBe(6);
    expect(run.pendingLoot!.items.map((i) => [i.uid, i.defId, i.x, i.y])).toEqual([[900, 'smg_ours', 2, 2], [901, 'casque', 5, 2], [902, 'frag', 6, 2]]);
    expect(run.pendingLoot!.usable).toEqual(['2,2', '3,2']);
    // Refusé : objet absent du sac du bot ; pas de carte ni de fin d'action pendant la fouille.
    expect(lootItem(run, 999)).toBeNull();
    expect(endAction(run)).toBeNull();
    expect(playCard(run, 1)).toBeNull();
    const a = lootItem(run, 900)!;
    const b = lootItem(run, 901)!;
    expect([a.to, b.to]).toEqual(['reserve', 'reserve']);
    expect(lootItem(run, 900)).toBeNull(); // déjà pris
    expect(run.pendingLoot!.items.map((i) => i.uid)).toEqual([902]);
    expect(reserve(run).map((i) => i.defId).slice(-2)).toEqual(['smg_ours', 'casque']);
    finishLoot(run); // la frag reste dans le sac du vaincu
    expect(run.pendingLoot).toBeUndefined();
    expect(run.items.some((i) => i.defId === 'frag')).toBe(false);
    expect(endAction(run)).not.toBeNull();
  });

  it('réserve pleine : l’objet va directement dans le sac ; tout plein : échange contre un objet revendu', () => {
    const run = newRun('viper', 2);
    dropInZone(run, selectableZones(run)[0].id);
    run.cards[0] = { type: 'solo', duels: 1 };
    playCard(run, 0);
    while (reserve(run).length < RESERVE_MAX) addDrops(run, [inst(-1, 'chg_9mm', 0, 0)]);
    resolveDuel(run, { win: true, hpEnd: 50, botItems: [inst(900, 'chg_556', 2, 2), inst(901, 'plaque', 3, 2), inst(902, 'chg_44', 5, 2)] });
    const credits = run.credits;
    // Le sac de base a de la place pour une case : la réserve pleine envoie le chargeur dans le sac.
    const r = lootItem(run, 900)!;
    expect(r.to).toBe('sac');
    const placed = (r as { item: ItemInst }).item;
    expect(placed.placed).toBe(true);
    expect(canPlace(run.items.filter((i) => i !== placed), placed, placed.x, placed.y, placed.rot, usableCells(run.bags))).toBe(true);
    expect(run.credits).toBe(credits); // plus de revente automatique
    // Remplit le sac : la plaque (2×3) n'a plus de place nulle part.
    for (let k = 0; k < 40; k++) {
      const extra = { uid: 5000 + k, defId: 'chg_9mm', rot: 0 as Rot, x: 0, y: 0, placed: false };
      run.pendingLoot!.items.push(extra);
      if (lootItem(run, extra.uid)!.to === 'plein') break;
    }
    expect(lootItem(run, 901)!.to).toBe('plein');
    // Échange impossible : revendre un chargeur d'une case ne fait pas de place pour une plaque 2×3.
    const small = run.items.find((i) => i.placed && i.defId === 'chg_9mm')!;
    const n = run.items.length;
    expect(swapLoot(run, 901, small.uid)).toBeNull();
    expect(run.items.length).toBe(n);
    // Échange possible : un chargeur de la réserve laisse une place en réserve pour le chargeur .44.
    const inReserve = reserve(run)[0];
    const before = run.credits;
    const sw = swapLoot(run, 902, inReserve.uid)!;
    expect(sw.take.to).toBe('reserve');
    expect(sw.credits).toBeGreaterThan(0);
    expect(run.credits).toBe(before + sw.credits);
    expect(run.items.some((i) => i.uid === inReserve.uid)).toBe(false);
    expect(run.items.some((i) => i.defId === 'chg_44')).toBe(true);
  });

  it('caisse épique : du cash et 2 objets à choisir sur 5, dont une arme et un objet assemblé', () => {
    for (let seed = 0; seed < 200; seed++) {
      const run = newRun(seed % 2 ? 'viper' : 'sentinelle', seed);
      run.round = 1 + (seed % (ROUNDS - 1));
      dropInZone(run, selectableZones(run)[0].id);
      run.cards[0] = { type: 'caisse_epique', duels: 0 };
      const credits = run.credits;
      const r = playCard(run, 0)!;
      expect(r.kind).toBe('caisse');
      if (r.kind !== 'caisse') continue;
      expect(r.crate).toBe('caisse_epique');
      expect(run.fight).toBeUndefined();
      expect(run.credits - credits).toBe(r.loot.credits);
      expect(r.loot.credits).toBeGreaterThanOrEqual(CRATES.caisse_epique.cash(run.round));
      const p = run.pendingLoot!;
      expect(p.items.length).toBe(5);
      expect(p.maxPicks).toBe(2);
      expect(new Set(p.items.map((i) => i.defId)).size).toBe(5);
      expect(p.items.some((i) => ITEMS[i.defId].weapon)).toBe(true);
      expect(p.items.some((i) => ITEMS[i.defId].crafted)).toBe(true);
      for (const it of p.items) expect([...lootPool(run.operator), ...craftedPool(run.operator)]).toContain(it.defId);
    }
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

  it('caisse : du cash, 1 objet à choisir sur 3 dont une arme, parfois une sacoche, sans combat', () => {
    let bags = 0;
    for (let seed = 0; seed < 100; seed++) {
      const run = newRun('sentinelle', seed);
      dropInZone(run, selectableZones(run)[0].id);
      run.cards[0] = { type: 'caisse', duels: 0 };
      const r = playCard(run, 0)!;
      expect(r.kind).toBe('caisse');
      if (r.kind !== 'caisse') continue;
      expect(r.loot.items).toEqual([]);
      expect(r.loot.credits).toBeGreaterThanOrEqual(CRATES.caisse.cash(0));
      const p = run.pendingLoot!;
      expect(p.items.length).toBe(3);
      expect(p.items.some((i) => ITEMS[i.defId].weapon)).toBe(true);
      for (const it of p.items) expect(lootPool('sentinelle')).toContain(it.defId);
      bags += r.loot.bags.length;
      expect(run.fight).toBeUndefined();
      // Un seul objet : le 2e est refusé ; l'action attend la fin du choix.
      expect(lootItem(run, p.items[0].uid)).not.toBeNull();
      expect(lootItem(run, p.items[0].uid)).toBeNull();
      expect(endAction(run)).toBeNull();
      finishLoot(run);
      expect(endAction(run)).not.toBeNull();
    }
    expect(bags).toBeGreaterThan(10);
    expect(bags).toBeLessThan(55);
  });

  it('caisse renforcée : 2 objets sur 4, dont un ingrédient qui complète une recette commencée', () => {
    let hits = 0;
    for (let seed = 0; seed < 100; seed++) {
      const run = newRun('viper', seed);
      run.round = 2;
      dropInZone(run, selectableZones(run)[0].id);
      run.items.push({ uid: 999, defId: 'smg', rot: 0, x: 0, y: 0, placed: false }); // moitié du Furet Akimbo
      run.cards[0] = { type: 'caisse_renforcee', duels: 0 };
      playCard(run, 0);
      const p = run.pendingLoot!;
      expect(p.items.length).toBe(4);
      expect(p.maxPicks).toBe(2);
      // Ingrédients manquants des recettes commencées (le sac de départ en commence aussi).
      const owned = run.items.map((i) => i.defId);
      const missing = new Set(RECIPES.filter((rc) => rc.inputs.some((id) => owned.includes(id))).flatMap((rc) => rc.inputs));
      if (p.items.some((i) => missing.has(i.defId))) hits++;
      for (const it of p.items.slice(0, 2)) lootItem(run, it.uid);
      expect(lootItem(run, p.items[0]?.uid ?? -1)).toBeNull();
    }
    expect(hits).toBe(100);
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

describe('objets sans rareté', () => {
  it('un objet n’apparaît pas avant sa manche minimale', () => {
    for (let seed = 0; seed < 60; seed++) {
      const run = newRun(seed % 2 ? 'viper' : 'sentinelle', seed);
      dropInZone(run, selectableZones(run)[0].id);
      const offers = shopOffers(run);
      for (const o of offers) if (o.item) expect(ITEMS[o.item.defId].minRound).toBe(0);
    }
  });
});

describe('recettes de doublon', () => {
  it('deux exemplaires identiques adjacents s’assemblent', () => {
    expect(findCraftable([inst(1, 'frag', 2, 2), inst(2, 'frag', 3, 2)]).map((c) => c.recipe.output)).toEqual(['sous_munitions']);
    expect(findCraftable([inst(1, 'frag', 2, 2), inst(2, 'frag', 4, 2)]).length).toBe(0);
    // Un seul exemplaire ne suffit pas.
    expect(findCraftable([inst(1, 'frag', 2, 2)]).length).toBe(0);
  });

  it('à ingrédients partagés, la première recette de la liste l’emporte', () => {
    const run = newRun('viper', 1);
    run.items = [inst(1, 'frag', 2, 2), inst(2, 'fumigene', 3, 2), inst(3, 'frag', 2, 3)];
    const done = autoCraft(run);
    expect(done[0].recipe.output).toBe('thermite');
  });
});

describe('recettes automatiques', () => {
  it('une recette n’est prête que si ses ingrédients se touchent', () => {
    expect(findCraftable([inst(1, 'frag', 2, 2), inst(2, 'fumigene', 3, 2)]).length).toBe(1);
    expect(findCraftable([inst(1, 'frag', 2, 2), inst(2, 'fumigene', 4, 2)]).length).toBe(0);
  });

  it('assembler retire les ingrédients et pose dans les cases utilisables', () => {
    const run = newRun('viper', 1);
    run.items = [inst(1, 'plaque', 2, 2), inst(2, 'casque', 3, 2)];
    const made = craft(run, findCraftable(run.items)[0]);
    expect(made.defId).toBe('armure_lourde');
    expect(run.items.map((i) => i.uid)).toEqual([made.uid]);
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

  it('aller-retour, clé v7', () => {
    const run = newRun('viper', 77);
    placeBag(run, run.bags[0].uid, 7, 2, 0);
    dropInZone(run, selectableZones(run)[0].id);
    playThrough(run, firstCard(run));
    saveRun(run);
    expect(store.has('hotdrop.run.v7')).toBe(true);
    expect(loadRun()).toEqual(run);
    clearRun();
    expect(loadRun()).toBeNull();
  });

  it('une fouille en cours survit à la sauvegarde', () => {
    const run = newRun('viper', 78);
    dropInZone(run, selectableZones(run)[0].id);
    run.cards[0] = { type: 'solo', duels: 1 };
    playCard(run, 0);
    resolveDuel(run, { win: true, hpEnd: 50, botItems: botItems(), botUsable: ['2,2'] });
    saveRun(run);
    const back = loadRun()!;
    expect(back.pendingLoot).toEqual(run.pendingLoot);
    expect(endAction(back)).toBeNull();
    expect((lootItem(back, 902) as { item: ItemInst }).item.defId).toBe('casque');
    saveRun(back);
    expect(loadRun()!.pendingLoot!.items.map((i) => i.uid)).toEqual([900, 901]);
    finishLoot(back);
    expect(endAction(back)).not.toBeNull();
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
