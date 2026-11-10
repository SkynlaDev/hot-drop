import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { craft, findCraftable } from '../src/logic/recipes';
import { buildEncounter } from '../src/data/enemies';
import { simulate } from '../src/logic/combat';
import { ItemInst, Rot, START_UNLOCKED, expandable, canPlace, cellZones, cellsAt, inZone, maskOf, sharedEdge } from '../src/logic/grid';
import { rollRarity } from '../src/logic/rarity';
import { mulberry32, rngFor } from '../src/logic/rng';
import { RESERVE_MAX, addDrops, canFuse, completeZone, enterZone, fuse, level, newRun, remainingBiomes, rollDrops, sanitizeLayout, shopOffers } from '../src/logic/run';
import { BIOMES, BIOME_IDS, FAMILY_PLACES, LOOT_FAMILIES } from '../src/data/biomes';
import { EXFIL_ID, MIN_CHOICES, MOVE_RANGE, TURNS, dist, genZone, guardianThreats, inSafeZone, options } from '../src/logic/zone';
import { computeLoadout, estimateDps, familyStates } from '../src/logic/stats';
import { BLINDES_REDUCTION, THREATS } from '../src/data/threats';

const inst = (uid: number, defId: string, x: number, y: number, rarity = 0, rot: Rot = 0): ItemInst => ({ uid, defId, rarity, rot, x, y, placed: true });

describe('grille', () => {
  it('refuse le hors-grille et les chevauchements', () => {
    const items = [inst(1, 'fusil_assaut', 0, 0)];
    const p = inst(2, 'pistolet', 0, 0, 0);
    p.placed = false;
    expect(canPlace(items, p, 0, 0, 0)).toBe(false); // chevauche
    expect(canPlace(items, p, 6, 1, 0)).toBe(false); // dépasse à droite
    expect(canPlace(items, p, 3, 1, 0)).toBe(true);
    expect(canPlace(items, p, 3, 2, 1)).toBe(true);
  });

  it('tourne les formes de 90° dans le sens horaire', () => {
    // Pistolet en L : XX / X.
    expect(maskOf('pistolet', 1)).toEqual([[true, true], [false, true]]);
    expect(maskOf('pistolet', 2)).toEqual([[false, true], [true, true]]);
    expect(maskOf('fusil_assaut', 1)).toHaveLength(4);
    expect(cellsAt({ defId: 'plaque', rot: 0 }, 0, 0)).toHaveLength(6);
    expect(maskOf('plaque', 1)).toHaveLength(2); // 2 × 3 couché devient 3 × 2
  });

  it('une forme en L laisse sa case vide libre', () => {
    const items = [inst(1, 'pistolet', 0, 0)]; // occupe (0,0) (1,0) (0,1)
    const c = { ...inst(2, 'chg_9mm', 0, 0), placed: false };
    expect(canPlace(items, c, 1, 1, 0)).toBe(true);
    expect(canPlace(items, c, 0, 1, 0)).toBe(false);
  });

  it('refuse les cases verrouillées du gilet', () => {
    const un = new Set(START_UNLOCKED);
    const c = { ...inst(9, 'chg_9mm', 0, 0), placed: false };
    expect(canPlace([], c, 0, 0, 0, un)).toBe(false);
    expect(canPlace([], c, 1, 1, 0, un)).toBe(true);
    const exp = expandable(un);
    expect(exp.has('0,3')).toBe(true);
    expect(exp.has('0,0')).toBe(false); // coin : pas voisin d'une case débloquée
    expect(exp.size).toBe(20);
  });

  it('détecte les bords partagés', () => {
    const a = inst(1, 'pistolet', 1, 1);
    const b = inst(2, 'chg_9mm', 3, 1);
    const c = inst(3, 'chg_9mm', 4, 4);
    expect(sharedEdge(b, a)).not.toBeNull();
    expect(sharedEdge(c, a)).toBeNull();
  });

  it('calcule les zones', () => {
    expect(cellZones(2, 1)).toContain('poitrine');
    expect(cellZones(0, 6)).toEqual(expect.arrayContaining(['flancs', 'ceinture']));
    expect(inZone(inst(1, 'casque', 1, 2), 'poitrine')).toBe(true);
  });
});

