// Simulation rapide du mode zombie, pour l'équilibrage : un bot qui fuit les zombies et ramasse l'XP.
// npx vite-node tests/zombiesim.ts [parties] [arme] [niveau d'arme]
import { WEAPON_IDS, WeaponId } from '../src/zombie/data';
import { World } from '../src/zombie/world';
import { mulberry32 } from '../src/logic/rng';

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
  if (danger < 0.6) {
    let best = null as null | { x: number; y: number };
    let bd = 300 * 300;
    for (const g of w.gems) {
      if (!g.active) continue;
      const d = (g.x - w.px) ** 2 + (g.y - w.py) ** 2;
      if (d < bd) [bd, best] = [d, g];
    }
    if (best) {
      fx += (best.x - w.px) * 0.01;
      fy += (best.y - w.py) * 0.01;
    }
    // Tourne en rond doucement (comme un joueur qui « kite »).
    fx += Math.cos(w.time * 0.4) * 0.5;
    fy += Math.sin(w.time * 0.4) * 0.5;
  }
  const n = Math.hypot(fx, fy) || 1;
  return [fx / n, fy / n];
}

export function simulate(weapon: WeaponId, weaponLevel: number, seed: number, maxTime = 600) {
  const w = new World({ weapon, weaponLevel, accessories: [], perk: 'eclaireur' }, mulberry32(seed));
  const dt = 1 / 30;
  while (!w.dead && w.time < maxTime) {
    [w.mx, w.my] = botMove(w);
    w.update(dt);
    while (w.pendingLevels > 0) {
      const c = w.drawChoices();
      w.choose(c[0]);
    }
  }
  return w;
}

const argv = (globalThis as unknown as { process?: { argv: string[] } }).process?.argv ?? [];
if (argv[1]?.includes('vite-node')) {
  const runs = Number(argv[2] ?? 4);
  const only = argv[3] as WeaponId | undefined;
  const wl = Number(argv[4] ?? 1);
  for (const weapon of only ? [only] : WEAPON_IDS) {
    const rows: string[] = [];
    let wins = 0;
    const t0 = performance.now();
    for (let i = 0; i < runs; i++) {
      const w = simulate(weapon, wl, 1000 + i);
      if (!w.dead) wins++;
      rows.push(`${Math.floor(w.time / 60)}:${String(Math.floor(w.time % 60)).padStart(2, '0')} niv${w.level} kills${w.killCount}`);
    }
    console.log(`${weapon.padEnd(16)} victoires ${wins}/${runs}  (${Math.round(performance.now() - t0)} ms)  ${rows.join(' | ')}`);
  }
}
