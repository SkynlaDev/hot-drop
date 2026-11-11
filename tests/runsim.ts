// Outil d'équilibrage : npx vite-node tests/runsim.ts [runs par politique] [prudent|agressif] [--random-loot]
// Un joueur simulé joue des runs complètes avec la vraie logique (newRun, dropInZone, playCard, resolveDuel,
// Goulag, endAction, Top 1). Il range son sac à chaque action (sacoches comprises), fusionne, assemble,
// achète en boutique ce qui améliore son sac. Deux politiques : « prudent » et « agressif ».
import { ITEMS } from '../src/data/items';
import { BAGS, BagId } from '../src/data/bags';
import { OPERATOR_IDS, OperatorId } from '../src/data/operators';
import { BotBuild, accessoryFits, botLoadout, generateBot, placeBot } from '../src/logic/bots';
import { simulateDuel } from '../src/logic/combat';
import { BagInst, ItemInst, Rot, canPlaceBag, cellKey, cellsOf, usableCells } from '../src/logic/grid';
import { autoCraft } from '../src/logic/recipes';
import {
  DuelParams, RESERVE_MAX, REROLL_COST, RunState, buyOffer, dropInZone, endAction, finalDuelParams,
  goulagParams, newRun, playCard, reserve, rerollShop, resolveDuel, resolveGoulag, selectableZones, sellItem, shopOffers, finishLoot, lootItem, swapLoot,
} from '../src/logic/run';
import { Rng, mulberry32, hashParts } from '../src/logic/rng';
import { PlayerLoadout, computeLoadout, itemPrice } from '../src/logic/stats';
import { Card, ROUNDS } from '../src/logic/zone';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: { argv: string[] };

export type Policy = 'prudent' | 'agressif';

// ---------------------------------------------------------------- rangement

const isWeapon = (id: string) => !!ITEMS[id].weapon;
const isSyn = (id: string) => !!ITEMS[id].synergy;
const value = (it: { defId: string }) => itemPrice(it.defId);

/** Bots de référence (tour, danger 0) contre lesquels le joueur jauge ses rangements. */
const refCache = new Map<number, PlayerLoadout[]>();
function refBots(round: number): PlayerLoadout[] {
  let r = refCache.get(round);
  if (!r) {
    r = [];
    for (let s = 0; s < 14; s++) r.push(botLoadout(generateBot(90000 + s, round, { goulag: true })));
    refCache.set(round, r);
  }
  return r;
}

/** Force d'un sac : victoires contre les bots de référence de la manche. */
function fitness(items: ItemInst[], op: OperatorId, round: number): number {
  const me = computeLoadout(items, op, 100 + 20 * Math.min(round, ROUNDS));
  if (!me.loadout.weapons.length) return -1;
  let w = 0;
  refBots(Math.min(round, ROUNDS - 1)).forEach((b, i) => {
    if (simulateDuel(me.loadout, b, 7000 + i).win) w++;
    if (simulateDuel(me.loadout, b, 8000 + i).win) w++;
  });
  return w;
}

/** Pose toutes les sacoches (les plus grandes d'abord) là où elles touchent le plus de cases utilisables. */
function placeBags(run: RunState, rng: Rng) {
  for (const b of run.bags) b.placed = false;
  const order = [...run.bags].sort((a, b) => cellsOf(b).length - cellsOf(a).length);
  for (const b of order) {
    let best: { x: number; y: number; rot: Rot; score: number } | null = null;
    const use = usableCells(run.bags);
    for (const rot of [0, 1, 2, 3] as Rot[]) {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 9; x++) {
          if (!canPlaceBag(run.bags, [], b, x, y, rot)) continue;
          const cells = cellsOf({ defId: b.defId, rot, x, y });
          let touch = 0;
          for (const [cx, cy] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (use.has(cellKey(cx + dx, cy + dy))) touch++;
          const score = touch + rng() * 0.1;
          if (!best || score > best.score) best = { x, y, rot, score };
        }
      }
    }
    if (best) Object.assign(b, { x: best.x, y: best.y, rot: best.rot, placed: true });
  }
}

/** Liste d'objets à ranger pour un choix d'armes donné : armes, puis ce qui leur sert, puis le reste par valeur. */
function selection(all: ItemInst[], weapons: ItemInst[]): ItemInst[] {
  const wd = weapons.map((w) => ITEMS[w.defId]);
  const useful = all.filter((it) => {
    if (isWeapon(it.defId)) return weapons.includes(it);
    if (isSyn(it.defId)) return wd.some((w) => accessoryFits(ITEMS[it.defId], w));
    return true;
  });
  return useful.filter((it) => !isWeapon(it.defId)).sort((a, b) => value(b) - value(a));
}

