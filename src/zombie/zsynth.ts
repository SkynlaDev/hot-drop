// Mode Zombie : bruitages calculés (aucun fichier) : grognements, rugissements du Colosse, éclatement du
// gonflé, montée de niveau, choix d'une amélioration, plaque d'XP. Pur et déterministe : testable.
import { mulberry32 } from '../logic/rng';

export type ZSfxId = 'groan1' | 'groan2' | 'groan3' | 'groan4' | 'roar' | 'roar_short' | 'burst' | 'zlevel' | 'zpick' | 'zgem';
export const ZSFX_IDS: ZSfxId[] = ['groan1', 'groan2', 'groan3', 'groan4', 'roar', 'roar_short', 'burst', 'zlevel', 'zpick', 'zgem'];
export const GROANS: ZSfxId[] = ['groan1', 'groan2', 'groan3', 'groan4'];

const TAU = Math.PI * 2;
/** Fréquence d'échantillonnage des bruitages du mode (le navigateur rééchantillonne). */
export const ZSFX_RATE = 22050;
/** Sinus en table : une lecture au lieu d'un Math.sin par harmonique et par échantillon. */
const N = 4096;
const SIN = new Float32Array(N + 1);
for (let i = 0; i <= N; i++) SIN[i] = Math.sin((TAU * i) / N);

/** Fin adoucie et normalisation (douce saturation). */
function done(d: Float32Array, rate: number, peak: number): Float32Array {
  let m = 0;
  for (const v of d) m = Math.max(m, Math.abs(v));
  const k = m > 0 ? peak / m : 0;
  const fade = Math.floor(rate * 0.01);
  for (let i = 0; i < d.length; i++) {
    const tail = d.length - i;
    d[i] = Math.tanh(d[i] * k * 1.2) / Math.tanh(1.2) * (tail < fade ? tail / fade : 1) * (i < 32 ? i / 32 : 1);
  }
  return d;
}

/**
 * Voix de monstre : source riche en harmoniques (fondamentale glissante, vibrato irrégulier), filtrée par deux
 * formants (une « voyelle » gutturale), plus un souffle. `growl` : modulation d'amplitude rapide (râle).
 */
function voice(rate: number, seed: number, o: { dur: number; f0: (t: number) => number; f1: number; f2: number; growl: number; breath: number; attack: number; release: number; drive: number }) {
  const rng = mulberry32(seed);
  const n = Math.ceil(o.dur * rate);
  const d = new Float32Array(n);
  const H = 28;
  const amp = new Float32Array(H);
  let ph = 0;
  let jit = 0;
  let br = 0;
  let rough = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    // Vibrato irrégulier : bruit très lissé.
    jit += 0.0015 * (rng() * 2 - 1 - jit);
    const f = o.f0(t) * (1 + jit * 6 + 0.03 * Math.sin(TAU * 5.3 * t));
    ph += f / rate;
    ph -= Math.floor(ph);
    // Poids des harmoniques selon les formants (recalculés tous les 64 échantillons).
    if ((i & 63) === 0) {
      for (let k = 0; k < H; k++) {
        const fk = f * (k + 1);
        const g1 = Math.exp(-(((fk - o.f1) / 160) ** 2));
        const g2 = 0.6 * Math.exp(-(((fk - o.f2) / 260) ** 2));
        amp[k] = (g1 + g2 + 0.25 / (k + 1)) * (fk < rate / 2 ? 1 : 0);
      }
    }
    let v = 0;
    for (let k = 0; k < H; k++) {
      if (amp[k] <= 0.01) continue;
      const p = ph * (k + 1);
      v += amp[k] * SIN[((p - Math.floor(p)) * N) | 0];
    }
    // Souffle et râle.
    br += 0.25 * (rng() * 2 - 1 - br);
    rough += 0.02 * (rng() - rough);
    const growl = 1 - o.growl + o.growl * (0.5 + 0.5 * Math.sin(TAU * (24 + rough * 20) * t));
    v = v * growl + br * o.breath;
    v = Math.tanh(v * o.drive);
    const e = Math.min(1, t / o.attack) * Math.min(1, (o.dur - t) / o.release);
    d[i] = v * e;
  }
  return d;
}

