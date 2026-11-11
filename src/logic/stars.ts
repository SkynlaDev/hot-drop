// Étoiles (lecture « à la Backpack Battles ») : des cases précises autour d'un objet qui attendent un type d'objet.
// Une étoile est remplie quand un objet du bon type occupe une de ses cases.
// - Accessoires : une étoile sur toutes les cases voisines, qui attend une arme compatible (leur synergie).
// - Objets à étoiles (`ItemDef.stars`) : cases et effets décrits dans les données.
import { ITEMS, ItemDef, StarEffect, Tag } from '../data/items';
import { ItemInst, Rot, cellsAt, cellsOf, dims } from './grid';

/** Chargeur tambour : recharge plus lente de l'arme adjacente. */
export const DRUM_RELOAD = 0.4;

export const TAG_LABEL: Record<Tag, string> = {
  arme: 'Arme', arme_longue: 'Arme longue', melee: 'Arme de mêlée', munition: 'Munition', accessoire: 'Accessoire',
  protection: 'Protection', explosif: 'Explosif', medical: 'Soin',
};

const pct = (v: number) => `${Math.round(v * 100)} %`;

/** Accessoire compatible avec cette arme (son bonus s'applique). */
export function accessoryFits(acc: ItemDef, w: ItemDef): boolean {
  const k = acc.synergy?.kind;
  const long = w.tags.includes('arme_longue');
  if (k === 'mag') return acc.caliber === w.caliber || !!w.weapon?.feedsAny;
  if (k === 'scope' || k === 'bipod') return long;
  if (k === 'holo') return !long;
  return !!k;
}

export interface StarSpec {
  /** Cases relatives à la forme non tournée ; null = toutes les cases voisines. */
  at: [number, number][] | null;
  wants: (d: ItemDef) => boolean;
  /** Ce que l'étoile attend, pour la fiche : « Arme 9 mm ». */
  wantLabel: string;
  /** Ce qu'elle apporte : « −25 % de recharge (max 3) ». */
  text: string;
  /** Effet générique ; absent pour l'étoile d'un accessoire (sa synergie est calculée par computeLoadout). */
  effect?: StarEffect;
  max?: number;
}

function synergyText(d: ItemDef): string {
  const s = d.synergy!;
  const v = pct(s.value);
  switch (s.kind) {
    case 'mag': return `−${v} de recharge (max 3)`;
    case 'scope': return `+${v} de critique`;
    case 'silencer': return 'son 1er tir est critique';
    case 'pierce': return `perce ${v} de l'armure`;
    case 'grip': return `+${v} de cadence`;
    case 'extmag': return `chargeur +${v}`;
    case 'holo': return `+${v} de critique`;
    case 'bipod': return `+${v} de dégâts`;
    case 'drum': return `chargeur +${v}, recharge +${pct(DRUM_RELOAD)} (nourrit le Feu continu)`;
    case 'cooler': return `son Feu continu monte ${v} plus vite (passif de Viper)`;
    case 'tracer': return `quand elle consomme la Marque, +${v} de dégâts en plus (passif de Sentinelle)`;
  }
}

function synergyWant(d: ItemDef): string {
  const k = d.synergy!.kind;
  if (k === 'mag') return `Arme ${d.caliber}`;
  if (k === 'scope' || k === 'bipod') return 'Arme longue';
  if (k === 'holo') return 'Arme courte';
  return 'Arme';
}

/** Texte d'un effet générique : « +5 d'armure », « +1 charge à cet explosif ». */
export function effectText(e: StarEffect): string {
  const who = e.on === 'self' ? '' : ' à cet objet';
  switch (e.kind) {
    case 'armor': return `+${e.value} d'armure${who}`;
    case 'dmg': return `+${pct(e.value)} de dégâts${who}`;
    case 'cadence': return `+${pct(e.value)} de cadence${who}`;
    case 'charges': return `+${e.value} charge${e.value > 1 ? 's' : ''}${who}`;
    case 'heal': return `soins +${pct(e.value)}${who}`;
    case 'bleed': return `+${e.value} de saignement par coup${who}`;
  }
}

const specCache = new Map<string, StarSpec[]>();

