// Palette « Crépuscule » : toutes les couleurs du jeu (design/da/palette-crepuscule.png).
// Tirée des éléments PixelLab : ombres prune et couchant de l'illustration du menu, kaki des personnages,
// acier des armes. Toute nouvelle couleur passe par ici (et par la palette imposée aux générations PixelLab).

/** Couleurs nommées (nombres 0xRRGGBB, pour Phaser Graphics). */
export const P = {
  // Fonds et surfaces : anthracite légèrement prune, du plus sombre au plus clair.
  noir: 0x000000,
  nuit: 0x0f0d13,
  fond: 0x17141c,
  fond2: 0x1c1822,
  panneau: 0x221e28,
  case: 0x2b2632,
  relief: 0x342e3c,
  trait: 0x3e3746,
  trait2: 0x4b4354,
  traitClair: 0x5a5162,
  muet: 0x6b6370,
  gris: 0x8a8290,
  // Toile et équipement : kaki des personnages, cuir.
  toileSombre: 0x34362a,
  toile: 0x4a4d3a,
  toile2: 0x5b5e46,
  toileClaire: 0x6e6f55,
  kaki: 0x969678,
  sable: 0xc8c5a5,
  cuirSombre: 0x4a3626,
  cuir: 0x6f5238,
  cuirClair: 0x8b7a5a,
  cuirPale: 0xb09a72,
  // Crépuscule : accents du couchant.
  braiseSombre: 0x6e2f27,
  braise: 0xb35743,
  orange: 0xe8894a,
  orangeClair: 0xf4b06a,
  orangePale: 0xf8d9ab,
  orSombre: 0xa8843a,
  or: 0xe9c46a,
  prune: 0x574348,
  violetSombre: 0x3a2a4e,
  violet: 0x8f6bb8,
  violetClair: 0xc3a6e0,
  // Signaux de jeu.
  dangerSombre: 0x6a2226,
  danger: 0xc94a4a,
  dangerClair: 0xef7b72,
  soinSombre: 0x3f5a35,
  soin: 0x86a95a,
  soinClair: 0xa8c97a,
  gaz: 0xb5d65a,
  armure: 0x7f93a3,
  precisionSombre: 0x22465a,
  precision: 0x5fb3e0,
  precisionClaire: 0x9ad3f2,
  // Texte et acier.
  texte: 0xece2cf,
  discret: 0xa39a8c,
  acierSombre: 0x30343a,
  acier: 0x565b61,
  acierClair: 0xa9bccb,
  blanc: 0xffffff,
};

export type PaletteName = keyof typeof P;

/** Version texte « #rrggbb » d'une couleur de la palette (pour les styles de texte Phaser). */
export function hex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}
