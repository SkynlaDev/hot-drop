import { ITEMS } from '../data/items';
import { BAGS, isBagId } from '../data/bags';

/** Taille maximale de la grille. Le sac de base est au centre, les sacoches s'ajoutent autour. */
export const COLS = 9;
export const ROWS = 8;
/** Sac de base, toujours utilisable : colonnes 2 à 6, lignes 2 à 5 (5×4). */
export const BASE_X0 = 2;
export const BASE_X1 = 6;
export const BASE_Y0 = 2;
export const BASE_Y1 = 5;
export const BASE_CELLS: string[] = (() => {
  const out: string[] = [];
  for (let y = BASE_Y0; y <= BASE_Y1; y++) for (let x = BASE_X0; x <= BASE_X1; x++) out.push(`${x},${y}`);
  return out;
})();
const BASE_SET = new Set(BASE_CELLS);
export const cellKey = (x: number, y: number) => `${x},${y}`;

/** Rotation par pas de 90° dans le sens horaire. */
export type Rot = 0 | 1 | 2 | 3;

export interface ItemInst {
  uid: number;
  defId: string;
  rot: Rot;
  x: number;
  y: number;
  placed: boolean;
}

/** Sacoche posée (ou en réserve si `placed` est faux). `defId` est un id de data/bags.ts. */
export interface BagInst {
  uid: number;
  defId: string;
  rot: Rot;
  x: number;
  y: number;
  placed: boolean;
}

export type Mask = boolean[][];

const maskCache = new Map<string, Mask>();
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

function rotateCw(m: Mask): Mask {
  const h = m.length;
  const w = m[0].length;
  return Array.from({ length: w }, (_, r) => Array.from({ length: h }, (__, c) => m[h - 1 - c][r]));
}

/** Forme brute d'un objet ou d'une sacoche. */
function shapeOf(defId: string): string[] {
  return isBagId(defId) ? BAGS[defId].shape : ITEMS[defId].shape;
}

/** Masque de l'objet ou de la sacoche (lignes × colonnes) pour une rotation donnée. */
export function maskOf(defId: string, rot: Rot): Mask {
  const key = `${defId}:${rot}`;
  let m = maskCache.get(key);
  if (!m) {
    m = shapeOf(defId).map((row) => [...row].map((ch) => ch === 'X'));
    for (let i = 0; i < rot; i++) m = rotateCw(m);
    maskCache.set(key, m);
  }
  return m;
}

export function nextRot(rot: Rot): Rot {
  return ((rot + 1) % 4) as Rot;
}

/** Vrai si tourner l'objet ne change pas sa forme (carré, case unique…). */
export function rotationIsNoop(defId: string, rot: Rot): boolean {
  return JSON.stringify(maskOf(defId, rot)) === JSON.stringify(maskOf(defId, nextRot(rot)));
}

export function cellCount(defId: string): number {
  return shapeOf(defId).join('').split('').filter((c) => c === 'X').length;
}

/** Boîte englobante de l'objet (ou de la sacoche). */
export function dims(inst: Pick<ItemInst, 'defId' | 'rot'>, rot: Rot = inst.rot): { w: number; h: number } {
  const m = maskOf(inst.defId, rot);
  return { w: m[0].length, h: m.length };
}

export function cellsAt(inst: Pick<ItemInst, 'defId' | 'rot'>, x: number, y: number, rot: Rot = inst.rot): [number, number][] {
  const m = maskOf(inst.defId, rot);
  const out: [number, number][] = [];
  m.forEach((row, j) => row.forEach((on, i) => on && out.push([x + i, y + j])));
  return out;
}

export function cellsOf(inst: Pick<ItemInst, 'defId' | 'rot' | 'x' | 'y'>): [number, number][] {
  return cellsAt(inst, inst.x, inst.y, inst.rot);
}

export function itemAt(items: ItemInst[], cx: number, cy: number): ItemInst | undefined {
  return items.find((it) => it.placed && cellsOf(it).some(([x, y]) => x === cx && y === cy));
}

/** Objets posés (autres que `self`) qui chevauchent une empreinte donnée. */
export function overlapping(items: ItemInst[], self: ItemInst, x: number, y: number, rot: Rot): ItemInst[] {
  const res = new Set<ItemInst>();
  for (const [cx, cy] of cellsAt(self, x, y, rot)) {
    const it = itemAt(items, cx, cy);
    if (it && it.uid !== self.uid) res.add(it);
  }
  return [...res];
}

const inGrid = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS;

