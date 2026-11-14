// Profil du joueur, sur l'appareil (pas de serveur) : statistiques, historique des parties, carnet de collection,
// niveaux de Menace débloqués par opérateur, défi du jour. Pur : le stockage est passé en paramètre pour les tests.
import { ITEMS } from '../data/items';
import { OPERATOR_IDS, OperatorId } from '../data/operators';
import { RECIPES } from '../data/recipes';
import { hashParts } from './rng';
import type { RunState } from './run';
import { ROUNDS } from './zone';

const KEY = 'hotdrop.profile.v1';
/** Parties gardées dans l'historique. */
export const HISTORY_MAX = 12;
/** Niveaux de Menace : 0 (normal) à MENACE_MAX. */
export const MENACE_MAX = 5;

/** Ce que chaque niveau de Menace ajoute (cumulatif). */
export const MENACE_INFO: { name: string; text: string }[] = [
  { name: 'Normal', text: 'La partie telle quelle.' },
  { name: 'Zone chaude', text: 'Tous les bots sont plus dangereux (+0,5 de danger).' },
  { name: 'Économie de guerre', text: '3 crédits de moins au départ, relance de la boutique à 3 cr.' },
  { name: 'Sans filet', text: 'Pas de Goulag : la première défaite est la dernière.' },
  { name: 'Élite partout', text: 'Bots encore plus dangereux (+1 de danger en tout), Top 1 compris.' },
  { name: 'Gaz toxique', text: 'Tes PV max sont réduits de 15 %.' },
];

export interface RunRecord {
  /** Date locale AAAA-MM-JJ. */
  date: string;
  operator: OperatorId;
  menace: number;
  daily?: boolean;
  result: 'win' | 'lose';
  /** Cercles franchis (0 à ROUNDS ; ROUNDS = Top 1 atteint). */
  round: number;
  wins: number;
  /** Objets marquants du sac final : légendaires et objets les plus chers. */
  key: string[];
}

export interface Profile {
  v: 1;
  runs: number;
  top1: number;
  /** Plus haut niveau de Menace débloqué par opérateur. */
  menace: Record<OperatorId, number>;
  /** Plus haut niveau de Menace gagné (Top 1) par opérateur, -1 = jamais. */
  menaceWon: Record<OperatorId, number>;
  /** Meilleur résultat par opérateur : cercles franchis, ROUNDS + 1 = Top 1 gagné. */
  best: Record<OperatorId, number>;
  /** Objets déjà obtenus au moins une fois (carnet de collection). */
  seen: string[];
  history: RunRecord[];
  /** Défi du jour : meilleur résultat par date. */
  daily: Record<string, { result: 'win' | 'lose'; round: number }>;
}

export interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const per = <T>(v: T) => Object.fromEntries(OPERATOR_IDS.map((id) => [id, v])) as Record<OperatorId, T>;

export function emptyProfile(): Profile {
  return { v: 1, runs: 0, top1: 0, menace: per(0), menaceWon: per(-1), best: per(0), seen: [], history: [], daily: {} };
}