/** Calcule un bruitage. `rate` = fréquence d'échantillonnage du contexte audio. */
export function zsynth(id: ZSfxId, rate: number): Float32Array {
  switch (id) {
    case 'groan1':
      return done(voice(rate, 101, { dur: 1.0, f0: (t) => 92 - t * 18, f1: 520, f2: 980, growl: 0.35, breath: 0.25, attack: 0.18, release: 0.4, drive: 1.6 }), rate, 0.7);
    case 'groan2':
      return done(voice(rate, 102, { dur: 1.2, f0: (t) => 78 + 10 * Math.sin(t * 4), f1: 430, f2: 820, growl: 0.45, breath: 0.3, attack: 0.25, release: 0.5, drive: 1.8 }), rate, 0.7);
    case 'groan3':
      return done(voice(rate, 103, { dur: 0.8, f0: (t) => 110 + t * 25, f1: 640, f2: 1150, growl: 0.3, breath: 0.35, attack: 0.1, release: 0.35, drive: 1.5 }), rate, 0.7);
    case 'groan4':
      return done(voice(rate, 104, { dur: 1.1, f0: (t) => 70 - t * 10, f1: 380, f2: 760, growl: 0.55, breath: 0.25, attack: 0.2, release: 0.45, drive: 2 }), rate, 0.7);
    case 'roar': {
      // Le Colosse arrive : long rugissement grave qui monte puis s'effondre, souffle puissant.
      const d = voice(rate, 111, { dur: 2.0, f0: (t) => 48 + 22 * Math.sin(Math.min(1, t / 1.6) * Math.PI), f1: 420, f2: 900, growl: 0.6, breath: 0.6, attack: 0.15, release: 0.6, drive: 3 });
      const sub = voice(rate, 112, { dur: 2.0, f0: () => 34, f1: 120, f2: 300, growl: 0.4, breath: 0.1, attack: 0.3, release: 0.8, drive: 1.5 });
      for (let i = 0; i < d.length; i++) d[i] += sub[i] * 0.7;
      return done(d, rate, 0.95);
    }
    case 'roar_short':
      // Avant la charge : cri bref qui monte.
      return done(voice(rate, 113, { dur: 0.9, f0: (t) => 55 + t * 60, f1: 520, f2: 1100, growl: 0.5, breath: 0.5, attack: 0.06, release: 0.3, drive: 3 }), rate, 0.9);
    case 'burst': {
      // Gonflé qui éclate : claquement mouillé, bruit qui s'étouffe, bulles qui retombent.
      const rng = mulberry32(121);
      const n = Math.ceil(0.8 * rate);
      const d = new Float32Array(n);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / rate;
        const cut = 0.6 * Math.exp(-t * 9) + 0.02;
        lp += cut * (rng() * 2 - 1 - lp);
        d[i] += lp * Math.exp(-t / 0.18) * 1.2;
        d[i] += Math.sin(TAU * (70 * Math.exp(-t * 6) + 35) * t) * Math.exp(-t / 0.12) * 0.9;
      }
      for (let b = 0; b < 7; b++) {
        const at = 0.05 + rng() * 0.45;
        const f0 = 300 + rng() * 500;
        const s0 = Math.floor(at * rate);
        const m = Math.floor(0.06 * rate);
        for (let i = 0; i < m && s0 + i < n; i++) {
          const t = i / rate;
          d[s0 + i] += Math.sin(TAU * f0 * (1 - t * 5) * t) * Math.exp(-t / 0.02) * 0.25;
        }
      }
      return done(d, rate, 0.85);
    }
    case 'zlevel': {
      // Montée de niveau : arpège clair ré majeur, scintillement.
      const notes = [587, 740, 880, 1175, 1480];
      const n = Math.ceil(0.9 * rate);
      const d = new Float32Array(n);
      notes.forEach((f, k) => {
        const s0 = Math.floor(k * 0.07 * rate);
        for (let i = 0; s0 + i < n; i++) {
          const t = i / rate;
          const e = Math.min(1, t / 0.004) * Math.exp(-t / (k === notes.length - 1 ? 0.3 : 0.12));
          const x = (f * t) % 1;
          d[s0 + i] += (0.5 * (4 * Math.abs(x - 0.5) - 1) + 0.3 * Math.sin(TAU * f * 2 * t)) * e;
        }
      });
      return done(d, rate, 0.6);
    }
    case 'zpick': {
      // Choix d'une amélioration : « ka-tchink » ferme (coup grave + deux notes carrées).
      const n = Math.ceil(0.35 * rate);
      const d = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / rate;
        d[i] += Math.sin(TAU * (140 * Math.exp(-t * 18) + 50) * t) * Math.exp(-t / 0.05);
        const f = t < 0.06 ? 880 : 1319;
        const tt = t < 0.06 ? t : t - 0.06;
        d[i] += ((f * t) % 1 < 0.5 ? 0.25 : -0.25) * Math.exp(-tt / (t < 0.06 ? 0.03 : 0.1));
      }
      return done(d, rate, 0.55);
    }
    case 'zgem': {
      // Plaque d'XP : petit « blip » doux qui monte.
      const n = Math.ceil(0.09 * rate);
      const d = new Float32Array(n);
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / rate;
        ph += (1100 + 9000 * t) / rate;
        d[i] = Math.sin(TAU * ph) * Math.exp(-t / 0.03);
      }
      return done(d, rate, 0.4);
    }
  }
}