/** Toutes les cases dans la grille et utilisables (si `usable` est fourni, voir usableCells). */
export function inBounds(self: Pick<ItemInst, 'defId' | 'rot'>, x: number, y: number, rot: Rot, usable?: Set<string>): boolean {
  return cellsAt(self, x, y, rot).every(([cx, cy]) => inGrid(cx, cy) && (!usable || usable.has(cellKey(cx, cy))));
}

export function canPlace(items: ItemInst[], self: ItemInst, x: number, y: number, rot: Rot, usable?: Set<string>): boolean {
  return inBounds(self, x, y, rot, usable) && overlapping(items, self, x, y, rot).length === 0;
}

/** Bord partagé entre deux objets posés : une cellule de `a` et la direction vers `b`. */
export function sharedEdge(a: ItemInst, b: ItemInst): { cx: number; cy: number; dx: number; dy: number } | null {
  if (!a.placed || !b.placed) return null;
  const bCells = new Set(cellsOf(b).map(([x, y]) => `${x},${y}`));
  for (const [cx, cy] of cellsOf(a)) {
    for (const [dx, dy] of DIRS) {
      if (bCells.has(`${cx + dx},${cy + dy}`)) return { cx, cy, dx, dy };
    }
  }
  return null;
}

// ---------- Sacoches ----------

export function bagMask(defId: string, rot: Rot): Mask {
  return maskOf(defId, rot);
}

export function bagCells(bag: Pick<BagInst, 'defId' | 'rot' | 'x' | 'y'>): [number, number][] {
  return cellsOf(bag);
}

/** Cases utilisables : le sac de base plus les cases des sacoches posées. */
export function usableCells(bags: BagInst[]): Set<string> {
  const out = new Set(BASE_CELLS);
  for (const b of bags) if (b.placed) for (const [x, y] of bagCells(b)) out.add(cellKey(x, y));
  return out;
}

export function bagAt(bags: BagInst[], cx: number, cy: number): BagInst | undefined {
  return bags.find((b) => b.placed && bagCells(b).some(([x, y]) => x === cx && y === cy));
}

/** Uids des sacoches posées reliées au sac de base (directement ou via d'autres sacoches). */
export function connectedBags(bags: BagInst[]): Set<number> {
  const placed = bags.filter((b) => b.placed);
  const reached = new Set(BASE_CELLS);
  const done = new Set<number>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const b of placed) {
      if (done.has(b.uid)) continue;
      const cells = bagCells(b);
      if (cells.some(([x, y]) => DIRS.some(([dx, dy]) => reached.has(cellKey(x + dx, y + dy))))) {
        for (const [x, y] of cells) reached.add(cellKey(x, y));
        done.add(b.uid);
        grew = true;
      }
    }
  }
  return done;
}

/** Vrai si toutes les sacoches posées sont reliées au sac de base : le sac reste d'un seul bloc. */
export function bagsConnected(bags: BagInst[]): boolean {
  return connectedBags(bags).size === bags.filter((b) => b.placed).length;
}

/** Une sacoche ne peut être déplacée (ou retirée) que si aucun objet posé n'est dessus. */
export function canMoveBag(items: ItemInst[], bag: BagInst): boolean {
  if (!bag.placed) return true;
  const cells = new Set(bagCells(bag).map(([x, y]) => cellKey(x, y)));
  return !items.some((it) => it.placed && cellsOf(it).some(([x, y]) => cells.has(cellKey(x, y))));
}

/**
 * Peut-on poser `bag` en (x, y, rot) ? Dans la grille, hors du sac de base, sans chevaucher une autre sacoche,
 * en touchant (par un bord) le sac ou une sacoche posée, et sans détacher les autres sacoches :
 * le sac reste d'un seul bloc. Si la sacoche est déjà posée (déplacement), elle doit être vide.
 */
export function canPlaceBag(bags: BagInst[], items: ItemInst[], bag: BagInst, x: number, y: number, rot: Rot): boolean {
  if (!canMoveBag(items, bag)) return false;
  const cells = cellsAt(bag, x, y, rot);
  if (!cells.every(([cx, cy]) => inGrid(cx, cy) && !BASE_SET.has(cellKey(cx, cy)))) return false;
  const others = bags.filter((b) => b.uid !== bag.uid);
  if (cells.some(([cx, cy]) => bagAt(others, cx, cy))) return false;
  const moved: BagInst = { ...bag, x, y, rot, placed: true };
  return bagsConnected([...others, moved]);
}

/** Peut-on retirer cette sacoche de la grille (vers la réserve) ? Vide, et les autres restent reliées. */
export function canRemoveBag(bags: BagInst[], items: ItemInst[], bag: BagInst): boolean {
  if (!bag.placed) return false;
  return canMoveBag(items, bag) && bagsConnected(bags.filter((b) => b.uid !== bag.uid));
}
