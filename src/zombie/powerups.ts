// Mode Zombie : tirage des power-ups au passage de niveau, empilement et évolutions. Logique pure.
import { EVOLUTIONS, EVO_IDS, EvoId, POWERS, POWER_IDS, PowerId } from './data';
import type { Levels } from './stats';

export type Choice = { kind: 'power'; id: PowerId } | { kind: 'evo'; id: EvoId } | { kind: 'soin' };

/** Évolutions prêtes : leurs deux power-ups sont au max et elles ne sont pas encore prises. */
export function readyEvolutions(levels: Levels, evos: ReadonlySet<EvoId>): EvoId[] {
  return EVO_IDS.filter((e) => !evos.has(e) && EVOLUTIONS[e].from.every((p) => (levels[p] ?? 0) >= POWERS[p].max));
}

/** Power-ups encore améliorables. */
export function upgradable(levels: Levels): PowerId[] {
  return POWER_IDS.filter((p) => (levels[p] ?? 0) < POWERS[p].max);
}

/**
 * Tire `n` choix distincts. Les évolutions prêtes passent en premier ; ensuite tirage pondéré sans remise :
 * un power-up déjà possédé pèse plus (on aime empiler), un power-up dont l'évolution est proche aussi.
 * S'il ne reste rien à améliorer, la carte « Ration » (soin) complète.
 */
export function drawChoices(rng: () => number, levels: Levels, evos: ReadonlySet<EvoId>, n = 3): Choice[] {
  const out: Choice[] = readyEvolutions(levels, evos).slice(0, n).map((id) => ({ kind: 'evo', id }) as Choice);
  const pool = upgradable(levels).map((id) => {
    const lvl = levels[id] ?? 0;
    let w = lvl > 0 ? 1.4 : 1;
    // Partenaire d'évolution déjà au max : on pousse un peu l'autre moitié.
    for (const e of EVO_IDS) {
      const [a, b] = EVOLUTIONS[e].from;
      const other = a === id ? b : b === id ? a : null;
      if (other && (levels[other] ?? 0) >= POWERS[other].max && !evos.has(e)) w += 0.6;
    }
    return { id, w };
  });
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let r = rng() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= pool[i].w;
      if (r < 0) break;
    }
    out.push({ kind: 'power', id: pool[i].id });
    pool.splice(i, 1);
  }
  if (out.length < n) out.push({ kind: 'soin' });
  return out;
}

/** Applique un choix (en place). */
export function applyChoice(levels: Levels, evos: Set<EvoId>, c: Choice): void {
  if (c.kind === 'power') levels[c.id] = Math.min(POWERS[c.id].max, (levels[c.id] ?? 0) + 1);
  else if (c.kind === 'evo') evos.add(c.id);
}

export function choiceKey(c: Choice): string {
  return c.kind === 'soin' ? 'soin' : `${c.kind}:${c.id}`;
}
