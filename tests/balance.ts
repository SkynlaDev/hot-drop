// Outil d'équilibrage : npx vite-node tests/balance.ts
// Sacs de départ des opérateurs contre les bots générés, et bots entre eux par qualité.
import { OPERATORS, OPERATOR_IDS, OperatorId } from '../src/data/operators';
import { BotBuild, generateBot, botLoadout } from '../src/logic/bots';
import { simulateDuel } from '../src/logic/combat';
import { ItemInst } from '../src/logic/grid';
import { computeLoadout, maxHpFor } from '../src/logic/stats';

const N = 400;
const pctS = (w: number, n: number) => `${Math.round((w / n) * 100)}%`.padEnd(8);

const startItems = (op: OperatorId): ItemInst[] =>
  OPERATORS[op].start.map(([defId, x, y], i) => ({ uid: 100 + i, defId, rot: 0, x, y, placed: true }));

// Bots générés une fois par (tour, danger), rangés par qualité.
const cache = new Map<string, Record<string, BotBuild[]>>();
function bucket(round: number, danger: number): Record<string, BotBuild[]> {
  const key = `${round}|${danger}`;
  let c = cache.get(key);
  if (!c) {
    c = { faible: [], normal: [], fort: [], any: [] };
    // Plafond de recherche : certaines qualités n'existent pas à certains tours (pas de bot fort au 1er cercle).
    for (let s = 0; (c.faible.length < N || c.normal.length < N || c.fort.length < N) && s < 20 * N; s++) {
      const b = generateBot(s, round, { danger });
      if (c[b.quality].length < N) c[b.quality].push(b);
      if (c.any.length < N) c.any.push(b);
    }
    cache.set(key, c);
  }
  return c;
}
function botOf(quality: BotBuild['quality'] | 'any', s: number, round: number, danger = 0): BotBuild {
  const b = bucket(round, danger);
  const list = b[quality].length ? b[quality] : b.any;
  return list[s % list.length];
}

console.log('Sac de départ vs bots (taux de victoire du joueur)');
console.log('op/tour'.padEnd(16), ['faible', 'normal', 'fort', 'tous'].map((q) => q.padEnd(8)).join(''));
for (const op of OPERATOR_IDS) {
  for (let round = 0; round <= 4; round++) {
    const me = computeLoadout(startItems(op), op, maxHpFor(round)).loadout;
    const row = (['faible', 'normal', 'fort', 'any'] as const).map((q) => {
      let w = 0;
      for (let s = 0; s < N; s++) if (simulateDuel(me, botLoadout(botOf(q, s, round)), s * 7 + 1).win) w++;
      return pctS(w, N);
    });
    console.log(`${op} t${round}`.padEnd(16), row.join(''));
  }
}

console.log('\nBot vs bot (taux de victoire de la ligne contre la colonne), même tour');
for (let round = 0; round <= 4; round += 2) {
  console.log(`tour ${round}`.padEnd(16), ['faible', 'normal', 'fort'].map((q) => q.padEnd(8)).join(''));
  for (const qa of ['faible', 'normal', 'fort'] as const) {
    const row = (['faible', 'normal', 'fort'] as const).map((qb) => {
      let w = 0;
      for (let s = 0; s < N; s++) if (simulateDuel(botLoadout(botOf(qa, s, round)), botLoadout(botOf(qb, s + 1, round)), s).win) w++;
      return pctS(w, N);
    });
    console.log(`  ${qa}`.padEnd(16), row.join(''));
  }
}

console.log('\nTop 1 vs bots forts du tour 4 / vs bots normaux du tour 4');
{
  let w1 = 0;
  let w2 = 0;
  for (let s = 0; s < N; s++) {
    const fin = botLoadout(generateBot(s, 5, { final: true }));
    if (simulateDuel(fin, botLoadout(botOf('fort', s, 4)), s).win) w1++;
    if (simulateDuel(fin, botLoadout(botOf('normal', s, 4)), s).win) w2++;
  }
  console.log('final'.padEnd(16), pctS(w1, N), pctS(w2, N));
}

console.log('\nViper vs Sentinelle : bots de même tour, même répartition de qualité (taux de victoire de Viper, chaque paire joue les deux côtés)');
{
  const row: string[] = [];
  for (const round of [0, 1, 2, 3, 4, 5]) {
    const v: BotBuild[] = [];
    const st: BotBuild[] = [];
    for (let k = 0; v.length < N || st.length < N; k++) {
      const b = round === 5 ? generateBot(k, 5, { final: true }) : generateBot(k, round);
      (b.operator === 'viper' ? v : st).push(b);
    }
    let w = 0;
    for (let s = 0; s < N; s++) {
      const a = botLoadout(v[s]);
      const b = botLoadout(st[s]);
      if (simulateDuel(a, b, s * 2).win) w++;
      if (!simulateDuel(b, a, s * 2 + 1).win) w++;
    }
    row.push(`${round === 5 ? 'Top 1' : `t${round}`} ${pctS(w, 2 * N)}`);
  }
  console.log(row.join(''));
  const startV = computeLoadout(startItems('viper'), 'viper', maxHpFor(0)).loadout;
  const startS = computeLoadout(startItems('sentinelle'), 'sentinelle', maxHpFor(0)).loadout;
  let w = 0;
  for (let s = 0; s < N; s++) if (simulateDuel(startV, startS, s).win) w++;
  console.log('sacs de départ, Viper vs Sentinelle'.padEnd(40), pctS(w, N));
}

console.log('\nDanger de zone (tour 2, bots tous) : sac de départ vs danger 0 / 0,5 / 1');
for (const op of OPERATOR_IDS) {
  const me = computeLoadout(startItems(op), op, maxHpFor(2)).loadout;
  const row = [0, 0.5, 1].map((danger) => {
    let w = 0;
    for (let s = 0; s < N; s++) if (simulateDuel(me, botLoadout(botOf('any', s, 2, danger)), s).win) w++;
    return pctS(w, N);
  });
  console.log(op.padEnd(16), row.join(''));
}

console.log('\nRampe : bot normal de la manche r-1 (PV de la manche r) vs bots normaux de la manche r');
{
  const row: string[] = [];
  for (let round = 1; round <= 4; round++) {
    let w = 0;
    for (let s = 0; s < N; s++) {
      const prev = botOf('normal', s, round - 1);
      const me = computeLoadout(prev.items, prev.operator, maxHpFor(round)).loadout;
      if (simulateDuel(me, botLoadout(botOf('normal', s + 7, round)), s).win) w++;
    }
    row.push(`t${round} ${pctS(w, N)}`);
  }
  console.log(row.join(''));
}
