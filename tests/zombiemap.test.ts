import { describe, expect, it } from 'vitest';
import { CELL, CHUNK, CHUNK_CELLS, FlowField, GameMap, START_CLEAR, THEMES, THEME_IDS, allConnected, generateChunk } from '../src/zombie/map';
import { LZ, newLanding, openLanding, placeLanding, stepLanding } from '../src/zombie/extraction';
import { RUN_TIME } from '../src/zombie/data';
import { World } from '../src/zombie/world';
import { mulberry32 } from '../src/logic/rng';

const LO = { weapon: 'fusil_assaut' as const, weaponLevel: 1, accessories: [], perk: 'medecin' as const };

describe('mode zombie, carte : génération', () => {
  it('déterministe par graine, différente d’une graine à l’autre', () => {
    for (const t of THEME_IDS) {
      const a = generateChunk(THEMES[t], 7, 2, -3);
      const b = generateChunk(THEMES[t], 7, 2, -3);
      const c = generateChunk(THEMES[t], 8, 2, -3);
      expect(Array.from(a.mask)).toEqual(Array.from(b.mask));
      expect(Array.from(a.mask)).not.toEqual(Array.from(c.mask));
    }
  });

  it('assez d’obstacles pour faire des couloirs, sans tout boucher', () => {
    for (const t of THEME_IDS) {
      let obs = 0;
      let cells = 0;
      for (let cy = 1; cy < 5; cy++) {
        for (let cx = 1; cx < 5; cx++) {
          const ch = generateChunk(THEMES[t], 3, cx, cy);
          obs += ch.obstacles.length;
          cells += ch.mask.reduce((s, v) => s + (v ? 1 : 0), 0);
        }
      }
      const fill = cells / (16 * CHUNK_CELLS * CHUNK_CELLS);
      expect(obs / 16, t).toBeGreaterThan(5);
      expect(fill, t).toBeGreaterThan(0.12);
      expect(fill, t).toBeLessThan(0.4);
    }
  });

  it('zone de départ dégagée', () => {
    for (const t of THEME_IDS) {
      for (let seed = 1; seed <= 6; seed++) {
        const m = new GameMap(t, seed);
        expect(m.areaFree(0, 0, START_CLEAR - 2)).toBe(true);
      }
    }
  });

  it('pas d’enclos : tout l’espace libre est relié (morceau par morceau, et sur une grande zone)', () => {
    for (const t of THEME_IDS) {
      for (let k = 0; k < 30; k++) {
        const ch = generateChunk(THEMES[t], k, k - 15, 3 - k);
        expect(allConnected(ch.mask, CHUNK_CELLS)).toBe(true);
        // La couronne reste libre : les morceaux se rejoignent par des rues.
        for (let i = 0; i < CHUNK_CELLS; i++) {
          expect(ch.mask[i]).toBe(0);
          expect(ch.mask[i * CHUNK_CELLS]).toBe(0);
        }
      }
      // Remplissage depuis le départ sur 5 × 5 morceaux : toutes les cases libres sont atteintes.
      const m = new GameMap(t, 11);
      const n = CHUNK_CELLS * 5;
      const g0 = -CHUNK_CELLS * 2;
      const seen = new Uint8Array(n * n);
      let free = 0;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!m.solidCell(g0 + x, g0 + y)) free++;
      const st = [(-g0) * n + -g0];
      seen[st[0]] = 1;
      let reached = 1;
      while (st.length) {
        const c = st.pop()!;
        const x = c % n;
        const y = (c / n) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
          const j = ny * n + nx;
          if (seen[j] || m.solidCell(g0 + nx, g0 + ny)) continue;
          seen[j] = 1;
          reached++;
          st.push(j);
        }
      }
      expect(reached).toBe(free);
    }
  });
});

/** Trouve un obstacle rectangulaire de la carte (pour les tests de collision). */
function someRect(m: GameMap) {
  for (let cy = 1; cy < 6; cy++) for (let cx = 1; cx < 6; cx++) for (const o of m.chunk(cx, cy).obstacles) if (!o.circle && o.x1 - o.x0 > 100) return o;
  throw new Error('aucun rectangle');
}

