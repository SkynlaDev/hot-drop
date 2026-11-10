import type { EnemyUnit } from '../logic/combat';
import { Rng, pick } from '../logic/rng';
import type { Threat } from './threats';

const BASE: Record<string, EnemyUnit> = {
  milicien: { name: 'Milicien', hp: 65, armor: 0, dmg: 5, interval: 1.15, acc: 0.7 },
  mitrailleur: { name: 'Mitrailleur', hp: 95, armor: 10, dmg: 3, interval: 0.42, acc: 0.6 },
  tireur: { name: 'Tireur', hp: 60, armor: 0, dmg: 14, interval: 2.5, acc: 0.8 },
  boss: { name: 'Cdt Kesh', hp: 280, armor: 40, dmg: 8.5, interval: 0.85, acc: 0.75, grenade: { dmg: 20, every: 7 }, boss: true },
};

function scaled(e: EnemyUnit, k: number, hpMult = 1, dmgMult = 1): EnemyUnit {
  return { ...e, hp: Math.round(e.hp * k * hpMult), armor: Math.round(e.armor * k), dmg: e.dmg * k * dmgMult };
}

/** Escouade ennemie d'un lieu, déterministe pour un tour donné, modelée par ses menaces. */
export function buildEncounter(kind: 'contrat' | 'elite' | 'boss', floor: number, rng: Rng, threats: Threat[] = []): EnemyUnit[] {
  const k = 1 + 0.1 * floor;
  if (kind === 'boss') return [scaled(BASE.boss, 1), scaled(BASE.milicien, k)];
  const eliteHp = kind === 'elite' ? 1.25 : 1;

  if (threats.includes('essaim')) {
    const count = 5 + (rng() < 0.5 ? 1 : 0);
    return Array.from({ length: count }, () => {
      const base = BASE[pick(rng, ['milicien', 'milicien', 'mitrailleur'])];
      return scaled(base, k, 0.55 * eliteHp, 0.8);
    });
  }

  let count = floor <= 0 ? 1 : floor <= 2 ? 2 : 2 + (rng() < 0.5 ? 1 : 0);
  if (kind === 'elite') count = Math.min(3, count + 1);
  const tireurs = threats.includes('tireurs');
  const pool = tireurs ? ['tireur', 'tireur', 'milicien'] : floor === 0 ? ['milicien'] : ['milicien', 'milicien', 'mitrailleur', 'tireur'];
  const out: EnemyUnit[] = [];
  for (let i = 0; i < count; i++) {
    const id = tireurs && i === 0 ? 'tireur' : pick(rng, pool);
    const u = scaled(BASE[id], k, eliteHp);
    if (tireurs && id === 'tireur') u.opener = true;
    out.push(u);
  }
  return out;
}