/** Étoiles d'un type d'objet. */
export function starSpecs(defId: string): StarSpec[] {
  let out = specCache.get(defId);
  if (out) return out;
  const d = ITEMS[defId];
  out = [];
  if (d.synergy) {
    out.push({ at: null, wants: (o) => !!o.weapon && accessoryFits(d, o), wantLabel: synergyWant(d), text: synergyText(d) });
  }
  for (const s of d.stars ?? []) {
    out.push({
      at: s.at ?? null,
      wants: (o) => s.want.some((t) => o.tags.includes(t)),
      wantLabel: s.want.map((t) => TAG_LABEL[t]).join(' ou '),
      text: effectText(s.effect),
      effect: s.effect,
      max: s.max,
    });
  }
  specCache.set(defId, out);
  return out;
}

/** Un point [colonne, ligne] de la forme non tournée, après `rot` quarts de tour horaires (même repère que maskOf). */
function rotatePoint(defId: string, px: number, py: number, rot: Rot): [number, number] {
  let x = px;
  let y = py;
  let h = dims({ defId, rot: 0 }).h;
  let w = dims({ defId, rot: 0 }).w;
  for (let i = 0; i < rot; i++) {
    // rotateCw : la case (x, y) d'une forme de hauteur h passe en (h - 1 - y, x).
    [x, y] = [h - 1 - y, x];
    [w, h] = [h, w];
  }
  return [x, y];
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Cases absolues d'une étoile pour un objet posé en (x, y) avec la rotation `rot`. */
export function starCells(defId: string, x: number, y: number, rot: Rot, spec: StarSpec): [number, number][] {
  if (spec.at) return spec.at.map(([px, py]) => {
    const [rx, ry] = rotatePoint(defId, px, py, rot);
    return [x + rx, y + ry] as [number, number];
  });
  const own = cellsAt({ defId, rot }, x, y, rot);
  const mine = new Set(own.map(([cx, cy]) => `${cx},${cy}`));
  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (const [cx, cy] of own) {
    for (const [dx, dy] of N4) {
      const k = `${cx + dx},${cy + dy}`;
      if (mine.has(k) || seen.has(k)) continue;
      seen.add(k);
      out.push([cx + dx, cy + dy]);
    }
  }
  return out;
}

export interface StarFill {
  /** Objet porteur. */
  uid: number;
  /** Index de l'étoile dans starSpecs(defId). */
  spec: number;
  /** Ses cases et l'objet (compatible) qui les occupe. */
  cells: { x: number; y: number; by: number | null }[];
  /** Objets distincts qui la remplissent (au plus `max`). */
  by: number[];
}

/** État de toutes les étoiles des objets posés. */
export function bagStars(items: ItemInst[]): StarFill[] {
  const placed = items.filter((i) => i.placed);
  const at = new Map<string, ItemInst>();
  for (const it of placed) for (const [x, y] of cellsOf(it)) at.set(`${x},${y}`, it);
  const out: StarFill[] = [];
  for (const it of placed) {
    starSpecs(it.defId).forEach((spec, i) => {
      const by: number[] = [];
      const cells = starCells(it.defId, it.x, it.y, it.rot, spec).map(([x, y]) => {
        const o = at.get(`${x},${y}`);
        const ok = !!o && o !== it && spec.wants(ITEMS[o.defId]);
        if (ok && !by.includes(o!.uid) && (spec.max === undefined || by.length < spec.max)) by.push(o!.uid);
        return { x, y, by: ok ? o!.uid : null };
      });
      out.push({ uid: it.uid, spec: i, cells, by });
    });
  }
  return out;
}

/**
 * Étoiles qu'un objet allumerait s'il était posé en (x, y, rot) : celles des objets déjà posés qu'il remplirait,
 * et les siennes que des objets posés rempliraient.
 */
export function starsLitBy(items: ItemInst[], cand: ItemInst, x: number, y: number, rot: Rot): StarFill[] {
  const ghost: ItemInst = { ...cand, x, y, rot, placed: true };
  const others = items.filter((i) => i.placed && i.uid !== cand.uid);
  return bagStars([...others, ghost]).filter((f) => f.by.length > 0 && (f.uid === cand.uid || f.by.includes(cand.uid)));
}
