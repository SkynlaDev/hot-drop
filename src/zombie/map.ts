// Mode Zombie : la carte. Logique pure (sans Phaser) : décors, génération procédurale des obstacles par
// morceaux (« chunks ») déterministes selon une graine, collisions cercle / obstacle, ligne de tir, et un
// champ de flux sur une grille grossière pour que les zombies contournent les obstacles.
//
// Le monde reste infini : il est découpé en morceaux de 16 × 16 cases de 64 px. Chaque obstacle occupe une
// empreinte de cases entières (son collisionneur est un rectangle ou un cercle à l'intérieur). La couronne
// de cases au bord de chaque morceau reste toujours libre : deux morceaux voisins sont donc séparés par une
// « rue » de 2 cases, et tout l'espace libre d'un morceau est relié à sa couronne (vérifié à chaque
// obstacle posé) : aucun enclos fermé, tout l'espace praticable est connecté.
import { hashParts, mulberry32 } from '../logic/rng';

export const CELL = 64;
export const CHUNK_CELLS = 16;
export const CHUNK = CELL * CHUNK_CELLS;
/** Rayon dégagé autour du point de départ (0, 0). */
export const START_CLEAR = 380;
/** Rayon de collision maximal contre les obstacles (les gros zombies se faufilent : rues de 64 px). */
export const MAX_OBSTACLE_R = 24;

export type ThemeId = 'ville' | 'foret' | 'port';
export const THEME_IDS: ThemeId[] = ['ville', 'foret', 'port'];

export interface ObstacleDef {
  /** Clé du sprite (public/art/zombie/carte/<id>.png). */
  id: string;
  /** Empreinte en cases. */
  cw: number;
  ch: number;
  shape: 'rect' | 'circle';
  /** Marge entre l'empreinte et le collisionneur (px), par côté : gauche/droite, haut, bas. */
  ix: number;
  top: number;
  bottom: number;
}

/** Structures de la génération : un obstacle seul, une ligne (avec une brèche), un bosquet. */
type Structure =
  | { kind: 'one'; defs: string[]; w: number }
  | { kind: 'line'; defs: string[]; min: number; max: number; dir: 'h' | 'v' | 'any'; w: number }
  | { kind: 'cluster'; defs: string[]; min: number; max: number; spread: number; w: number };

export interface Theme {
  id: ThemeId;
  name: string;
  ground: string;
  /** Teinte du fond de la caméra (sous le sol). */
  defs: Record<string, ObstacleDef>;
  structures: Structure[];
  /** Nombre de structures tentées par morceau. */
  tries: number;
}

const D = (id: string, cw: number, ch: number, shape: 'rect' | 'circle', ix: number, top: number, bottom: number): ObstacleDef => ({ id, cw, ch, shape, ix, top, bottom });