/** Range le sac : sacoches, choix des objets (plusieurs essais jaugés au combat), recettes, revente du surplus. */
export function repack(run: RunState, rng: Rng) {
  for (const it of run.items) it.placed = false;
  placeBags(run, rng);
  const use = usableCells(run.bags);
  const all = [...run.items];
  const weapons = all.filter((i) => isWeapon(i.defId)).sort((a, b) => value(b) - value(a));
  const tries: ItemInst[][] = [];
  for (const nW of [1, 2, 3]) if (weapons.length >= nW) tries.push(weapons.slice(0, nW));
  if (weapons.length >= 2) tries.push([weapons[1]]);
  let best: { layout: ItemInst[]; score: number } | null = null;
  for (const ws of tries) {
    const list = [...ws, ...selection(all, ws)];
    for (let k = 0; k < 2; k++) {
      const placed = placeBot(list.map((i) => i.defId), use, rng, 0);
      // Retrouve les objets de la run correspondants.
      const free = [...all];
      const layout: ItemInst[] = placed.map((p) => {
        const src = free.splice(free.findIndex((f) => f.defId === p.defId), 1)[0];
        return { ...src, x: p.x, y: p.y, rot: p.rot, placed: true };
      });
      const score = fitness(layout, run.operator, run.round) + layout.length * 0.01;
      if (!best || score > best.score) best = { layout, score };
    }
  }
  if (best) {
    for (const l of best.layout) Object.assign(run.items.find((i) => i.uid === l.uid)!, { x: l.x, y: l.y, rot: l.rot, placed: true });
  }
  if (autoCraft(run).length) return repack(run, rng);
  // Réserve : revend les objets les moins chers au-delà de la limite.
  const res = reserve(run).sort((a, b) => value(a) - value(b));
  while (res.length > RESERVE_MAX) sellItem(run, res.shift()!.uid);
}

// ---------------------------------------------------------------- boutique

function shop(run: RunState, rng: Rng) {
  let rerolls = 0;
  for (let guard = 0; guard < 12; guard++) {
    const offers = shopOffers(run);
    const base = fitness(run.items.filter((i) => i.placed), run.operator, run.round);
    let bestI = -1;
    let bestGain = 0;
    offers.forEach((o, i) => {
      if (o.sold || o.price > run.credits) return;
      if (o.bag) {
        const gain = 2 + BAGS[o.bag as BagId].shape.join('').length / 2;
        if (run.bags.length < 6 && gain > bestGain) {
          bestGain = gain;
          bestI = i;
        }
        return;
      }
      // Essai : le sac avec cet objet en plus.
      const trial: RunState = JSON.parse(JSON.stringify(run));
      trial.items.push({ ...o.item!, uid: 99999, placed: false });
      repack(trial, rng);
      const gain = fitness(trial.items.filter((i) => i.placed), run.operator, run.round) - base;
      if (gain > bestGain) {
        bestGain = gain;
        bestI = i;
      }
    });
    if (bestI >= 0 && bestGain >= 1) {
      if (!buyOffer(run, bestI)) break;
      repack(run, rng);
      continue;
    }
    if (rerolls < 2 && run.credits >= REROLL_COST + 8) {
      rerolls++;
      rerollShop(run);
      continue;
    }
    break;
  }
}

// ---------------------------------------------------------------- butin

/** `--random-loot` : le joueur prend des objets au hasard dans le sac du bot (comparaison avec le choix). */
let randomLoot = false;

/**
 * Fouille du sac du bot : prend les objets du plus cher au moins cher (au tiers pour un chargeur ou un
 * accessoire qui ne va sur aucune arme du joueur) ; tout plein : échange contre l'objet le moins cher
 * s'il vaut nettement moins. Avec --random-loot, ordre au hasard et pas d'échange.
 */
function lootAll(run: RunState, choices: ItemInst[], rng: Rng): void {
  const weapons = () => run.items.filter((i) => isWeapon(i.defId)).map((i) => ITEMS[i.defId]);
  const score = (it: ItemInst) => value(it) * (isSyn(it.defId) && !weapons().some((w) => accessoryFits(ITEMS[it.defId], w)) ? 0.33 : 1);
  const order = randomLoot ? [...choices].sort(() => rng() - 0.5) : [...choices].sort((a, b) => score(b) - score(a));
  for (const it of order) {
    const r = lootItem(run, it.uid);
    if (!r || r.to !== 'plein' || randomLoot) continue;
    const cheapest = [...run.items].sort((a, b) => score(a) - score(b))[0];
    if (cheapest && score(cheapest) * 1.5 < score(it)) swapLoot(run, it.uid, cheapest.uid);
  }
  finishLoot(run);
}

// ---------------------------------------------------------------- politique

