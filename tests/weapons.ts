// Outil d'équilibrage : npx vite-node tests/weapons.ts
// Chaque arme seule (+ casque et IFAK, rareté Peu commun) en duel contre des bots normaux du tour 2.
import { ITEMS, ITEM_IDS } from '../src/data/items';
import { generateBot, botLoadout } from '../src/logic/bots';
import { simulateDuel } from '../src/logic/combat';
import { ItemInst } from '../src/logic/grid';
import { computeLoadout, estimateDps, maxHpFor } from '../src/logic/stats';

const it = (uid: number, defId: string, x: number, y: number): ItemInst => ({ uid, defId, rarity: 1, rot: 0, x, y, placed: true });
const N = 200;
console.log('arme'.padEnd(28), 'cases DPS  victoire');
for (const id of ITEM_IDS.filter((i) => ITEMS[i].weapon)) {
  const items = [it(1, id, 1, 1), it(2, 'casque', 1, 4), it(3, 'ifak', 4, 4)];
  const op = ITEMS[id].family === 'precision' ? 'sentinelle' : 'viper';
  const { loadout } = computeLoadout(items, op, maxHpFor(2));
  const cells = ITEMS[id].shape.join('').split('').filter((c) => c === 'X').length;
  let w = 0;
  for (let s = 0; s < N; s++) if (simulateDuel(loadout, botLoadout(generateBot(s, 2, { goulag: true })), s).win) w++;
  console.log(ITEMS[id].name.padEnd(28), String(cells).padEnd(5), String(Math.round(estimateDps(loadout))).padEnd(5), `${Math.round((w / N) * 100)}%`);
}