describe('rareté et synergies', () => {
  it('la rareté multiplie les dégâts', () => {
    const c = computeLoadout([inst(1, 'fusil_assaut', 0, 3, 0)]).loadout.weapons[0];
    const l = computeLoadout([inst(1, 'fusil_assaut', 0, 3, 4)]).loadout.weapons[0];
    expect(c.dmg).toBe(ITEMS.fusil_assaut.weapon!.dmg);
    expect(l.dmg).toBeCloseTo(c.dmg * 1.75);
    expect(l.pierceEvery).toBe(5);
  });

  it('un chargeur adjacent du bon calibre réduit la recharge', () => {
    const alone = computeLoadout([inst(1, 'pistolet', 1, 1)]).loadout.weapons[0];
    const { loadout, links } = computeLoadout([inst(1, 'pistolet', 1, 1), inst(2, 'chg_9mm', 3, 1)]);
    // Seule, l'arme n'est pas alimentée : recharge ×2. Avec son chargeur : −15 % sur la recharge de base.
    expect(alone.fed).toBe(false);
    expect(loadout.weapons[0].fed).toBe(true);
    expect(loadout.weapons[0].reload).toBeCloseTo((alone.reload / 2) * (1 - ITEMS.chg_9mm.synergy!.value));
    expect(links).toHaveLength(1);
    const wrong = computeLoadout([inst(1, 'pistolet', 1, 1), inst(2, 'chg_556', 3, 1)]);
    expect(wrong.links).toHaveLength(0);
    expect(wrong.loadout.weapons[0].fed).toBe(false);
  });

  it('les accessoires modifient l’arme voisine selon son type', () => {
    const base = computeLoadout([inst(1, 'fusil_assaut', 0, 1)]).loadout.weapons[0];
    const bip = computeLoadout([inst(1, 'fusil_assaut', 0, 1), inst(2, 'bipied', 0, 0)]).loadout.weapons[0];
    expect(bip.dmg).toBeCloseTo(base.dmg * (1 + ITEMS.bipied.synergy!.value));
    const holo = computeLoadout([inst(1, 'fusil_assaut', 0, 1), inst(2, 'viseur_holo', 0, 0)]).loadout.weapons[0];
    expect(holo.crit).toBeCloseTo(base.crit); // arme longue : pas d'effet
    const grip = computeLoadout([inst(1, 'fusil_assaut', 0, 1), inst(2, 'poignee', 0, 2, 0, 1)]);
    expect(grip.links.length).toBeGreaterThan(0);
    expect(grip.loadout.weapons[0].interval).toBeLessThan(base.interval);
  });

  it('le butin contient environ 20 % d’armes', () => {
    const run = newRun(2);
    let w = 0;
    let n = 0;
    for (let i = 0; i < 600; i++) for (const d of rollDrops(run, 1, 0, i)) {
      n++;
      if (ITEMS[d.defId].category === 'arme') w++;
    }
    expect(w / n).toBeGreaterThan(0.15);
    expect(w / n).toBeLessThan(0.26);
  });

  it("l'armure profite de la zone Poitrine", () => {
    expect(computeLoadout([inst(1, 'casque', 1, 2)]).loadout.armor).toBe(19);
    expect(computeLoadout([inst(1, 'casque', 1, 4)]).loadout.armor).toBe(15);
  });

  it('respecte la rareté minimale et la garantie', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 200; i++) {
      expect(rollRarity(rng, 0, 2)).toBeGreaterThanOrEqual(2);
      expect(rollRarity(rng, 0, 0, 3)).toBeGreaterThanOrEqual(3);
    }
  });

  it('fusionne deux objets identiques de même rareté', () => {
    const run = newRun(42);
    const a = inst(100, 'frag', 0, 5, 1);
    const b = { ...inst(101, 'frag', 0, 0, 1), placed: false };
    run.items.push(a, b);
    expect(canFuse(a, b)).toBe(true);
    fuse(run, a, b);
    expect(a.rarity).toBe(2);
    expect(run.items.find((i) => i.uid === 101)).toBeUndefined();
    expect(canFuse(a, { ...b, rarity: 1 })).toBe(false);
  });
});

