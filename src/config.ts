// Mise en page portrait de référence 720 × 1280, mise à l'échelle en FIT.
export const W = 720;
export const H = 1280;

export const CELL = 80;
export const GRID_X = Math.round((W - 7 * CELL) / 2);
export const GRID_Y = 404;

export const STATUS = { x: 0, y: 0, w: W, h: 76 };
export const COMBAT = { x: 20, y: 84, w: 680, h: 288 };
export const TRAY = { x: 20, y: 976, w: 680, h: 172 };
export const SELL = { x: 20, y: 976, w: 100, h: 172 };
export const RESERVE = { x: 128, y: 976, w: 572, h: 172, slots: 6 };
export const BUTTON = { x: 20, y: 1164, w: 680, h: 92 };

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
export const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export const C = {
  bg: 0x14160f,
  panel: 0x22261c,
  panelLine: 0x454b3a,
  cell: 0x2b3024,
  cellLine: 0x3a4031,
  zonePoitrine: 0x33402e,
  zoneFlancs: 0x2e3a3f,
  zoneCeinture: 0x41372b,
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
