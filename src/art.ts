// Images du jeu générées par tools/gen-art.mjs (dans public/art/) : chargement et correspondances.
import Phaser from 'phaser';
import manifest from './artManifest.json';

export const ART = manifest;

/** Icône de chaque objet. */
const ICON_OF: Record<string, string> = {
  pistolet: 'pistol', mamba_akimbo: 'pistol', taureau_jumeaux: 'pistol', revolver: 'pistol', colibri: 'pistol', taureau_magnum: 'pistol',
  smg: 'smg', smg_guepe: 'smg', smg_ours: 'smg', furet_akimbo: 'smg', ours_deluge: 'smg',
  fusil_assaut: 'rifle', ar_vesta: 'rifle', ar_hades: 'rifle', ar_lynx: 'rifle', kr4_tactique: 'rifle',
  pompe: 'shotgun', pompe_belier: 'shotgun', pompe_dragon: 'shotgun',
  precision: 'sniper', dmr_faucon: 'sniper', aigle_longuevue: 'sniper', faucon_traqueur: 'sniper',
  chg_9mm: 'mag', chg_556: 'mag', chg_762: 'mag', chg_etendu: 'mag', chg_tambour: 'mag', tracantes: 'bullets', chg_12g: 'shells', chg_44: 'bullets', perforantes: 'bullet',
  lunette: 'scope', silencieux: 'silencer', poignee: 'grip', viseur_holo: 'holo', bipied: 'bipod', refroidisseur: 'silencer',
  plaque: 'plate', armure_lourde: 'plate', casque: 'helmet', casque_lourd: 'helmet',
  frag: 'frag', thermite: 'frag', sous_munitions: 'frag', fumigene: 'smoke', flash: 'flash',
  ifak: 'medkit', kit_trauma: 'medkit', sac_medical: 'medkit', seringue: 'syringe',
};
export const iconKey = (defId: string) => `ic-${ICON_OF[defId] ?? 'bolt'}`;
export const isWeaponIcon = (defId: string) => ['pistol', 'smg', 'rifle', 'shotgun', 'sniper'].includes(ICON_OF[defId] ?? '');

/** Personnage dessiné pour chaque type d'ennemi. */
export function figureOf(name: string, opener?: boolean): string {
  if (name === 'Cdt Kesh') return 'kesh-stand';
  if (name === 'Lieutenant') return 'lt-stand';
  if (name === 'Mitrailleur') return 'mitr-stand';
  if (name === 'Tireur') return opener ? 'tir-prone' : 'tir-stand';
  return 'mil-stand';
}

/** Décors illustrés (public/art/bg) : plus de biomes, ce sont de simples ambiances. */
export type BgId = 'banlieue' | 'industrie' | 'port' | 'foret' | 'base';
export const BG_IDS = ART.backgrounds as BgId[];
export const bgKey = (b: string) => `bg-${b}`;
/** Décor d'ambiance d'une zone de la carte (stable pour un nom de zone). */
export function zoneBg(name: string): BgId {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return BG_IDS[h % BG_IDS.length];
}

/** À appeler dans le preload de la première scène. */
export function preloadArt(load: Phaser.Loader.LoaderPlugin) {
  for (const [k, v] of Object.entries(ART.icons)) load.svg(`ic-${k}`, `art/icons/${k}.svg`, { width: v.w / 2, height: v.h / 2 });
  for (const [k, v] of Object.entries(ART.figures)) load.svg(`fig-${k}`, `art/fig/${k}.svg`, { width: v.w * 3, height: v.h * 3 });
  for (const [k, v] of Object.entries(ART.covers)) load.svg(`cover-${k}`, `art/cover/${k}.svg`, { width: v.w * 3, height: v.h * 3 });
  for (const b of ART.backgrounds) load.svg(`bg-${b}`, `art/bg/${b}.svg`, { width: 1360, height: 576 });
}