describe('run', () => {
  it('génère une zone de lieux espacés, avec marchands et élites', () => {
    const z = genZone(7);
    expect(z.pois.length).toBeGreaterThanOrEqual(18);
    for (const a of z.pois) for (const b of z.pois) if (a !== b) expect(dist(a, b)).toBeGreaterThanOrEqual(112);
    expect(z.pois.filter((p) => p.type === 'marchand').length).toBeGreaterThanOrEqual(2);
    expect(genZone(7)).toEqual(z);
  });

  it('une run peut toujours progresser jusqu\'à l\'exfiltration', () => {
    for (let seed = 0; seed < 100; seed++) {
      const z = genZone(seed);
      for (let turn = 0; turn < TURNS; turn++) {
        const o = options(z, turn);
        if (o.forced || !o.pois.length) {
          expect(o.exfil).toBe(true);
          z.pos = EXFIL_ID;
          break;
        }
        // Les lieux proposés sont hors du gaz et à portée (sauf au largage).
        const here = z.pois.find((p) => p.id === z.pos);
        for (const p of o.pois) expect(inSafeZone(z, p, turn)).toBe(true);
        if (here && o.pois.length > 0) expect(o.pois.some((p) => dist(p, here) <= MOVE_RANGE) || o.pois.length <= MIN_CHOICES + 1).toBe(true);
        const next = o.pois[0];
        z.pos = next.id;
        z.visited.push(next.id);
      }
      expect(z.pos).toBe(EXFIL_ID);
    }
  });

  it('pas d\'extraction anticipée avant le 4e tour', () => {
    const z = genZone(3);
    z.pos = z.pois[0].id;
    expect(options(z, 1).exfil).toBe(false);
  });

  it('remet en réserve les objets qui se chevauchent après un changement de formes', () => {
    const run = newRun(1);
    const kit = run.items.length;
    run.items.push(inst(50, 'smg', 1, 2)); // chevauche le pistolet de départ
    sanitizeLayout(run);
    expect(run.items.find((i) => i.uid === 50)!.placed).toBe(false);
    expect(run.items.filter((i) => i.placed)).toHaveLength(kit);
  });

  it('le kit de départ tient dans la grille sans chevauchement', () => {
    const run = newRun(9);
    sanitizeLayout(run);
    expect(run.items.every((i) => i.placed)).toBe(true);
  });

  it('le butin est déterministe et respecte la garantie', () => {
    const run = newRun(5);
    const a = rollDrops(run, 3, 2, 'x').map((i) => i.defId + i.rarity);
    const b = rollDrops(run, 3, 2, 'x').map((i) => i.defId + i.rarity);
    expect(a).toEqual(b);
    expect(rollDrops(run, 3, 2, 'y').every((i) => i.rarity >= 2)).toBe(true);
  });

  it('le butin en trop est revendu quand la réserve est pleine', () => {
    const run = newRun(5);
    const before = run.credits;
    const drops = rollDrops(run, 3, 0, 'z');
    for (let i = 0; i < RESERVE_MAX - 1; i++) run.items.push({ ...inst(200 + i, 'frag', 0, 0), placed: false });
    const r = addDrops(run, drops);
    expect(r.taken).toHaveLength(1);
    expect(r.credits).toBeGreaterThan(0);
    expect(run.credits).toBe(before + r.credits);
  });
});

