import { ITEMS } from '../data/items';

/** Taille maximale du gilet. On commence avec un bloc central débloqué et on l'agrandit. */
export const COLS = 7;
export const ROWS = 7;
/** Bloc débloqué au départ : colonnes 1 à 5, lignes 1 à 5. */
export const START_UNLOCKED: string[] = (() => {
  const out: string[] = [];
  for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) out.push(`${x},${y}`);
  return out;
})();
export const cellKey = (x: number, y: number) => `${x},${y}`;

/** Rotation par pas de 90° dans le sens horaire. */
export type Rot = 0 | 1 | 2 | 3;

export interface ItemInst {
  uid: number;
  defId: string;
  rarity: number;
  rot: Rot;
  x: number;
  y: number;
  placed: boolean;
}

export type Zone = 'poitrine' | 'flancs' | 'ceinture' | 'epaules';
export type Mask = boolean[][];

const maskCache = new Map<string, Mask>();

function rotateCw(m: Mask): Mask {
  const h = m.length;
  const w = m[0].length;
  return Array.from({ length: w }, (_, r) => Array.from({ length: h }, (__, c) => m[h - 1 - c][r]));
}

/** Masque de l'objet (lignes × colonnes) pour une rotation donnée. */
export function maskOf(defId: string, rot: Rot): Mask {
  const key = `${defId}:${rot}`;
  let m = maskCache.get(key);
  if (!m) {
    m = ITEMS[defId].shape.map((row) => [...row].map((ch) => ch === 'X'));
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
  return ITEMS[defId].shape.join('').split('').filter((c) => c === 'X').length;
}

/** Boîte englobante de l'objet. */
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

export function cellsOf(inst: ItemInst): [number, number][] {
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

/** Toutes les cases dans la grille et débloquées (si `unlocked` est fourni). */
export function inBounds(self: Pick<ItemInst, 'defId' | 'rot'>, x: number, y: number, rot: Rot, unlocked?: Set<string>): boolean {
  return cellsAt(self, x, y, rot).every(([cx, cy]) => cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS && (!unlocked || unlocked.has(cellKey(cx, cy))));
}

export function canPlace(items: ItemInst[], self: ItemInst, x: number, y: number, rot: Rot, unlocked?: Set<string>): boolean {
  return inBounds(self, x, y, rot, unlocked) && overlapping(items, self, x, y, rot).length === 0;
}

/** Cases verrouillées qu'on peut débloquer : voisines d'une case déjà débloquée. */
export function expandable(unlocked: Set<string>): Set<string> {
  const out = new Set<string>();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (unlocked.has(cellKey(x, y))) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => unlocked.has(cellKey(x + dx, y + dy)))) out.add(cellKey(x, y));
    }
  }
  return out;
}

/** Bord partagé entre deux objets posés : une cellule de `a` et la direction vers `b`. */
export function sharedEdge(a: ItemInst, b: ItemInst): { cx: number; cy: number; dx: number; dy: number } | null {
  if (!a.placed || !b.placed) return null;
  const bCells = new Set(cellsOf(b).map(([x, y]) => `${x},${y}`));
  for (const [cx, cy] of cellsOf(a)) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (bCells.has(`${cx + dx},${cy + dy}`)) return { cx, cy, dx, dy };
    }
  }
  return null;
}

export function cellZones(cx: number, cy: number): Zone[] {
  const z: Zone[] = [];
  if (cx >= 2 && cx <= 4 && cy >= 1 && cy <= 3) z.push('poitrine');
  if (cx === 0 || cx === COLS - 1) z.push('flancs');
  if (cy === ROWS - 1) z.push('ceinture');
  return z;
}

/** Vrai si au moins une case de l'objet est dans la zone. */
export function inZone(inst: ItemInst, zone: Zone): boolean {
  return inst.placed && cellsOf(inst).some(([x, y]) => cellZones(x, y).includes(zone));
}
