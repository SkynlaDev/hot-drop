// Simulation rapide du mode zombie, pour l'équilibrage : un bot qui fuit les zombies, ramasse l'XP, contourne
// les obstacles et, à 10:00, rejoint la zone d'extraction.
// npx vite-node tests/zombiesim.ts [parties] [arme] [niveau d'arme] [décor : ville|foret|port|aucun|tous]
import { ACCESSORIES, AccId, WEAPON_IDS, WeaponId } from '../src/zombie/data';
import { unlockedAccessories } from '../src/zombie/progress';
import { World } from '../src/zombie/world';
import type { Choice } from '../src/zombie/powerups';
import { mulberry32 } from '../src/logic/rng';
import { FlowField, GameMap, THEME_IDS, ThemeId } from '../src/zombie/map';
import { LZ } from '../src/zombie/extraction';
import { PLAYER } from '../src/zombie/data';

/** Champ de flux du bot vers la zone d'extraction (un par partie). */
const lzFlow = new WeakMap<World, FlowField>();

/** Déplacement du bot : fuit la foule (pondérée par la proximité), va vers l'XP proche si c'est calme. */
export function botMove(w: World): [number, number] {
  let fx = 0;
  let fy = 0;
  for (const z of w.zombies) {
    if (!z.active) continue;
    const dx = w.px - z.x;
    const dy = w.py - z.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 380 * 380) continue;
    const d = Math.sqrt(d2) || 1;
    const k = (z.type === 'boss' ? 6 : z.type === 'kamikaze' ? 2.5 : 1) / (d * d);
    fx += (dx / d) * k * 4000;
    fy += (dy / d) * k * 4000;
  }
  const danger = Math.hypot(fx, fy);
  // Va chercher l'XP proche (un joueur prend des risques pour ses plaques), moins quand ça chauffe.
  let best = null as null | { x: number; y: number };
  let bd = 360 * 360;
  for (const g of w.gems) {
    if (!g.active || g.pull) continue;
    const d = (g.x - w.px) ** 2 + (g.y - w.py) ** 2;
    if (d < bd) [bd, best] = [d, g];
  }
  for (const p of w.pickups) if (p.active) [bd, best] = [0, p];
  if (best) {
    const d = Math.sqrt((best.x - w.px) ** 2 + (best.y - w.py) ** 2) || 1;
    const k = Math.max(0.15, 1.2 - danger) * 1.2;
    fx += ((best.x - w.px) / d) * k;
    fy += ((best.y - w.py) / d) * k;
  }
  if (danger < 0.6) {
    // Tourne en rond doucement (comme un joueur qui « kite »).
    fx += Math.cos(w.time * 0.4) * 0.4;
    fy += Math.sin(w.time * 0.4) * 0.4;
  }
  // Extraction : la zone attire (chemin du champ de flux), plus fort que tout ; une fois dedans, on y reste.
  if (w.lz.active) {
    let gx = w.lz.x - w.px;
    let gy = w.lz.y - w.py;
    const gd = Math.hypot(gx, gy) || 1;
    if (w.map && gd > LZ.radius * 0.5) {
      let f = lzFlow.get(w);
      if (!f) {
        f = new FlowField(w.map);
        lzFlow.set(w, f);
      }
      f.update(w.lz.x, w.lz.y);
      if (f.steer(w.px, w.py) && !f.visible) {
        gx = f.tx - w.px;
        gy = f.ty - w.py;
      }
    }
    const gl = Math.hypot(gx, gy) || 1;
    const k = gd < LZ.radius * 0.6 ? 0.3 : 2.2;
    fx = fx * 0.6 + (gx / gl) * k;
    fy = fy * 0.6 + (gy / gl) * k;
  }
  const n = Math.hypot(fx, fy) || 1;
  fx /= n;
  fy /= n;
  // Obstacles : parmi 16 caps, celui qui suit le mieux l'envie du moment tout en gardant de l'espace devant soi
  // (un cap qui finit contre un mur 40 px plus loin vaut moins qu'une rue dégagée) : le bot ne se coince pas.
  if (w.map) {
    let best = -Infinity;
    let bx = fx;
    let by = fy;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const ax = Math.cos(a);
      const ay = Math.sin(a);
      let free = 0;
      while (free < 180 && !w.map.resolve(w.px + ax * (free + 20), w.py + ay * (free + 20), PLAYER.r + 2)) free += 20;
      if (free === 0) continue;
      const sc = ax * fx + ay * fy + (free / 180) * 0.7;
      if (sc > best) [best, bx, by] = [sc, ax, ay];
    }
    return [bx, by];
  }
  return [fx, fy];
}

