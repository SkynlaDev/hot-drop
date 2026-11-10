// Recettes de l'Armurier : détection des ingrédients adjacents dans le gilet, et assemblage à l'Établi.
import { ITEMS } from '../data/items';
import { RECIPES, Recipe } from '../data/recipes';
import { COLS, ItemInst, ROWS, Rot, canPlace, cellsAt, cellsOf, sharedEdge } from './grid';
import type { RunState } from './run';

export interface Craftable {
  recipe: Recipe;
  /** Les objets du gilet utilisés, dans l'ordre des ingrédients. */
  parts: ItemInst[];
}

/** Vrai si les objets forment un seul bloc : chacun relié aux autres par des bords partagés. */
function connected(parts: ItemInst[]): boolean {
  const seen = new Set([0]);
  const todo = [0];
  while (todo.length) {
    const i = todo.pop()!;
    parts.forEach((p, j) => {
      if (!seen.has(j) && sharedEdge(parts[i], p)) {
        seen.add(j);
        todo.push(j);
      }
    });
  }
  return seen.size === parts.length;
}

/** Recettes dont tous les ingrédients sont posés dans le gilet et se touchent. Une combinaison par recette. */
export function findCraftable(items: ItemInst[]): Craftable[] {
  const placed = items.filter((i) => i.placed);
  const out: Craftable[] = [];
  for (const recipe of RECIPES) {
    const pools = recipe.inputs.map((id) => placed.filter((i) => i.defId === id));
    if (pools.some((p) => !p.length)) continue;
    const pick: ItemInst[] = [];
    const search = (k: number): boolean => {
      if (k === pools.length) return connected(pick);
      for (const c of pools[k]) {
        if (pick.includes(c)) continue;
        pick.push(c);
        if (search(k + 1)) return true;
        pick.pop();
      }
      return false;
    };
    if (search(0)) out.push({ recipe, parts: [...pick] });
  }
  return out;
}

/** Recettes qui utilisent cet objet comme ingrédient. */
export function recipesUsing(defId: string): Recipe[] {
  return RECIPES.filter((r) => r.inputs.includes(defId));
}

export function recipeLabel(r: Recipe): string {
  return `${r.inputs.map((id) => ITEMS[id].short).join(' + ')} → ${ITEMS[r.output].name}`;
}

/**
 * Assemble une recette : les ingrédients disparaissent, l'objet obtenu prend leur meilleure rareté.
 * Il est posé de préférence là où étaient les ingrédients, sinon il va dans la réserve.
 */
export function craft(run: RunState, c: Craftable): ItemInst {
  const freed = new Set(c.parts.flatMap((p) => cellsOf(p).map(([x, y]) => `${x},${y}`)));
  const uids = new Set(c.parts.map((p) => p.uid));
  run.items = run.items.filter((i) => !uids.has(i.uid));
  const out: ItemInst = {
    uid: run.nextUid++, defId: c.recipe.output, rarity: Math.max(...c.parts.map((p) => p.rarity)),
    rot: 0, x: 0, y: 0, placed: false,
  };
  const unlocked = new Set(run.unlocked);
  let best: { x: number; y: number; rot: Rot; score: number } | null = null;
  for (const rot of [0, 1, 2, 3] as Rot[]) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!canPlace(run.items, out, x, y, rot, unlocked)) continue;
        const score = cellsAt(out, x, y, rot).filter(([cx, cy]) => freed.has(`${cx},${cy}`)).length;
        if (!best || score > best.score) best = { x, y, rot, score };
      }
    }
  }
  if (best) Object.assign(out, { x: best.x, y: best.y, rot: best.rot, placed: true });
  run.items.push(out);
  return out;
}