export const THEMES: Record<ThemeId, Theme> = {
  ville: {
    id: 'ville',
    name: 'Ville en ruine',
    ground: 'sol',
    defs: {
      voiture: D('voiture', 2, 1, 'rect', 8, 10, 4),
      voiture2: D('voiture2', 2, 1, 'rect', 8, 10, 4),
      voiture_v: D('voiture_v', 1, 2, 'rect', 10, 8, 4),
      bus: D('bus', 4, 1, 'rect', 8, 6, 4),
      muret: D('muret', 2, 1, 'rect', 2, 18, 12),
      barricade: D('barricade', 1, 1, 'rect', 6, 16, 8),
      gravats: D('gravats', 2, 2, 'rect', 12, 14, 10),
    },
    structures: [
      { kind: 'line', defs: ['muret'], min: 3, max: 5, dir: 'any', w: 3 },
      { kind: 'line', defs: ['barricade'], min: 3, max: 6, dir: 'any', w: 2 },
      { kind: 'line', defs: ['voiture', 'voiture2'], min: 2, max: 3, dir: 'h', w: 2 },
      { kind: 'one', defs: ['voiture', 'voiture2', 'voiture_v'], w: 4 },
      { kind: 'one', defs: ['bus'], w: 1 },
      { kind: 'one', defs: ['gravats'], w: 2 },
    ],
    tries: 13,
  },
  foret: {
    id: 'foret',
    name: 'Forêt',
    ground: 'sol-foret',
    defs: {
      sapin: D('sapin', 1, 1, 'circle', 10, 10, 10),
      arbre_mort: D('arbre_mort', 1, 1, 'circle', 12, 12, 12),
      rocher: D('rocher', 2, 2, 'circle', 10, 10, 10),
      tronc: D('tronc', 3, 1, 'rect', 6, 18, 12),
    },
    structures: [
      { kind: 'cluster', defs: ['sapin', 'sapin', 'arbre_mort'], min: 4, max: 9, spread: 3, w: 6 },
      { kind: 'one', defs: ['rocher'], w: 2 },
      { kind: 'line', defs: ['tronc'], min: 1, max: 2, dir: 'h', w: 2 },
      { kind: 'one', defs: ['sapin', 'arbre_mort'], w: 2 },
    ],
    tries: 14,
  },
  port: {
    id: 'port',
    name: 'Port industriel',
    ground: 'sol-port',
    defs: {
      conteneur: D('conteneur', 3, 1, 'rect', 2, 6, 2),
      conteneur2: D('conteneur2', 3, 1, 'rect', 2, 6, 2),
      conteneur_v: D('conteneur_v', 1, 3, 'rect', 4, 4, 2),
      caisses: D('caisses', 1, 1, 'rect', 6, 10, 4),
      futs: D('futs', 1, 1, 'circle', 8, 8, 8),
    },
    structures: [
      { kind: 'line', defs: ['conteneur', 'conteneur2'], min: 2, max: 3, dir: 'h', w: 3 },
      { kind: 'line', defs: ['conteneur_v'], min: 2, max: 4, dir: 'h', w: 2 },
      { kind: 'cluster', defs: ['caisses', 'futs'], min: 3, max: 6, spread: 2, w: 3 },
      { kind: 'one', defs: ['conteneur', 'conteneur2', 'conteneur_v'], w: 2 },
    ],
    tries: 12,
  },
};

export interface Obstacle {
  def: ObstacleDef;
  /** Case en haut à gauche de l'empreinte (coordonnées de cases du monde). */
  gx: number;
  gy: number;
  /** Collisionneur : rectangle [x0, x1] × [y0, y1], ou cercle (cx, cy, r). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  r: number;
  circle: boolean;
}

export interface Chunk {
  cx: number;
  cy: number;
  /** Par case du morceau : 0 libre, sinon index de l'obstacle + 1. */
  mask: Int16Array;
  obstacles: Obstacle[];
}

const key = (cx: number, cy: number) => (cx + 0x8000) * 0x10000 + (cy + 0x8000);

function makeObstacle(def: ObstacleDef, gx: number, gy: number): Obstacle {
  const fx0 = gx * CELL;
  const fy0 = gy * CELL;
  const fx1 = fx0 + def.cw * CELL;
  const fy1 = fy0 + def.ch * CELL;
  const x0 = fx0 + def.ix;
  const x1 = fx1 - def.ix;
  const y0 = fy0 + def.top;
  const y1 = fy1 - def.bottom;
  const circle = def.shape === 'circle';
  return { def, gx, gy, x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, r: Math.min(x1 - x0, y1 - y0) / 2, circle };
}

