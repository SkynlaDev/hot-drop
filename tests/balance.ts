// Outil d'équilibrage : npx vite-node tests/balance.ts
// Taux de victoire de gilets types contre les rencontres de chaque étage.
import { buildEncounter } from '../src/data/enemies';
import { simulate } from '../src/logic/combat';
import { ItemInst } from '../src/logic/grid';
import { rngFor } from '../src/logic/rng';
import { computeLoadout } from '../src/logic/stats';
import { THREATS, Threat, BOSS_THREATS } from '../src/data/threats';

const it = (uid: number, defId: string, x: number, y: number, rarity = 0, rot: 0 | 1 | 2 | 3 = 0): ItemInst => ({ uid, defId, rarity, rot, x, y, placed: true });

const builds: Record<string, ItemInst[]> = {
  depart: [it(3, 'casque', 1, 0), it(1, 'pistolet', 1, 2), it(2, 'chg_9mm', 3, 2)],
  'depart+smg': [it(3, 'casque', 1, 0), it(1, 'pistolet', 1, 2), it(2, 'chg_9mm', 3, 2), it(4, 'smg', 3, 2), it(5, 'frag', 0, 5)],
  milieu: [it(1, 'fusil_assaut', 0, 3), it(2, 'chg_556', 4, 3), it(3, 'plaque', 1, 0, 1), it(4, 'pistolet', 3, 0), it(5, 'chg_9mm', 3, 1), it(6, 'frag', 0, 5), it(7, 'ifak', 1, 5)],
  fort: [it(1, 'fusil_assaut', 0, 3, 2), it(2, 'chg_556', 4, 3, 1), it(3, 'lunette', 0, 2, 1), it(4, 'plaque', 1, 0, 2), it(5, 'smg', 3, 0, 1), it(6, 'chg_9mm', 3, 2), it(7, 'frag', 0, 5, 1), it(8, 'ifak', 1, 5), it(9, 'fumigene', 4, 5)],
};

const builds2: Record<string, ItemInst[]> = {
  ...builds,
  rafale: [it(1, 'smg', 0, 0, 1), it(2, 'chg_9mm', 3, 0), it(3, 'fusil_assaut', 0, 3, 1), it(4, 'chg_556', 4, 3), it(5, 'casque', 1, 4), it(6, 'ifak', 2, 1)],
  precision: [it(1, 'precision', 0, 3, 2), it(2, 'chg_762', 0, 2), it(3, 'lunette', 1, 2, 1), it(4, 'silencieux', 3, 2, 2), it(5, 'plaque', 1, 0, 1), it(6, 'pistolet', 3, 0)],
  'rafale+perf': [it(1, 'smg', 0, 0, 1), it(2, 'chg_9mm', 3, 0), it(3, 'fusil_assaut', 0, 3, 1), it(4, 'perforantes', 4, 3, 2), it(5, 'casque', 1, 4), it(6, 'ifak', 2, 1)],
  demolition: [it(1, 'pompe', 0, 3, 1), it(2, 'frag', 0, 5, 1), it(3, 'frag', 1, 5), it(4, 'flash', 2, 5), it(5, 'plaque', 1, 0, 1), it(6, 'pistolet', 3, 0), it(7, 'chg_9mm', 4, 1)],
};

const N = 150;
const cases: [string, 'contrat' | 'elite' | 'boss', number, Threat[]][] = [
  ...THREATS.map((t) => [`c5 ${t}`, 'contrat', 5, [t]] as [string, 'contrat', number, Threat[]]),
  ['boss', 'boss', 7, BOSS_THREATS],
];
console.log('build'.padEnd(12), cases.map((c) => c[0].padEnd(12)).join(''));
for (const [name, items] of Object.entries(builds2)) {
  const { loadout } = computeLoadout(items);
  const row: string[] = [];
  for (const [, kind, floor, threats] of cases) {
    let wins = 0;
    for (let s = 0; s < N; s++) {
      const r = simulate(loadout, buildEncounter(kind, floor, rngFor(s, floor, 'enc'), threats), s * 7 + 1, threats);
      if (r.win) wins++;
    }
    row.push(`${Math.round((wins / N) * 100)}%`.padEnd(12));
  }
  console.log(name.padEnd(12), row.join(''));
}
