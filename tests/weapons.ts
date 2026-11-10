// Outil d'équilibrage : npx vite-node tests/weapons.ts
// Chaque arme seule (+ casque et IFAK) contre chaque menace au tour 4.
import { buildEncounter } from '../src/data/enemies';
import { ITEMS, ITEM_IDS } from '../src/data/items';
import { THREATS, Threat } from '../src/data/threats';
import { simulate } from '../src/logic/combat';
import { ItemInst } from '../src/logic/grid';
import { rngFor } from '../src/logic/rng';
import { computeLoadout, estimateDps } from '../src/logic/stats';

const it = (uid: number, defId: string, x: number, y: number): ItemInst => ({ uid, defId, rarity: 1, rot: 0, x, y, placed: true });
const N = 120;
console.log('arme'.padEnd(26), 'cases DPS ', THREATS.map((t) => t.padEnd(9)).join(''));
for (const id of ITEM_IDS.filter((i) => ITEMS[i].weapon)) {
  const items = [it(1, id, 1, 1), it(2, 'casque', 1, 4), it(3, 'ifak', 4, 4)];
  const { loadout } = computeLoadout(items);
  const cells = ITEMS[id].shape.join('').split('').filter((c) => c === 'X').length;
  const row = THREATS.map((t: Threat) => {
    let w = 0;
    for (let s = 0; s < N; s++) if (simulate(loadout, buildEncounter('contrat', 3, rngFor(s, 'w'), [t]), s, [t]).win) w++;
    return `${Math.round((w / N) * 100)}%`.padEnd(9);
  });
  console.log(ITEMS[id].name.padEnd(26), String(cells).padEnd(5), String(Math.round(estimateDps(loadout))).padEnd(5), row.join(''));
}