/** Génère un morceau (pur et déterministe : même graine, même décor, mêmes coordonnées → même morceau). */
export function generateChunk(theme: Theme, seed: number, cx: number, cy: number): Chunk {
  const N = CHUNK_CELLS;
  const rng = mulberry32(hashParts('zcarte', seed, theme.id, cx, cy));
  const mask = new Int16Array(N * N);
  const reserved = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (x === 0 || y === 0 || x === N - 1 || y === N - 1) reserved[y * N + x] = 1;
      // Zone de départ dégagée (toute case qui touche le disque).
      const wx = Math.max((cx * N + x) * CELL, Math.min(0, (cx * N + x + 1) * CELL));
      const wy = Math.max((cy * N + y) * CELL, Math.min(0, (cy * N + y + 1) * CELL));
      if (wx * wx + wy * wy < START_CLEAR * START_CLEAR) reserved[y * N + x] = 1;
    }
  }
  const obstacles: Obstacle[] = [];
  const total = theme.structures.reduce((s, x) => s + x.w, 0);
  const pick = <T,>(a: T[]) => a[Math.floor(rng() * a.length)];
  const fits = (def: ObstacleDef, lx: number, ly: number) => {
    if (lx < 1 || ly < 1 || lx + def.cw > N - 1 || ly + def.ch > N - 1) return false;
    for (let y = ly; y < ly + def.ch; y++) for (let x = lx; x < lx + def.cw; x++) if (mask[y * N + x] || reserved[y * N + x]) return false;
    return true;
  };
  const put = (def: ObstacleDef, lx: number, ly: number) => {
    obstacles.push(makeObstacle(def, cx * N + lx, cy * N + ly));
    const v = obstacles.length;
    for (let y = ly; y < ly + def.ch; y++) for (let x = lx; x < lx + def.cw; x++) mask[y * N + x] = v;
  };
  const undo = (n: number) => {
    while (obstacles.length > n) {
      const v = obstacles.length;
      for (let i = 0; i < mask.length; i++) if (mask[i] === v) mask[i] = 0;
      obstacles.pop();
    }
  };
  for (let t = 0; t < theme.tries; t++) {
    let r = rng() * total;
    let st = theme.structures[0];
    for (const s of theme.structures) {
      r -= s.w;
      if (r < 0) {
        st = s;
        break;
      }
    }
    const before = obstacles.length;
    if (st.kind === 'one') {
      const def = theme.defs[pick(st.defs)];
      const lx = 1 + Math.floor(rng() * (N - 1 - def.cw));
      const ly = 1 + Math.floor(rng() * (N - 1 - def.ch));
      if (fits(def, lx, ly)) put(def, lx, ly);
    } else if (st.kind === 'line') {
      const n = st.min + Math.floor(rng() * (st.max - st.min + 1));
      const horiz = st.dir === 'h' || (st.dir === 'any' && rng() < 0.5);
      // Une brèche (une pièce manquante) dans les lignes de 3 et plus : un goulot.
      const gap = n >= 3 ? 1 + Math.floor(rng() * (n - 2)) : -1;
      let lx = 1 + Math.floor(rng() * (N - 2));
      let ly = 1 + Math.floor(rng() * (N - 2));
      for (let k = 0; k < n; k++) {
        const def = theme.defs[pick(st.defs)];
        if (k !== gap && fits(def, lx, ly)) put(def, lx, ly);
        if (horiz) lx += def.cw;
        else ly += def.ch;
      }
    } else {
      const n = st.min + Math.floor(rng() * (st.max - st.min + 1));
      const ox = 2 + Math.floor(rng() * (N - 4));
      const oy = 2 + Math.floor(rng() * (N - 4));
      for (let k = 0; k < n; k++) {
        const def = theme.defs[pick(st.defs)];
        const lx = ox + Math.round((rng() * 2 - 1) * st.spread);
        const ly = oy + Math.round((rng() * 2 - 1) * st.spread);
        if (fits(def, lx, ly)) put(def, lx, ly);
      }
    }
    if (obstacles.length > before && !allConnected(mask, N)) undo(before);
  }
  return { cx, cy, mask, obstacles };
}

/** Toutes les cases libres du morceau sont-elles reliées à sa couronne (4-voisinage) ? */
export function allConnected(mask: Int16Array, N: number): boolean {
  const seen = new Uint8Array(N * N);
  const stack: number[] = [];
  let free = 0;
  for (let i = 0; i < N * N; i++) {
    if (mask[i]) continue;
    free++;
    const x = i % N;
    const y = (i / N) | 0;
    if (x === 0 || y === 0 || x === N - 1 || y === N - 1) {
      seen[i] = 1;
      stack.push(i);
    }
  }
  let reached = stack.length;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % N;
    const y = (i / N) | 0;
    if (x > 0) reached += visit(i - 1);
    if (x < N - 1) reached += visit(i + 1);
    if (y > 0) reached += visit(i - N);
    if (y < N - 1) reached += visit(i + N);
  }
  return reached === free;
  function visit(j: number): number {
    if (seen[j] || mask[j]) return 0;
    seen[j] = 1;
    stack.push(j);
    return 1;
  }
}

/** La carte d'une partie : morceaux générés à la demande, collisions, ligne de tir. */
export class GameMap {
  readonly theme: Theme;
  private chunks = new Map<number, Chunk>();
  private lastKey = NaN;
  private lastChunk: Chunk | null = null;
  /** Résultat de resolve() (évite d'allouer). */
  rx = 0;
  ry = 0;