/** Choix du bot : évolution, sinon selon une préférence fixe (dégâts et soutiens d'abord). */
const PREF = ['degats', 'cadence', 'multitir', 'grenades', 'lames', 'drone', 'pv', 'explosif', 'perforation', 'armure', 'regen', 'tourelle', 'artillerie', 'mines', 'critique', 'ricochet', 'incendiaire', 'aimant', 'vitesse', 'electrique', 'recharge'];
export function botPick(cs: Choice[]): Choice {
  const evo = cs.find((c) => c.kind === 'evo');
  if (evo) return evo;
  const rank = (c: Choice) => (c.kind === 'power' ? PREF.indexOf(c.id) : 99);
  return [...cs].sort((a, b) => rank(a) - rank(b))[0];
}

export function simulate(weapon: WeaponId, weaponLevel: number, seed: number, maxTime = 600, theme: ThemeId | null = THEME_IDS[seed % 3]) {
  // Accessoires débloqués à ce niveau : le premier de chaque emplacement.
  const acc: AccId[] = [];
  for (const a of unlockedAccessories(weapon, weaponLevel)) if (!acc.some((b) => ACCESSORIES[b].slot === ACCESSORIES[a].slot)) acc.push(a);
  const w = new World({ weapon, weaponLevel, accessories: acc, perk: 'eclaireur' }, mulberry32(seed), theme ? new GameMap(theme, seed) : null);
  const dt = 1 / 30;
  while (!w.dead && !w.extracted && w.time < maxTime) {
    [w.mx, w.my] = botMove(w);
    w.update(dt);
    while (w.pendingLevels > 0) w.choose(botPick(w.drawChoices()));
  }
  return w;
}

const argv = (globalThis as unknown as { process?: { argv: string[] } }).process?.argv ?? [];
if (argv[1]?.includes('vite-node')) {
  const runs = Number(argv[2] ?? 4);
  const only = argv[3] as WeaponId | undefined;
  const wl = Number(argv[4] ?? 1);
  const th = argv[5] ?? 'tous';
  const themeOf = (i: number): ThemeId | null => (th === 'aucun' ? null : th === 'tous' ? THEME_IDS[i % 3] : (th as ThemeId));
  for (const weapon of only && only !== ('tous' as string) ? [only] : WEAPON_IDS) {
    const rows: string[] = [];
    let wins = 0;
    let ten = 0;
    const t0 = performance.now();
    for (let i = 0; i < runs; i++) {
      // Jusqu'à 13:00 : 10 minutes, puis le temps de rejoindre l'hélico.
      const w = simulate(weapon, wl, 1000 + i, 780, themeOf(i));
      if (w.extracted) wins++;
      if (w.time >= 600) ten++;
      rows.push(`${Math.floor(w.time / 60)}:${String(Math.floor(w.time % 60)).padStart(2, '0')}${w.extracted ? ' X' : ''} n${w.level} k${w.killCount}${w.boss ? ' B' : ''}`);
    }
    console.log(`${weapon.padEnd(16)} 10 min ${ten}/${runs}, extractions ${wins}/${runs}  (${Math.round(performance.now() - t0)} ms)  ${rows.join(' | ')}`);
  }
}