describe('mode zombie, carte : collisions', () => {
  it('un cercle est repoussé hors d’un rectangle, et glisse le long du bord', () => {
    const m = new GameMap('ville', 5);
    const o = someRect(m);
    const mx = (o.x0 + o.x1) / 2;
    // Juste au-dessus du bord haut, en chevauchement : ressort vers le haut, x conservé (glissement).
    expect(m.resolve(mx, o.y0 + 5, 18)).toBe(true);
    expect(m.ry).toBeCloseTo(o.y0 - 18);
    expect(m.rx).toBeCloseTo(mx);
    // Centre en plein dedans : sortie par le bord le plus proche.
    expect(m.resolve(mx, o.y1 - 3, 18)).toBe(true);
    expect(m.ry).toBeCloseTo(o.y1 + 18);
    // Loin : rien.
    expect(m.resolve(mx, o.y0 - 40, 18)).toBe(false);
    expect(m.blocked(mx, (o.y0 + o.y1) / 2)).toBe(true);
    expect(m.clearLine(mx, o.y0 - 60, mx, o.y1 + 60)).toBe(false);
    expect(m.clearLine(mx, o.y0 - 60, mx + 10, o.y0 - 60)).toBe(true);
  });

  it('un cercle contre un obstacle rond', () => {
    const m = new GameMap('foret', 2);
    let o = null;
    for (let cy = 1; cy < 4 && !o; cy++) for (let cx = 1; cx < 4 && !o; cx++) o = m.chunk(cx, cy).obstacles.find((x) => x.circle) ?? null;
    expect(o).not.toBeNull();
    expect(m.resolve(o!.cx + 5, o!.cy, 16)).toBe(true);
    expect(Math.hypot(m.rx - o!.cx, m.ry - o!.cy)).toBeCloseTo(o!.r + 16);
  });

  it('champ de flux : un zombie contourne les obstacles et rejoint le soldat', () => {
    for (const t of THEME_IDS) {
      const m = new GameMap(t, 21);
      // Le soldat derrière un obstacle, l'agent de l'autre côté.
      const o = someRect(m) ?? m.chunk(1, 1).obstacles[0];
      const [px, py] = m.freeSpot((o.x0 + o.x1) / 2, o.y1 + 40);
      const [ax0, ay0] = m.freeSpot(px, o.y0 - 140);
      let ax = ax0;
      let ay = ay0;
      const f = new FlowField(m);
      f.update(px, py, true);
      for (let i = 0; i < 1200 && Math.hypot(ax - px, ay - py) > 30; i++) {
        let dx = px - ax;
        let dy = py - ay;
        if (f.steer(ax, ay) && !f.visible) {
          dx = f.tx - ax;
          dy = f.ty - ay;
        }
        const l = Math.hypot(dx, dy) || 1;
        ax += (dx / l) * 2;
        ay += (dy / l) * 2;
        if (m.resolve(ax, ay, 16)) {
          ax = m.rx;
          ay = m.ry;
        }
      }
      expect(Math.hypot(ax - px, ay - py), t).toBeLessThanOrEqual(30);
    }
  });
});

