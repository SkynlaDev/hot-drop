// Mise en page portrait de référence 720 × 1280, mise à l'échelle en FIT.
export const W = 720;
export const H = 1280;

// Sac à dos 9 × 8 (grid.ts COLS/ROWS) : 72 px par case pour tenir dans 720 px de large.
export const CELL = 72;
export const GRID_X = Math.round((W - 9 * CELL) / 2);
export const GRID_Y = 372;

export const STATUS = { x: 0, y: 0, w: W, h: 64 };
/** Bandeau du haut : stats du sac, ou arène du duel + sac adverse. */
export const COMBAT = { x: 20, y: 72, w: 680, h: 290 };
/** Arène du duel (partie gauche du bandeau) et panneau du sac adverse (partie droite). */
export const ARENA = { x: 20, y: 72, w: 370, h: 290 };
export const ENEMY = { x: 396, y: 72, w: 304, h: 290 };
export const TRAY = { x: 20, y: 960, w: 680, h: 150 };
export const SELL = { x: 20, y: 960, w: 84, h: 150 };
export const RESERVE = { x: 108, y: 960, w: 396, h: 150, slots: 6 };
/** Sacoches en réserve (BAG_RESERVE_MAX). */
export const BAG_RESERVE = { x: 508, y: 960, w: 192, h: 150, slots: 3 };
export const BUTTON = { x: 20, y: 1124, w: 680, h: 92 };

export const FONT = 'Oswald, "Arial Narrow", system-ui, sans-serif';
export const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export const C = {
  bg: 0x14160f,
  panel: 0x22261c,
  panelLine: 0x454b3a,
  cell: 0x2b3024,
  cellLine: 0x3a4031,
  /** Toile du sac de base et cuir des sacoches. */
  canvas: 0x3b4530,
  canvasLine: 0x5d6b47,
  leather: 0x6b4a2e,
  leatherLine: 0x9a7048,
  accent: 0xff8c1a,
  danger: 0xe5484d,
  good: 0x5fbf6a,
  armor: 0x8fa3b0,
  text: '#ece8d8',
  quiet: '#9a9c88',
  accentStr: '#ff8c1a',
  dangerStr: '#ff6b6b',
  goodStr: '#7ddc86',
};
