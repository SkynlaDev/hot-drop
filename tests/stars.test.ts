import { afterAll, describe, expect, it } from 'vitest';
import { ITEMS, ItemDef } from '../src/data/items';
import { ItemInst, Rot } from '../src/logic/grid';
import { bagStars, starCells, starSpecs, starsLitBy } from '../src/logic/stars';
import { computeLoadout, describe as describeItem } from '../src/logic/stats';

const inst = (uid: number, defId: string, x: number, y: number, rot: Rot = 0): ItemInst => ({ uid, defId, rot, x, y, placed: true });

// Objets de test (retirés à la fin) : un gilet 1×2 avec une étoile à sa droite qui veut un explosif.
const TEST: ItemDef[] = [
  {
    id: 't_gilet', name: 'Gilet test', short: 'Gilet', shape: ['XX'], category: 'protection', family: 'rempart', tags: ['protection'],
    minRound: 0, price: 1, armor: 10,
    stars: [
      { at: [[2, 0]], want: ['explosif'], effect: { on: 'target', kind: 'charges', value: 1 } },
      { at: [[0, 1], [1, 1]], want: ['protection'], effect: { on: 'self', kind: 'armor', value: 5 }, max: 1 },
    ],
  },
  {
    id: 't_lame', name: 'Lame test', short: 'Lame', shape: ['X'], category: 'arme', family: 'tactique', tags: ['melee'],
    minRound: 0, price: 1, melee: { dmg: 4, interval: 1 },
    stars: [{ want: ['medical'], effect: { on: 'self', kind: 'bleed', value: 2 } }],
  },
];
for (const d of TEST) ITEMS[d.id] = d;
afterAll(() => {
  for (const d of TEST) delete ITEMS[d.id];
});