  constructor(theme: ThemeId, readonly seed: number) {
    this.theme = THEMES[theme];
  }

  chunk(cx: number, cy: number): Chunk {
    const k = key(cx, cy);
    if (k === this.lastKey) return this.lastChunk!;
    let c = this.chunks.get(k);
    if (!c) {
      // Oubli des morceaux lointains (une partie très longue en traverse des centaines).
      if (this.chunks.size > 600) this.chunks.clear();
      c = generateChunk(this.theme, this.seed, cx, cy);
      this.chunks.set(k, c);
    }
    this.lastKey = k;
    this.lastChunk = c;
    return c;
  }

  /** Obstacle dont l'empreinte couvre la case (gx, gy), ou null. */
  at(gx: number, gy: number): Obstacle | null {
    const cx = Math.floor(gx / CHUNK_CELLS);
    const cy = Math.floor(gy / CHUNK_CELLS);
    const c = this.chunk(cx, cy);
    const v = c.mask[(gy - cy * CHUNK_CELLS) * CHUNK_CELLS + (gx - cx * CHUNK_CELLS)];
    return v ? c.obstacles[v - 1] : null;
  }

  solidCell(gx: number, gy: number): boolean {
    return this.at(gx, gy) !== null;
  }

  /** Le point est-il dans un collisionneur ? */
  blocked(x: number, y: number): boolean {
    const o = this.at(Math.floor(x / CELL), Math.floor(y / CELL));
    return !!o && inside(o, x, y, 0);
  }

  /**
   * Pousse un cercle (x, y, r) hors des obstacles qu'il chevauche. Résultat dans rx, ry ; renvoie true s'il y
   * avait contact. Glissement naturel le long des bords (seule la composante qui entre est annulée).
   */
  resolve(x: number, y: number, r: number): boolean {
    let hit = false;
    const gx0 = Math.floor((x - r) / CELL);
    const gx1 = Math.floor((x + r) / CELL);
    const gy0 = Math.floor((y - r) / CELL);
    const gy1 = Math.floor((y + r) / CELL);
    let prev: Obstacle | null = null;
    let prev2: Obstacle | null = null;
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const o = this.at(gx, gy);
        if (!o || o === prev || o === prev2) continue;
        prev2 = prev;
        prev = o;
        if (o.circle) {
          const dx = x - o.cx;
          const dy = y - o.cy;
          const rr = r + o.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2);
          if (d < 1e-6) {
            y = o.cy + rr;
          } else {
            x = o.cx + (dx / d) * rr;
            y = o.cy + (dy / d) * rr;
          }
          hit = true;
        } else {
          const qx = x < o.x0 ? o.x0 : x > o.x1 ? o.x1 : x;
          const qy = y < o.y0 ? o.y0 : y > o.y1 ? o.y1 : y;
          const dx = x - qx;
          const dy = y - qy;
          const d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;
          if (d2 > 1e-9) {
            const d = Math.sqrt(d2);
            x = qx + (dx / d) * r;
            y = qy + (dy / d) * r;
          } else {
            // Centre dans le rectangle : sortie par le bord le plus proche.
            const l = x - o.x0;
            const rt = o.x1 - x;
            const t = y - o.y0;
            const b = o.y1 - y;
            const m = Math.min(l, rt, t, b);
            if (m === l) x = o.x0 - r;
            else if (m === rt) x = o.x1 + r;
            else if (m === t) y = o.y0 - r;
            else y = o.y1 + r;
          }
          hit = true;
        }
      }
    }
    this.rx = x;
    this.ry = y;
    return hit;
  }

  /** Ligne de tir dégagée entre deux points au sol ? (pas de 20 px) */
  clearLine(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const n = Math.ceil(Math.hypot(dx, dy) / 20);
    for (let i = 1; i < n; i++) {
      const f = i / n;
      if (this.blocked(x0 + dx * f, y0 + dy * f)) return false;
    }
    return true;
  }

  /** Centre de la case libre la plus proche de (x, y) (la case elle-même si elle est libre). */
  freeSpot(x: number, y: number): [number, number] {
    const gx = Math.floor(x / CELL);
    const gy = Math.floor(y / CELL);
    if (!this.solidCell(gx, gy)) return [x, y];
    for (let r = 1; r <= 4; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!this.solidCell(gx + dx, gy + dy)) return [(gx + dx + 0.5) * CELL, (gy + dy + 0.5) * CELL];
        }
      }
    }
    return [x, y];
  }

  /** Le disque (x, y, r) ne touche-t-il aucune empreinte d'obstacle ? */
  areaFree(x: number, y: number, r: number): boolean {
    for (let gy = Math.floor((y - r) / CELL); gy <= Math.floor((y + r) / CELL); gy++) {
      for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++) {
        const qx = Math.max(gx * CELL, Math.min(x, (gx + 1) * CELL));
        const qy = Math.max(gy * CELL, Math.min(y, (gy + 1) * CELL));
        if ((qx - x) ** 2 + (qy - y) ** 2 < r * r && this.solidCell(gx, gy)) return false;
      }
    }
    return true;
  }

  /** Obstacles dont l'empreinte touche le rectangle (pour l'affichage). */
  obstaclesIn(x0: number, y0: number, x1: number, y1: number, out: Obstacle[]): Obstacle[] {
    out.length = 0;
    const c0x = Math.floor(x0 / CHUNK);
    const c1x = Math.floor(x1 / CHUNK);
    const c0y = Math.floor(y0 / CHUNK);
    const c1y = Math.floor(y1 / CHUNK);
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        for (const o of this.chunk(cx, cy).obstacles) {
          if ((o.gx + o.def.cw) * CELL < x0 || o.gx * CELL > x1 || (o.gy + o.def.ch) * CELL < y0 || o.gy * CELL > y1) continue;
          out.push(o);
        }
      }
    }
    return out;
  }
}