function chooseZone(run: RunState, policy: Policy, rng: Rng): number {
  const zones = selectableZones(run);
  const pref = policy === 'prudent' ? ['petite', 'moyenne', 'grande'] : ['grande', 'moyenne', 'petite'];
  for (const s of pref) {
    const z = zones.filter((v) => v.size === s);
    if (z.length) return z[Math.floor(rng() * z.length)].id;
  }
  return zones[0].id;
}

/**
 * Priorité d'une carte. Prudent : caisses et boutique d'abord, un duel solo quand il le faut.
 * Agressif : la caisse épique, puis une squad par zone (le gros butin) tant qu'il a son Goulag,
 * puis boutique / caisse / solo.
 */
function cardScore(card: Card, run: RunState, policy: Policy): number {
  const t = card.type as string;
  if (t === 'caisse_epique') return 100;
  if (policy === 'prudent') {
    if (t === 'caisse_renforcee') return 60;
    if (t === 'caisse') return 50;
    if (t === 'solo') return 40;
    if (t === 'shop') return run.credits >= 8 ? 45 : 5;
    if (t === 'duo') return 15;
    return 10; // escouade
  }
  // Une squad par zone tant que le Goulag est disponible ; ensuite il joue plus serré (mais reste au chaud).
  const squads = run.played.filter((i) => run.cards[i].type === 'squad').length;
  if (t === 'squad') return squads === 0 && !run.goulagUsed ? 60 : 8;
  if (t === 'duo') return squads === 0 && !run.goulagUsed ? 55 : 20;
  if (t === 'shop') return run.credits >= 10 ? 50 : 5;
  if (t === 'caisse_renforcee') return 58;
  if (t === 'caisse') return 45;
  return 40; // solo
}

// ---------------------------------------------------------------- run

export interface RunStats {
  /** Duels de cartes [gagnés, joués] par manche. */
  duels: [number, number][];
  /** Dernière manche commencée (5 = Top 1 atteint). */
  reached: number;
  goulag: 'none' | 'win' | 'lose';
  top1: boolean;
  /** Objets posés et part d'objets assemblés au début de chaque manche. */
  items: number[];
  crafted: number[];
  epic: number;
}

function duel(run: RunState, p: DuelParams): { win: boolean; hpEnd: number; bot: BotBuild } {
  const bot = generateBot(p.seed, p.round, { danger: p.danger, final: p.type === 'final', goulag: p.type === 'goulag' });
  const me = computeLoadout(run.items, run.operator, p.maxHp).loadout;
  const r = simulateDuel(me, botLoadout(bot), p.seed, { hpA: p.hp });
  return { win: r.win, hpEnd: r.hpEndA, bot };
}

export function simulateRun(seed: number, policy: Policy, op: OperatorId): RunStats {
  const rng = mulberry32(hashParts('sim', seed, policy));
  const run = newRun(op, seed);
  const st: RunStats = { duels: Array.from({ length: ROUNDS }, () => [0, 0]), reached: 0, goulag: 'none', top1: false, items: [], crafted: [], epic: 0 };
  repack(run, rng);
  while (!run.over) {
    if (run.round >= ROUNDS) {
      st.reached = ROUNDS;
      const p = finalDuelParams(run)!;
      const r = duel(run, p);
      resolveDuel(run, { win: r.win, hpEnd: r.hpEnd, botItems: r.bot.items });
      st.top1 = r.win;
      break;
    }
    st.reached = run.round;
    const placed = run.items.filter((i) => i.placed);
    st.items[run.round] = placed.length;
    st.crafted[run.round] = placed.filter((i) => ITEMS[i.defId].crafted).length / Math.max(1, placed.length);
    dropInZone(run, chooseZone(run, policy, rng));
    while (run.zoneId !== null && !run.over) {
      const idx = run.cards.map((_, i) => i).filter((i) => !run.played.includes(i));
      idx.sort((a, b) => cardScore(run.cards[b], run, policy) - cardScore(run.cards[a], run, policy));
      const i = idx[0];
      const res = playCard(run, i)!;
      if (res.kind === 'shop') shop(run, rng);
      else if (res.kind === 'caisse') {
        if (res.crate === 'caisse_epique') st.epic++;
        lootAll(run, [...run.pendingLoot!.items], rng);
        repack(run, rng);
      } else {
        let p: DuelParams | undefined = res;
        while (p) {
          const r = duel(run, p);
          st.duels[run.round][1]++;
          if (r.win) st.duels[run.round][0]++;
          const out = resolveDuel(run, { win: r.win, hpEnd: r.hpEnd, botItems: r.bot.items, botUsable: r.bot.usable });
          if (run.pendingLoot) lootAll(run, out.lootChoices!, rng);
          repack(run, rng);
          p = out.next;
          if (out.goulag) {
            const g = goulagParams(run)!;
            const gr = duel(run, g);
            resolveGoulag(run, gr.win);
            st.goulag = gr.win ? 'win' : 'lose';
          }
        }
      }
      if (run.over) break;
      repack(run, rng);
      endAction(run);
    }
  }
  return st;
}