describe('mode zombie, carte : extraction', () => {
  it('zone placée à distance, sans obstacle', () => {
    for (const t of THEME_IDS) {
      for (let s = 0; s < 8; s++) {
        const m = new GameMap(t, s);
        const px = s * 700 - 2000;
        const py = 1500 - s * 333;
        const [x, y] = placeLanding(m, px, py, mulberry32(s));
        const d = Math.hypot(x - px, y - py);
        expect(d).toBeGreaterThan(LZ.distMin - 1);
        expect(d).toBeLessThan(LZ.distMax + 1);
        expect(m.areaFree(x, y, LZ.radius * 0.7)).toBe(true);
      }
    }
  });

  it('il faut tenir dans la zone ; dehors, la progression redescend', () => {
    const l = newLanding();
    expect(stepLanding(l, 0, 0, 1)).toBe(false);
    openLanding(l, 100, 0);
    for (let i = 0; i < 5; i++) stepLanding(l, 100, 0, 1);
    expect(l.t).toBe(5);
    expect(l.inside).toBe(true);
    stepLanding(l, 1000, 0, 2);
    expect(l.inside).toBe(false);
    expect(l.t).toBe(5 - 2 * LZ.decay);
    let done = false;
    for (let i = 0; i < 20 && !done; i++) done = stepLanding(l, 120, 20, 1);
    expect(done).toBe(true);
  });

  it('dans la partie : la zone s’ouvre à 10:00, l’atteindre et tenir = extraction (victoire)', () => {
    const w = new World(LO, mulberry32(4), new GameMap('port', 4));
    w.time = RUN_TIME - 0.01;
    w.update(0.02);
    expect(w.lz.active).toBe(true);
    expect(w.endless).toBe(true);
    expect(w.extracted).toBe(false);
    expect(w.result().won).toBe(false);
    // Téléporté dans la zone, invulnérable : il tient.
    w.px = w.lz.x;
    w.py = w.lz.y;
    for (let i = 0; i < (LZ.hold + 1) * 20 && !w.extracted; i++) {
      w.invuln = 1;
      w.update(0.05);
      while (w.pendingLevels > 0) w.choose(w.drawChoices()[0]);
    }
    expect(w.extracted).toBe(true);
    expect(w.result().won).toBe(true);
  });
});

describe('mode zombie, carte : la partie', () => {
  it('le soldat et les zombies ne traversent pas les obstacles', () => {
    const m = new GameMap('ville', 9);
    const w = new World(LO, mulberry32(9), m);
    for (let i = 0; i < 30 * 90; i++) {
      w.mx = Math.cos(i / 200);
      w.my = Math.sin(i / 260);
      w.update(1 / 30);
      while (w.pendingLevels > 0) w.choose(w.drawChoices()[0]);
      if (w.dead) break;
      if (i % 30 === 0) {
        expect(m.blocked(w.px, w.py)).toBe(false);
        for (const z of w.zombies) if (z.active && z.type !== 'boss') expect(m.blocked(z.x, z.y)).toBe(false);
      }
    }
    expect(w.time).toBeGreaterThan(30);
  });

  it('pas de tir à travers un obstacle', () => {
    const m = new GameMap('ville', 5);
    const o = someRect(m);
    const w = new World({ ...LO, weapon: 'pistolet' }, mulberry32(3), m);
    w.px = (o.x0 + o.x1) / 2;
    w.py = o.y1 + 30;
    const z0 = w.zombies[0];
    for (let i = 0; i < 30 && !w.zombies.some((z) => z.active); i++) w.update(0.02);
    for (const z of w.zombies) z.active = false;
    z0.active = true;
    z0.hp = 1000;
    w.alive = 1;
    z0.x = w.px;
    z0.y = o.y0 - 60;
    expect(w.nearestVisible(w.px, w.py, 600)).toBeNull();
    z0.x = w.px + 10;
    z0.y = o.y1 + 200;
    expect(w.nearestVisible(w.px, w.py, 600)).toBe(z0);
    void CELL;
    void CHUNK;
  });

  it('une balle perforante traverse un obstacle (une perforation en moins), une balle simple s’y arrête', () => {
    const m = new GameMap('ville', 5);
    const o = someRect(m);
    const shoot = (pierce: number) => {
      const w = new World(LO, mulberry32(3), m);
      for (const z of w.zombies) z.active = false;
      w.alive = 0;
      const b = w.bullets[0];
      Object.assign(b, { active: true, x: (o.x0 + o.x1) / 2, y: o.y1 + 40 - 20, vx: 0, vy: -900, dmg: 10, dist: 600, pierce, bounces: 0, crit: false, last: -1, src: 0, wall: null });
      for (let i = 0; i < 20; i++) w.update(0.016);
      return b;
    };
    const plain = shoot(0);
    expect(plain.active).toBe(false);
    expect(plain.y).toBeGreaterThan(o.y0 - 20);
    const pierced = shoot(2);
    expect(pierced.y).toBeLessThan(o.y0 - 40);
    expect(pierced.pierce).toBe(1);
  });
});