describe('combat', () => {
  it('est déterministe', () => {
    const run = newRun(3);
    const { loadout } = computeLoadout(run.items);
    const enemies = buildEncounter('contrat', 1, rngFor(3, 1, 'enc'));
    const a = simulate(loadout, enemies, 99);
    const b = simulate(loadout, enemies, 99);
    expect(a).toEqual(b);
  });

  it('le gilet de départ gagne le premier contrat', () => {
    let wins = 0;
    for (let s = 0; s < 50; s++) {
      const run = newRun(s);
      const { loadout } = computeLoadout(run.items);
      const r = simulate(loadout, buildEncounter('contrat', 0, rngFor(s, 0, 'enc')), s);
      if (r.win) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(45);
  });
});

describe('archétypes', () => {
  it('compte les familles du gilet, un Légendaire compte double', () => {
    const items = [inst(1, 'pistolet', 0, 0), inst(2, 'chg_9mm', 2, 0), inst(3, 'smg', 0, 2, 4)];
    const raf = familyStates(items).find((f) => f.family === 'rafale')!;
    expect(raf.count).toBe(4);
    expect(raf.tier).toBe(2);
  });

  it('Rafale palier 2 accélère les armes Rafale', () => {
    const solo = computeLoadout([inst(1, 'pistolet', 0, 0)]).loadout.weapons[0];
    const duo = computeLoadout([inst(1, 'pistolet', 0, 0), inst(2, 'chg_9mm', 4, 4)]).loadout.weapons[0];
    expect(duo.interval).toBeCloseTo(solo.interval / 1.15);
  });

  it('Rempart palier 2 : +20 % d\'armure ; palier 4 : régénération', () => {
    const a1 = computeLoadout([inst(1, 'casque', 1, 3)]).loadout;
    const a2 = computeLoadout([inst(1, 'casque', 1, 3), inst(2, 'ifak', 2, 0)]).loadout;
    expect(a2.armor).toBe(Math.round(a1.armor * 1.2));
    expect(a2.armorRegen).toBe(0);
  });

  it('les munitions perforantes adjacentes ignorent Blindés', () => {
    const { loadout, links } = computeLoadout([inst(1, 'pistolet', 0, 0), inst(2, 'perforantes', 2, 0, 2)]);
    expect(loadout.weapons[0].ignoreBlindes).toBe(true);
    expect(loadout.weapons[0].armorPierce).toBeGreaterThan(0);
    expect(links.some((l) => l.label.startsWith('perce'))).toBe(true);
  });
});

describe('menaces', () => {
  const enemy = { name: 'X', hp: 200, armor: 0, dmg: 0, interval: 99, acc: 0 };
  const gun = () => computeLoadout([inst(1, 'pistolet', 0, 0)]).loadout;

  it('Blindés réduit chaque balle', () => {
    const r = simulate(gun(), [enemy], 1, ['blindes']);
    const hit = r.events.find((e) => e.kind === 'shot' && e.from === 'p' && !e.miss && !e.crit);
    expect(hit && hit.kind === 'shot' && hit.amount).toBe(Math.round(gun().weapons[0].dmg) - BLINDES_REDUCTION);
  });

  it('Médics soigne l\'escouade toutes les 5 s', () => {
    const r = simulate(gun(), [enemy], 1, ['medics']);
    expect(r.events.some((e) => e.kind === 'medic')).toBe(true);
  });

  it('Essaim aligne 4 à 5 ennemis', () => {
    const e = buildEncounter('contrat', 2, rngFor(1), ['essaim']);
    expect(e.length).toBeGreaterThanOrEqual(4);
  });

  it('chaque lieu de combat a ses menaces, aucune sur plus d\'un tiers des combats', () => {
    for (let seed = 0; seed < 50; seed++) {
      const z = genZone(seed);
      const fights = z.pois.filter((p) => p.type === 'contrat' || p.type === 'elite');
      for (const p of fights) expect(p.threats.length).toBe(p.type === 'elite' ? 2 : 1);
      for (const t of THREATS) {
        const n = fights.filter((p) => p.threats.includes(t)).length;
        expect(n).toBeLessThanOrEqual(Math.ceil(fights.length / 3));
      }
    }
  });
});

describe('run en 3 zones', () => {
  it('tire 3 biomes différents, de façon déterministe', () => {
    const r = newRun(11);
    expect(new Set(r.biomes).size).toBe(3);
    expect(newRun(11).biomes).toEqual(r.biomes);
    expect(r.zone).toBeNull();
  });

  it('enchaîne briefing, zones et fin de run dans l’ordre choisi', () => {
    const r = newRun(4);
    const order = [r.biomes[2], r.biomes[0], r.biomes[1]];
    for (let i = 0; i < 3; i++) {
      expect(remainingBiomes(r)).toHaveLength(3 - i);
      enterZone(r, order[i]);
      expect(r.zone!.biome).toBe(order[i]);
      expect(r.zone!.stage).toBe(i);
      r.floor = 5;
      expect(level(r)).toBe(5 + 4 * i);
      expect(completeZone(r)).toBe(i === 2);
    }
    expect(r.done).toEqual(order);
  });

  it('pas d’Assaut en 1re zone ; Cdt Kesh a Assaut en 3e zone', () => {
    for (const b of BIOME_IDS) {
      for (let seed = 1; seed < 20; seed++) {
        const z = genZone(seed, b, 0);
        expect(z.pois.some((p) => p.threats.includes('assaut'))).toBe(false);
        expect(z.exfilThreats).not.toContain('assaut');
      }
      expect(guardianThreats(b, 2)).toContain('assaut');
    }
  });

  it('les noms des lieux viennent du biome', () => {
    const z = genZone(3, 'port', 1);
    const famNames = Object.values(FAMILY_PLACES.port).flat();
    for (const p of z.pois) expect([...BIOMES.port.places, ...famNames]).toContain(p.name);
    expect(new Set(z.pois.map((p) => p.name)).size).toBe(z.pois.length);
  });
});

describe('choix sur la carte', () => {
  it('chaque carte annonce les 4 familles de butin, sur les combats et caisses uniquement', () => {
    for (const b of BIOME_IDS) for (let seed = 1; seed < 30; seed++) {
      const z = genZone(seed, b, seed % 3);
      for (const f of LOOT_FAMILIES) expect(z.pois.some((p) => p.family === f)).toBe(true);
      for (const p of z.pois) expect(!!p.family).toBe(p.type === 'contrat' || p.type === 'elite' || p.type === 'caisse');
    }
  });

  it('au moins 3 lieux proposés à chaque tour, dont 2 différents', () => {
    for (let seed = 0; seed < 300; seed++) {
      const z = genZone(seed, BIOME_IDS[seed % BIOME_IDS.length], seed % 3);
      for (let turn = 0; turn < TURNS - 1; turn++) {
        const o = options(z, turn);
        expect(o.forced).toBe(false);
        expect(o.pois.length).toBeGreaterThanOrEqual(MIN_CHOICES);
        expect(new Set(o.pois.map((p) => `${p.type}/${p.family ?? ''}`)).size).toBeGreaterThanOrEqual(2);
        // Une graine sur deux : pire trajet, on vide d'abord les lieux proches de l'exfiltration.
        const next = seed % 2 ? [...o.pois].sort((p, q) => dist(p, z.exfil) - dist(q, z.exfil))[0] : o.pois[seed % o.pois.length];
        z.pos = next.id;
        z.visited.push(next.id);
      }
    }
  });
});

describe('butin des lieux spécialisés', () => {
  it('la famille annoncée domine le butin', () => {
    const run = newRun(8);
    let fam = 0;
    let total = 0;
    for (let i = 0; i < 400; i++) {
      for (const it of rollDrops(run, 2, 0, i, 'demolition')) {
        total++;
        if (ITEMS[it.defId].family === 'demolition') fam++;
      }
    }
    // 60 % forcés + la part naturelle de la famille (4 objets sur 26)
    expect(fam / total).toBeGreaterThan(0.55);
    expect(fam / total).toBeLessThan(0.8);
  });
});

describe('chaque case compte', () => {
  it('un gilet en vrac perd au moins 25 % de DPS par rapport au même gilet bien rangé', () => {
    const builds = [
      [inst(1, 'fusil_assaut', 0, 3, 2), inst(2, 'chg_556', 4, 3, 1), inst(3, 'lunette', 0, 2, 1), inst(5, 'smg', 3, 0, 1), inst(6, 'chg_9mm', 3, 2)],
      [inst(1, 'precision', 0, 3, 2), inst(2, 'chg_762', 0, 2), inst(3, 'lunette', 1, 2, 1), inst(4, 'silencieux', 3, 2, 2), inst(6, 'pistolet', 3, 0)],
      [inst(1, 'smg', 0, 0, 1), inst(2, 'chg_9mm', 3, 0), inst(3, 'fusil_assaut', 0, 3, 1), inst(4, 'chg_556', 4, 3), inst(7, 'poignee', 0, 1), inst(8, 'bipied', 0, 2)],
    ];
    for (const b of builds) {
      const good = estimateDps(computeLoadout(b).loadout);
      const bad = estimateDps(computeLoadout(b.map((i, n) => ({ ...i, x: 20 + n * 8, y: 20 }))).loadout);
      expect(bad / good).toBeLessThan(0.75);
    }
  });
});

describe('butin orienté', () => {
  const share = (run: ReturnType<typeof newRun>, fam: string, shop = false) => {
    let f = 0;
    let n = 0;
    for (let i = 0; i < 800; i++) {
      const items = shop ? (run.shop = undefined, run.floor = i, shopOffers(run).map((o) => o.inst)) : rollDrops(run, 1, 0, i);
      for (const it of items) {
        n++;
        if (ITEMS[it.defId].family === fam) f++;
      }
    }
    return f / n;
  };

  it('les familles posées dans le gilet tombent environ 2 fois plus souvent', () => {
    const plain = newRun(3);
    plain.items = [];
    const vest = newRun(3);
    vest.items = [inst(1, 'bipied', 0, 0)];
    const ratio = share(vest, 'precision') / share(plain, 'precision');
    expect(ratio).toBeGreaterThan(1.5);
    expect(ratio).toBeLessThan(2.1);
  });

  it('la réserve ne compte pas, et la boutique reste neutre', () => {
    const plain = newRun(5);
    plain.items = [];
    const reserved = newRun(5);
    reserved.items = [{ ...inst(1, 'bipied', 0, 0), placed: false }];
    expect(share(reserved, 'precision')).toBeCloseTo(share(plain, 'precision'), 5);
    const vest = newRun(5);
    vest.items = [inst(1, 'bipied', 0, 0)];
    expect(share(vest, 'precision', true)).toBeCloseTo(share(plain, 'precision', true), 5);
  });
});

describe('recettes de l’Armurier', () => {
  it('une recette n’est prête que si ses ingrédients se touchent', () => {
    // Pompe Sanglier (XXXX / X...) en (0,0) ; cartouches 12G juste à droite ou loin.
    expect(findCraftable([inst(1, 'pompe', 0, 0), inst(2, 'chg_12g', 4, 0)]).map((c) => c.recipe.id)).toEqual(['pompe_dragon']);
    expect(findCraftable([inst(1, 'pompe', 0, 0), inst(2, 'chg_12g', 6, 6)])).toHaveLength(0);
    expect(findCraftable([inst(1, 'pompe', 0, 0), { ...inst(2, 'chg_12g', 4, 0), placed: false }])).toHaveLength(0);
  });

  it('une recette à 3 ingrédients demande un seul bloc', () => {
    // Aigle (XXXXX / ..X..) en (0,1), lunette au-dessus, bipied loin : pas prête ; bipied sous la crosse : prête.
    const base = [inst(1, 'precision', 0, 1), inst(2, 'lunette', 0, 0)];
    expect(findCraftable([...base, inst(3, 'bipied', 5, 5)])).toHaveLength(0);
    expect(findCraftable([...base, inst(3, 'bipied', 3, 2)]).map((c) => c.recipe.id)).toEqual(['aigle_longuevue']);
  });

  it('assembler retire les ingrédients et garde la meilleure rareté', () => {
    const run = newRun(1);
    run.items = [inst(1, 'plaque', 1, 1, 0), inst(2, 'casque', 3, 1, 2)];
    run.nextUid = 10;
    const [c] = findCraftable(run.items);
    const made = craft(run, c);
    expect(made.defId).toBe('armure_lourde');
    expect(made.rarity).toBe(2);
    expect(run.items.map((i) => i.defId)).toEqual(['armure_lourde']);
    expect(made.placed).toBe(true);
  });

  it('les objets assemblés ne tombent jamais dans le butin', () => {
    const run = newRun(4);
    for (let i = 0; i < 500; i++) for (const d of rollDrops(run, 2, 0, i)) expect(ITEMS[d.defId].crafted).toBeFalsy();
  });

  it('chaque recette donne un objet assemblé, à partir d’objets du butin', () => {
    for (const r of RECIPES) {
      expect(ITEMS[r.output].crafted).toBe(true);
      for (const id of r.inputs) expect(ITEMS[id].crafted).toBeFalsy();
    }
  });

  it('les effets des objets assemblés s’appliquent', () => {
    const magnum = computeLoadout([inst(1, 'taureau_magnum', 0, 0)]).loadout.weapons[0];
    expect(magnum.fed).toBe(true);
    expect(magnum.critStun).toBeGreaterThan(0);
    const kr = computeLoadout([inst(1, 'kr4_tactique', 0, 0), inst(2, 'chg_9mm', 4, 0)]).loadout.weapons[0];
    expect(kr.fed).toBe(true); // n'importe quel chargeur l'alimente
    expect(computeLoadout([inst(1, 'armure_lourde', 0, 0)]).loadout.flatReduce).toBe(2);
  });
});