// ---------------------------------------------------------------- rapport

const opOf = (s: number) => OPERATOR_IDS[s % OPERATOR_IDS.length];

function report(policy: Policy, n: number, all: RunStats[]) {
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  console.log(`\n=== ${policy} (${n} runs) ===`);
  console.log('cercle'.padEnd(10), 'atteint'.padEnd(10), 'duels gagnés'.padEnd(16), 'duels/run'.padEnd(11), 'objets'.padEnd(8), 'assemblés');
  for (let r = 0; r < ROUNDS; r++) {
    const reached = all.filter((s) => s.reached >= r);
    const w = all.reduce((t, s) => t + s.duels[r][0], 0);
    const p = all.reduce((t, s) => t + s.duels[r][1], 0);
    const it = reached.reduce((t, s) => t + (s.items[r] ?? 0), 0) / Math.max(1, reached.length);
    const ra = reached.reduce((t, s) => t + (s.crafted[r] ?? 0), 0) / Math.max(1, reached.length);
    console.log(`C${r + 1}`.padEnd(10), pct(reached.length / n).padEnd(10), `${pct(w / Math.max(1, p))} (${p})`.padEnd(16), (p / Math.max(1, reached.length)).toFixed(1).padEnd(11), it.toFixed(1).padEnd(8), pct(ra));
  }
  const top = all.filter((s) => s.reached >= ROUNDS);
  console.log('Top 1 atteint', pct(top.length / n), '· gagné', pct(all.filter((s) => s.top1).length / n), `(${pct(top.filter((s) => s.top1).length / Math.max(1, top.length))} des duels finaux)`);
  const gu = all.filter((s) => s.goulag !== 'none');
  console.log('Goulag utilisé', pct(gu.length / n), '· gagné', pct(gu.filter((s) => s.goulag === 'win').length / Math.max(1, gu.length)), '· caisses épiques/run', (all.reduce((t, s) => t + s.epic, 0) / n).toFixed(2));
  for (const op of OPERATOR_IDS) {
    const o = all.filter((_, i) => opOf(i) === op);
    console.log(`  ${op}`.padEnd(14), 'Top 1 gagné', pct(o.filter((s) => s.top1).length / Math.max(1, o.length)));
  }
}

/** Runs [from, to) d'une politique (graines 1000 + i, opérateurs en alternance). */
function runRange(policy: Policy, from: number, to: number): RunStats[] {
  const out: RunStats[] = [];
  for (let s = from; s < to; s++) out.push(simulateRun(1000 + s, policy, opOf(s)));
  return out;
}

const args = process.argv.slice(2).filter((a) => a !== '--random-loot');
randomLoot = process.argv.includes('--random-loot');
if (args[0] === '--worker') {
  // Processus fils : imprime ses runs en JSON.
  console.log(JSON.stringify(runRange(args[1] as Policy, Number(args[2]), Number(args[3]))));
} else {
  const N = Number(args[0] ?? 300);
  const only = args[1] as Policy | undefined;
  const t0 = Date.now();
  // Les runs sont réparties sur plusieurs processus (même résultat qu'en série : chaque run a sa graine).
  // Modules Node importés dynamiquement (le projet n'a pas les types de Node).
  const { spawn } = await import('node:' + 'child_process');
  const { cpus } = await import('node:' + 'os');
  const shards = Math.max(1, Math.min(Math.floor(cpus().length / 2), 16));
  const policies = (['prudent', 'agressif'] as Policy[]).filter((p) => !only || only === p);
  const work = (policy: Policy, from: number, to: number) => new Promise<RunStats[]>((resolve, reject) => {
    const ch = spawn('npx', ['vite-node', 'tests/runsim.ts', '--worker', policy, String(from), String(to), ...(randomLoot ? ['--random-loot'] : [])], { stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = '';
    ch.stdout.on('data', (d: unknown) => (buf += String(d)));
    ch.on('close', (code: number) => (code === 0 ? resolve(JSON.parse(buf.trim().split('\n').pop()!)) : reject(new Error(`worker ${code}`))));
  });
  const results = await Promise.all(policies.map((p) => Promise.all(Array.from({ length: shards }, (_, k) => work(p, Math.floor((k * N) / shards), Math.floor(((k + 1) * N) / shards))))));
  policies.forEach((p, i) => report(p, N, results[i].flat()));
  console.log(`\n(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