function store(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadProfile(s: Store | null = store()): Profile {
  try {
    const raw = s?.getItem(KEY);
    if (!raw) return emptyProfile();
    const p = JSON.parse(raw) as Profile;
    if (p.v !== 1) return emptyProfile();
    // Champs ajoutés plus tard (nouvel opérateur…) : on complète.
    const e = emptyProfile();
    return { ...e, ...p, menace: { ...e.menace, ...p.menace }, menaceWon: { ...e.menaceWon, ...p.menaceWon }, best: { ...e.best, ...p.best } };
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(p: Profile, s: Store | null = store()): void {
  try {
    s?.setItem(KEY, JSON.stringify(p));
  } catch {
    /* stockage plein ou indisponible : tant pis */
  }
}

/** Ajoute des objets au carnet ; renvoie ceux qui sont nouveaux. */
export function markSeen(p: Profile, ids: string[]): string[] {
  const have = new Set(p.seen);
  const fresh = [...new Set(ids)].filter((id) => ITEMS[id] && !have.has(id));
  p.seen.push(...fresh);
  return fresh;
}

/** Raccourci pour la sauvegarde de la run : note dans le carnet les objets du joueur. */
export function noteItems(ids: string[], s: Store | null = store()): string[] {
  const p = loadProfile(s);
  const fresh = markSeen(p, ids);
  if (fresh.length) saveProfile(p, s);
  return fresh;
}

/** Progression du carnet : objets de base, assemblés (recettes découvertes) et légendaires. */
export function collection(p: Profile): { base: [number, number]; crafted: [number, number]; legendary: [number, number]; recipes: [number, number] } {
  const seen = new Set(p.seen);
  const all = Object.values(ITEMS);
  const count = (f: (d: (typeof all)[number]) => boolean): [number, number] => [all.filter((d) => f(d) && seen.has(d.id)).length, all.filter(f).length];
  const outputs = new Set(RECIPES.map((r) => r.output));
  return {
    base: count((d) => !d.crafted && !d.legendary),
    crafted: count((d) => !!d.crafted),
    legendary: count((d) => !!d.legendary),
    recipes: [[...outputs].filter((o) => seen.has(o)).length, outputs.size],
  };
}

export function today(d = new Date()): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

/** Défi du jour : même graine et même opérateur pour tout le monde ce jour-là, Menace 1. */
export function dailyChallenge(date = today()): { seed: number; operator: OperatorId; menace: number } {
  const seed = hashParts('defi', date) % 1_000_000_000;
  return { seed, operator: OPERATOR_IDS[seed % OPERATOR_IDS.length], menace: 1 };
}

export interface RunOutcome {
  /** Niveau de Menace qui vient d'être débloqué pour cet opérateur, s'il y en a un. */
  unlocked?: number;
  /** Nouveau record pour cet opérateur. */
  record: boolean;
  /** Meilleur résultat du défi du jour amélioré. */
  dailyBest?: boolean;
}

/** Cercles franchis à la fin d'une run (ROUNDS + 1 = Top 1 gagné). */
export function runScore(run: Pick<RunState, 'over' | 'round'>): number {
  return run.over === 'win' ? ROUNDS + 1 : Math.min(run.round, ROUNDS);
}

/** Enregistre une run terminée. Gagner le Top 1 au niveau de Menace le plus haut débloque le suivant. */
export function recordRun(p: Profile, run: RunState, date = today()): RunOutcome {
  const win = run.over === 'win';
  const menace = run.menace ?? 0;
  const op = run.operator;
  const score = runScore(run);
  const out: RunOutcome = { record: score > p.best[op] };
  p.runs++;
  if (win) p.top1++;
  if (out.record) p.best[op] = score;
  if (win) {
    p.menaceWon[op] = Math.max(p.menaceWon[op], menace);
    if (!run.daily && menace >= p.menace[op] && p.menace[op] < MENACE_MAX) {
      p.menace[op] = menace + 1;
      out.unlocked = menace + 1;
    }
  }
  if (run.daily) {
    const prev = p.daily[run.daily];
    const prevScore = prev ? (prev.result === 'win' ? ROUNDS + 1 : prev.round) : -1;
    if (score > prevScore) {
      p.daily[run.daily] = { result: win ? 'win' : 'lose', round: Math.min(run.round, ROUNDS) };
      out.dailyBest = true;
    }
  }
  const placed = run.items.filter((i) => i.placed).map((i) => i.defId);
  const key = [...new Set(placed)].sort((a, b) => Number(!!ITEMS[b].legendary) - Number(!!ITEMS[a].legendary) || ITEMS[b].price - ITEMS[a].price).slice(0, 4);
  p.history.unshift({ date, operator: op, menace, ...(run.daily ? { daily: true } : {}), result: win ? 'win' : 'lose', round: Math.min(run.round, ROUNDS), wins: run.wins ?? 0, key });
  p.history.length = Math.min(p.history.length, HISTORY_MAX);
  markSeen(p, run.items.map((i) => i.defId));
  return out;
}
