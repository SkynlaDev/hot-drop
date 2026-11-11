// Outil d'équilibrage : npx vite-node tests/durations.ts
// Durée des duels (bots de même tour) et Viper contre Sentinelle.
import { generateBot, botLoadout, BotBuild } from '../src/logic/bots';
import { simulateDuel, MAX_TIME } from '../src/logic/combat';

const N = 300;
const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))];
console.log('tour  médiane  p10   p90   temps-limite  Viper-vs-Sentinelle');
for (const round of [0, 1, 2, 3, 4, 5]) {
  const v: BotBuild[] = [];
  const s: BotBuild[] = [];
  for (let k = 0; v.length < N || s.length < N; k++) {
    const b = round === 5 ? generateBot(k, 5, { final: true }) : generateBot(k, round);
    (b.operator === 'viper' ? v : s).push(b);
  }
  const d: number[] = [];
  let to = 0;
  let w = 0;
  for (let i = 0; i < N; i++) {
    const a = botLoadout(v[i]);
    const b = botLoadout(s[i]);
    for (const [x, y, seed, viperIsA] of [[a, b, i * 2, true], [b, a, i * 2 + 1, false]] as const) {
      const r = simulateDuel(x, y, seed);
      d.push(r.duration);
      if (r.timeout) to++;
      if (r.win === viperIsA) w++;
    }
  }
  const n = 2 * N;
  const f = (x: number) => x.toFixed(1).padStart(5);
  console.log(`t${round}   ${f(q(d, 0.5))}  ${f(q(d, 0.1))} ${f(q(d, 0.9))}   ${String(Math.round((to / n) * 100)).padStart(3)} %        ${Math.round((w / n) * 100)} %`);
}
console.log(`(temps limite : ${MAX_TIME} s)`);
