// Images du jeu générées par tools/gen-art.mjs (dans public/art/) : chargement et correspondances.
import Phaser from 'phaser';
import manifest from './artManifest.json';
import { ITEMS } from './data/items';

export const ART = manifest;

/** Icône de chaque objet. */
const ICON_OF: Record<string, string> = {
  // Combat v2 : icônes en attendant les sprites PixelLab.
  briquet: 'flash', batterie: 'bolt', ration: 'medkit', chg_incendiaire: 'mag', chg_electrique: 'mag',
  grenade_incendiaire: 'frag', grenade_iem: 'flash', taser_lourd: 'bolt', combinaison: 'plate', plaque_isolante: 'plate',
  pistolet: 'pistol', mamba_akimbo: 'pistol', taureau_jumeaux: 'pistol', revolver: 'pistol', colibri: 'pistol', taureau_magnum: 'pistol',
  smg: 'smg', smg_guepe: 'smg', smg_ours: 'smg', furet_akimbo: 'smg', ours_deluge: 'smg',
  fusil_assaut: 'rifle', ar_vesta: 'rifle', ar_hades: 'rifle', ar_lynx: 'rifle', kr4_tactique: 'rifle',
  pompe: 'shotgun', pompe_belier: 'shotgun', pompe_dragon: 'shotgun',
  precision: 'sniper', dmr_faucon: 'sniper', aigle_longuevue: 'sniper', faucon_traqueur: 'sniper',
  chg_9mm: 'mag', chg_556: 'mag', chg_762: 'mag', chg_etendu: 'mag', chg_tambour: 'mag', tracantes: 'bullets', chg_12g: 'shells', chg_44: 'bullets', perforantes: 'bullet',
  lunette: 'scope', silencieux: 'silencer', poignee: 'grip', viseur_holo: 'holo', bipied: 'bipod', refroidisseur: 'silencer',
  plaque: 'plate', armure_lourde: 'plate', casque: 'helmet', casque_lourd: 'helmet',
  frag: 'frag', thermite: 'frag', sous_munitions: 'frag', fumigene: 'smoke', flash: 'flash',
  couteau: 'bolt', couteau_combat: 'bolt', machette: 'bolt', masse: 'hand', taser: 'flash', bandage: 'medkit',
  ifak: 'medkit', kit_trauma: 'medkit', sac_medical: 'medkit', seringue: 'syringe',
};
export const iconKey = (defId: string) => `ic-${ICON_OF[defId] ?? 'bolt'}`;
/** Sprite PixelLab d'un objet (public/art/items, 32 px par case, forme non tournée). */
export const itemSpriteKey = (defId: string) => `it-${defId}`;
export const ITEM_SPRITE_CELL = 32;
export const isWeaponIcon = (defId: string) => ['pistol', 'smg', 'rifle', 'shotgun', 'sniper'].includes(ICON_OF[defId] ?? '');

/**
 * Personnages PixelLab (public/art/px, 64 × 64, regard vers la droite).
 * Points en pixels du sprite, relatifs aux pieds : bouche du canon, tête, poitrine.
 */
export interface PxFig {
  feet: [number, number];
  muzzle: [number, number];
  head: [number, number];
  chest: [number, number];
}
export const PX_FIGS = {
  viper: { feet: [32, 62], muzzle: [21, -28], head: [0, -56], chest: [-2, -38] },
  sentinelle: { feet: [32, 62], muzzle: [27, -21], head: [0, -56], chest: [-1, -37] },
  soldat: { feet: [32, 62], muzzle: [14, -22], head: [-1, -55], chest: [-2, -38] },
  tireur: { feet: [32, 62], muzzle: [6, -32], head: [-3, -53], chest: [-4, -37] },
  lieutenant: { feet: [32, 62], muzzle: [18, -24], head: [2, -54], chest: [-2, -36] },
  mitrailleur: { feet: [32, 62], muzzle: [26, -28], head: [1, -53], chest: [-1, -34] },
  commandant: { feet: [32, 62], muzzle: [25, -30], head: [0, -56], chest: [-2, -37] },
} satisfies Record<string, PxFig>;
export type PxFigId = keyof typeof PX_FIGS;
export const PX_SIZE = 64;
export const pxKey = (id: PxFigId) => `px-${id}`;

/** Personnage d'un opérateur (Viper ou Sentinelle). */
export const opFig = (op: string): PxFigId => (op === 'sentinelle' ? 'sentinelle' : 'viper');

/** Personnage d'un adversaire : boss final, bot fort, sinon un des trois soldats selon la graine. */
export function foeFig(final: boolean, strong: boolean, seed: number): PxFigId {
  if (final) return 'commandant';
  if (strong) return 'lieutenant';
  return (['soldat', 'tireur', 'mitrailleur'] as const)[seed % 3];
}

/** Image d'un personnage pixel, pieds en (x, y), `px` pixels d'écran par pixel du sprite. */
export function pxFigure(scene: Phaser.Scene, x: number, y: number, id: PxFigId, px: number, flip = false) {
  const f = PX_FIGS[id];
  return scene.add
    .image(x, y, pxKey(id))
    .setOrigin(f.feet[0] / PX_SIZE, f.feet[1] / PX_SIZE)
    .setScale(px)
    .setFlipX(flip);
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
/** Illustration du menu principal (PixelLab, 360×400, affichée ×2). */
export const MENU_ART = 'menu-keyart';

export function preloadArt(load: Phaser.Loader.LoaderPlugin) {
  for (const [k, v] of Object.entries(ART.icons)) load.svg(`ic-${k}`, `art/icons/${k}.svg`, { width: v.w / 2, height: v.h / 2 });
  for (const [k, v] of Object.entries(ART.figures)) load.svg(`fig-${k}`, `art/fig/${k}.svg`, { width: v.w * 3, height: v.h * 3 });
  for (const [k, v] of Object.entries(ART.covers)) load.svg(`cover-${k}`, `art/cover/${k}.svg`, { width: v.w * 3, height: v.h * 3 });
  for (const b of ART.backgrounds) load.svg(`bg-${b}`, `art/bg/${b}.svg`, { width: 1360, height: 576 });
  for (const id of Object.keys(PX_FIGS) as PxFigId[]) load.image(pxKey(id), `art/px/${id}.png`);
  for (const id of Object.keys(ITEMS)) load.image(itemSpriteKey(id), `art/items/${id}.png`);
  load.image(MENU_ART, 'art/menu/keyart.png');
  // Pixel art : agrandi sans lissage.
  load.once(Phaser.Loader.Events.COMPLETE, () => {
    for (const key of [...(Object.keys(PX_FIGS) as PxFigId[]).map(pxKey), ...Object.keys(ITEMS).map(itemSpriteKey), MENU_ART]) {
      const tex = load.scene.textures.get(key);
      if (tex.key !== '__MISSING') tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  });
}
