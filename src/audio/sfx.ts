// Lecture des effets sonores (Web Audio) : contexte débloqué au premier toucher, sons calculés à la demande,
// variations de hauteur, et limite de répétition pour les combats accélérés.
import { getSettings } from '../logic/settings';
import { SfxId, synth } from './synth';

export type { SfxId };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<SfxId, AudioBuffer>();
const lastPlayed = new Map<SfxId, number>();
let voices = 0;

/** Au plus ce nombre de sons en même temps. */
const MAX_VOICES = 14;
/** Écart minimal entre deux lectures d'un même son (s) : à ×4, les rafales restent lisibles. */
const MIN_GAP = 0.045;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  // Compresseur doux : les explosions ne saturent pas quand plusieurs sons se superposent.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  return ctx;
}

/** À appeler une fois : le navigateur n'autorise le son qu'après un geste du joueur. */
export function initSfx(): void {
  const unlock = () => {
    const c = audio();
    if (c && c.state === 'suspended') void c.resume();
  };
  globalThis.addEventListener?.('pointerdown', unlock, { passive: true });
  globalThis.addEventListener?.('keydown', unlock);
}

function buffer(c: AudioContext, id: SfxId): AudioBuffer {
  let b = buffers.get(id);
  if (!b) {
    const data = synth(id, c.sampleRate);
    b = c.createBuffer(1, data.length, c.sampleRate);
    b.getChannelData(0).set(data);
    buffers.set(id, b);
  }
  return b;
}

/**
 * Joue un son. `vol` 0..1 ; `pitch` = facteur de vitesse (1 = normal) ; une variation aléatoire de ±`vary`
 * évite l'effet mitraillette de la même note.
 */
export function sfx(id: SfxId, opts: { vol?: number; pitch?: number; vary?: number; pan?: number } = {}): void {
  if (!getSettings().sound) return;
  const c = audio();
  if (!c || !master || c.state !== 'running') return;
  const now = c.currentTime;
  if (now - (lastPlayed.get(id) ?? -1) < MIN_GAP || voices >= MAX_VOICES) return;
  lastPlayed.set(id, now);
  const src = c.createBufferSource();
  src.buffer = buffer(c, id);
  const vary = opts.vary ?? 0.06;
  src.playbackRate.value = (opts.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * vary);
  const g = c.createGain();
  g.gain.value = opts.vol ?? 1;
  let node: AudioNode = src.connect(g);
  if (opts.pan && c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = opts.pan;
    node = node.connect(p);
  }
  node.connect(master);
  voices++;
  src.onended = () => {
    voices--;
  };
  src.start();
}

/** Prépare les sons du combat à l'avance (évite un à-coup au premier tir). */
export function warmSfx(ids: SfxId[]): void {
  const c = audio();
  if (!c) return;
  for (const id of ids) buffer(c, id);
}