describe('étoiles', () => {
  it('accessoire : une étoile sur toutes les cases voisines, remplie par une arme compatible', () => {
    const spec = starSpecs('chg_9mm');
    expect(spec).toHaveLength(1);
    expect(spec[0].wantLabel).toBe('Arme 9mm');
    expect(starCells('chg_9mm', 4, 4, 0, spec[0]).sort()).toEqual([[3, 4], [4, 3], [4, 5], [5, 4]].sort());
    // Pistolet 9 mm (XX / X.) en (2,2) : le chargeur en (4,2) le touche.
    const ok = bagStars([inst(1, 'pistolet', 2, 2), inst(2, 'chg_9mm', 4, 2)]).find((f) => f.uid === 2)!;
    expect(ok.by).toEqual([1]);
    // Revolver .44 : pas compatible avec un chargeur 9 mm.
    const ko = bagStars([inst(1, 'revolver', 2, 2), inst(2, 'chg_9mm', 5, 2)]).find((f) => f.uid === 2)!;
    expect(ko.by).toEqual([]);
    expect(describeItem(inst(1, 'chg_9mm', 0, 0)).lines.some((l) => l.startsWith('★ Arme 9mm'))).toBe(true);
  });

  it('cases marquées : elles tournent avec l’objet', () => {
    const spec = starSpecs('t_gilet')[0];
    expect(starCells('t_gilet', 3, 3, 0, spec)).toEqual([[5, 3]]); // à droite
    expect(starCells('t_gilet', 3, 3, 1, spec)).toEqual([[3, 5]]); // en dessous (forme verticale)
    expect(starCells('t_gilet', 3, 3, 2, spec)).toEqual([[2, 3]]); // à gauche
    expect(starCells('t_gilet', 3, 3, 3, spec)).toEqual([[3, 2]]); // au-dessus
  });

  it('effets génériques : charges à la cible, armure au porteur (max 1), saignement de la mêlée', () => {
    const base = computeLoadout([inst(1, 't_gilet', 2, 2), inst(2, 'frag', 5, 2)], 'viper', 300);
    expect(base.loadout.actives[0].charges).toBe(ITEMS.frag.active!.charges);
    const lit = computeLoadout([inst(1, 't_gilet', 2, 2), inst(2, 'frag', 4, 2)], 'viper', 300);
    expect(lit.loadout.actives[0].charges).toBe(ITEMS.frag.active!.charges + 1);
    expect(lit.links.some((l) => l.label.startsWith('★'))).toBe(true);
    // Deux casques sous le gilet : une seule étoile compte (max 1).
    const armor = (items: ItemInst[]) => computeLoadout(items, 'viper', 300).loadout.armor;
    const g = inst(1, 't_gilet', 2, 2);
    const under = armor([g, inst(2, 'casque', 2, 3)]);
    const away = armor([g, inst(2, 'casque', 5, 5)]);
    expect(under - away).toBe(Math.round(5 * 1.2)); // +5, puis Rempart ×1,2 (2 objets Rempart)
    expect(armor([g, inst(2, 'casque', 2, 3), inst(3, 'casque', 4, 3)])).toBeLessThan(away + ITEMS.casque.armor! * 1.2 + 2 * 5 * 1.2);
    // La lame : +2 de saignement par soin adjacent.
    const blade = computeLoadout([inst(1, 't_lame', 3, 3), inst(2, 'bandage', 4, 3), inst(3, 'ifak', 3, 4)], 'viper', 300).loadout.melee[0];
    expect(blade.bleed).toBe(4);
  });

  it('objet tenu : les étoiles qu’il allumerait, les siennes comprises', () => {
    const items = [inst(1, 'pistolet', 2, 2), inst(2, 't_gilet', 2, 5)];
    const chg = { ...inst(3, 'chg_9mm', 0, 0), placed: false };
    expect(starsLitBy(items, chg, 4, 2, 0).map((f) => [f.uid, f.by])).toEqual([[3, [1]]]);
    expect(starsLitBy(items, chg, 8, 8, 0)).toEqual([]);
    const frag = { ...inst(4, 'frag', 0, 0), placed: false };
    expect(starsLitBy(items, frag, 4, 5, 0).map((f) => f.uid)).toEqual([2]);
  });

  it('objets réels : casque sur une protection, lame contre une lame, grenades en chaîne', () => {
    const L = (items: ItemInst[]) => computeLoadout(items, 'viper', 300).loadout;
    // Casque (2×2) en (2,2) : ses étoiles sont sous lui, en (2,4) et (3,4).
    const onPlate = L([inst(1, 'casque', 2, 2), inst(2, 'plaque', 2, 4)]).armor;
    const besidePlate = L([inst(1, 'casque', 2, 2), inst(2, 'plaque', 5, 2)]).armor; // ni l'une ni l'autre étoile
    expect(onPlate).toBeGreaterThan(besidePlate);
    // Couteau (XX) en (2,2) : l'étoile est au bout de la lame, en (4,2).
    expect(L([inst(1, 'couteau', 2, 2), inst(2, 'machette', 4, 2)]).melee.find((m) => m.uid === 1)!.bleed).toBe(2);
    expect(L([inst(1, 'couteau', 2, 2), inst(2, 'machette', 2, 3)]).melee.find((m) => m.uid === 1)!.bleed).toBe(0);
    // Deux frags côte à côte : chacune +20 % de dégâts.
    const frags = L([inst(1, 'frag', 2, 2), inst(2, 'frag', 3, 2)]).actives;
    expect(frags.map((a) => a.value)).toEqual([ITEMS.frag.active!.value * 1.2, ITEMS.frag.active!.value * 1.2]);
    // Toutes les protections, soins, explosifs et armes de mêlée ont au moins une étoile.
    for (const d of Object.values(ITEMS)) {
      if (d.id.startsWith('t_') || !['protection', 'medical', 'explosif'].includes(d.category) && !d.melee) continue;
      expect(starSpecs(d.id).length, d.id).toBeGreaterThan(0);
    }
  });
});