function inside(o: Obstacle, x: number, y: number, pad: number): boolean {
  if (o.circle) return (x - o.cx) ** 2 + (y - o.cy) ** 2 < (o.r + pad) ** 2;
  return x > o.x0 - pad && x < o.x1 + pad && y > o.y0 - pad && y < o.y1 + pad;
}

/* ------------------------------------------------------------------ */
/* Champ de flux                                                       */
/* ------------------------------------------------------------------ */

const FLOW_N = 48; // 3 072 px de côté autour de la cible
const INF = 0x7fff;

/**
 * Distances (en cases, 4-voisinage) jusqu'à une cible, sur une grille de 48 × 48 cases de 64 px alignée sur
 * celle de la carte. Chaque case retient la case voisine (8-voisinage, sans couper les coins) qui rapproche
 * le plus : un zombie vise le centre de cette case-là. Recalculé quand la cible change de case.
 */
export class FlowField {
  readonly dist = new Int16Array(FLOW_N * FLOW_N);
  readonly next = new Int32Array(FLOW_N * FLOW_N);
  private queue = new Int32Array(FLOW_N * FLOW_N);
  private solid = new Uint8Array(FLOW_N * FLOW_N);
  ox = 0;
  oy = 0;
  private tgx = NaN;
  private tgy = NaN;
  /** Résultat de steer() : point à viser. */
  tx = 0;
  ty = 0;
  /** Distance (cases) de la case interrogée, et si la cible y est en vue (rien entre les deux). */
  d = 0;
  visible = true;
  /** Vue directe de chaque case vers la cible : -1 inconnu (calcul paresseux), 0 non, 1 oui. */
  private vis = new Int8Array(FLOW_N * FLOW_N);
  private px = 0;
  private py = 0;

  constructor(readonly map: GameMap) {}

