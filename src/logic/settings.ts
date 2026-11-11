// Réglages du joueur : gardés d'une partie à l'autre (localStorage), indépendants de la sauvegarde de partie.

/** Vitesses de lecture des combats. */
export const SPEEDS = [1, 2, 4] as const;

export interface Settings {
  /** Vitesse de lecture des combats (une des SPEEDS). */
  speed: number;
  /** Vibrations sur mobile. */
  vibration: boolean;
}

export const DEFAULT_SETTINGS: Settings = { speed: 1, vibration: true };
const KEY = 'hotdrop.settings.v1';

let cache: Settings | null = null;

/** Réglages enregistrés (valeurs par défaut si absents ou illisibles). */
export function getSettings(): Settings {
  if (cache) return cache;
  let s: Partial<Settings> = {};
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) s = JSON.parse(raw) as Partial<Settings>;
  } catch {
    /* stockage indisponible ou corrompu : valeurs par défaut */
  }
  cache = {
    speed: (SPEEDS as readonly number[]).includes(s.speed ?? -1) ? s.speed! : DEFAULT_SETTINGS.speed,
    vibration: typeof s.vibration === 'boolean' ? s.vibration : DEFAULT_SETTINGS.vibration,
  };
  return cache;
}

/** Modifie et enregistre des réglages. */
export function setSettings(patch: Partial<Settings>): Settings {
  cache = { ...getSettings(), ...patch };
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* stockage indisponible : le réglage vaut pour la session */
  }
  return cache;
}

/** Vitesse suivante dans SPEEDS (bouton de vitesse du combat). */
export function nextSpeed(speed: number): number {
  const i = (SPEEDS as readonly number[]).indexOf(speed);
  return SPEEDS[(i + 1) % SPEEDS.length];
}

/** Oublie le cache (tests). */
export function resetSettingsCache(): void {
  cache = null;
}