  /** Recalcule si la cible a changé de case. Renvoie true si recalculé. */
  update(x: number, y: number, force = false): boolean {
    const gx = Math.floor(x / CELL);
    const gy = Math.floor(y / CELL);
    if (!force && gx === this.tgx && gy === this.tgy) return false;
    this.px = x;
    this.py = y;
    this.vis.fill(-1);
    this.tgx = gx;
    this.tgy = gy;
    const N = FLOW_N;
    this.ox = gx - N / 2;
    this.oy = gy - N / 2;
    const { dist, next, queue, solid } = this;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) solid[j * N + i] = this.map.solidCell(this.ox + i, this.oy + j) ? 1 : 0;
    dist.fill(INF);
    const start = (N / 2) * N + N / 2;
    dist[start] = 0;
    let qh = 0;
    let qt = 0;
    queue[qt++] = start;
    while (qh < qt) {
      const c = queue[qh++];
      const cx = c % N;
      const cy = (c / N) | 0;
      const nd = dist[c] + 1;
      if (cx > 0 && !solid[c - 1] && dist[c - 1] > nd) (dist[c - 1] = nd), (queue[qt++] = c - 1);
      if (cx < N - 1 && !solid[c + 1] && dist[c + 1] > nd) (dist[c + 1] = nd), (queue[qt++] = c + 1);
      if (cy > 0 && !solid[c - N] && dist[c - N] > nd) (dist[c - N] = nd), (queue[qt++] = c - N);
      if (cy < N - 1 && !solid[c + N] && dist[c + N] > nd) (dist[c + N] = nd), (queue[qt++] = c + N);
    }
    for (let cy = 0; cy < N; cy++) {
      for (let cx = 0; cx < N; cx++) {
        const c = cy * N + cx;
        let best = -1;
        let bestV = solid[c] ? Infinity : dist[c] * 2;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const x = cx + dx;
            const y = cy + dy;
            if (x < 0 || y < 0 || x >= N || y >= N) continue;
            const o = y * N + x;
            if (solid[o] || dist[o] === INF) continue;
            // Diagonale : seulement si les deux cases orthogonales sont libres (pas de coin coupé).
            if (dx && dy && (solid[cy * N + x] || solid[y * N + cx])) continue;
            // Une diagonale fait gagner 2 cases de 4-voisinage : à gain égal, elle passe devant.
            const v = dist[o] * 2 - (dx && dy ? 1 : 0);
            if (v < bestV) {
              best = o;
              bestV = v;
            }
          }
        }
        next[c] = best;
      }
    }
    return true;
  }

  /**
   * Où aller depuis (x, y) pour rejoindre la cible : tx, ty (centre de la prochaine case). Renvoie false hors de
   * la grille ou si la case n'a pas de chemin (le zombie va alors tout droit).
   */
  steer(x: number, y: number): boolean {
    const N = FLOW_N;
    const i = Math.floor(x / CELL) - this.ox;
    const j = Math.floor(y / CELL) - this.oy;
    if (i < 0 || j < 0 || i >= N || j >= N) return false;
    const c = j * N + i;
    const d = this.dist[c];
    this.d = d;
    let v = this.vis[c];
    if (v < 0) v = this.vis[c] = this.lineFree((this.ox + i + 0.5) * CELL, (this.oy + j + 0.5) * CELL) ? 1 : 0;
    this.visible = v === 1;
    const n = this.next[c];
    if (n < 0) return false;
    // Deux cases plus loin quand c'est possible : une trajectoire plus souple que case par case.
    const n2 = this.next[n];
    const t = n2 >= 0 && this.lineFreeGrid(c, n2) ? n2 : n;
    this.tx = (this.ox + (t % N) + 0.5) * CELL;
    this.ty = (this.oy + ((t / N) | 0) + 0.5) * CELL;
    return true;
  }

  /** Segment (centre de case → cible) sans case pleine (empreintes : prudent). */
  private lineFree(x: number, y: number): boolean {
    const dx = this.px - x;
    const dy = this.py - y;
    const n = Math.ceil(Math.hypot(dx, dy) / 24);
    for (let k = 1; k < n; k++) if (this.solidAt(x + (dx * k) / n, y + (dy * k) / n)) return false;
    return true;
  }

  /** Deux cases de la grille se voient-elles (aucune case pleine entre leurs centres) ? */
  private lineFreeGrid(a: number, b: number): boolean {
    const N = FLOW_N;
    const ax = (a % N) + 0.5;
    const ay = ((a / N) | 0) + 0.5;
    const bx = (b % N) + 0.5;
    const by = ((b / N) | 0) + 0.5;
    for (let k = 1; k < 4; k++) {
      const x = Math.floor(ax + ((bx - ax) * k) / 4);
      const y = Math.floor(ay + ((by - ay) * k) / 4);
      if (this.solid[y * N + x]) return false;
    }
    return true;
  }

  private solidAt(x: number, y: number): boolean {
    const i = Math.floor(x / CELL) - this.ox;
    const j = Math.floor(y / CELL) - this.oy;
    if (i < 0 || j < 0 || i >= FLOW_N || j >= FLOW_N) return this.map.solidCell(Math.floor(x / CELL), Math.floor(y / CELL));
    return this.solid[j * FLOW_N + i] === 1;
  }
}
