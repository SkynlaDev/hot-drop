// Mode Zombie : musique calculée (aucun fichier). Trois boucles :
//  - « calme » : QG, nappes en ré mineur, arpège lent, vent ;
//  - « tension » : la partie ; basse pulsée, battement de cœur, cloches dissonantes ;
//  - « menace » : couche posée sur « tension » (même tempo, même longueur) pendant les hordes et le boss :
//    tambours, cuivres saturés, cordes en trémolo.
// Pur et déterministe (pas de Web Audio) : testable. Chaque boucle est une liste de notes ; une note qui dépasse
// la fin repart au début (écriture modulo la longueur) : la boucle se raccorde sans couture.
import { mulberry32 } from '../logic/rng';

export type Track = 'calme' | 'tension' | 'menace';
export const TRACKS: Track[] = ['calme', 'tension', 'menace'];
/** Fréquence d'échantillonnage des boucles (mono) : assez pour des nappes et des tambours, deux fois moins lourd. */
export const MUSIC_RATE = 22050;

const TAU = Math.PI * 2;
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Tempo et longueur (mesures de 4 temps). « tension » et « menace » partagent les leurs : elles se superposent. */
export const TRACK_TEMPO: Record<Track, { bpm: number; bars: number }> = {
  calme: { bpm: 70, bars: 8 },
  tension: { bpm: 92, bars: 8 },
  menace: { bpm: 92, bars: 8 },
};

/** Longueur d'une boucle en échantillons. */
export function trackLength(t: Track, rate = MUSIC_RATE): number {
  const { bpm, bars } = TRACK_TEMPO[t];
  return Math.round((bars * 4 * 60 * rate) / bpm);
}

type Ev = (d: Float32Array) => void;

/** Tables d'onde (une période) par jeu d'harmoniques : une lecture par échantillon au lieu de sinus. */
const TABLE = 4096;
const tables = new Map<string, Float32Array>();
function wavetable(harm: number[]): Float32Array {
  const key = harm.join(',');
  let t = tables.get(key);
  if (!t) {
    t = new Float32Array(TABLE + 1);
    for (let i = 0; i <= TABLE; i++) {
      let v = 0;
      for (let k = 0; k < harm.length; k++) if (harm[k]) v += harm[k] * Math.sin((TAU * i * (k + 1)) / TABLE);
      t[i] = v;
    }
    tables.set(key, t);
  }
  return t;
}

/** Atelier : écrit des notes dans un tampon circulaire. */
class Loop {
  readonly len: number;
  readonly beat: number;
  private rng: () => number;
  readonly evs: Ev[] = [];
  constructor(readonly rate: number, track: Track, seed: number) {
    this.len = trackLength(track, rate);
    this.beat = 60 / TRACK_TEMPO[track].bpm;
    this.rng = mulberry32(seed);
  }
  /** Moment (s) d'un temps (temps 0 = début de la boucle). */
  at(beats: number) {
    return beats * this.beat;
  }
  private span(at: number, dur: number) {
    return [Math.floor(at * this.rate), Math.ceil(dur * this.rate)];
  }
  /**
   * Note additive : somme d'harmoniques (`harm` = amplitudes), hauteur glissante possible, enveloppe
   * montée / décroissance exponentielle / fin adoucie, trémolo et saturation optionnels.
   */
  tone(o: { at: number; dur: number; f: number | ((t: number) => number); gain: number; attack?: number; decay?: number; harm?: number[]; trem?: [number, number]; drive?: number }) {
    this.evs.push((d) => {
      const [s0, n] = this.span(o.at, o.dur);
      const tab = wavetable(o.harm ?? [1]);
      const sine = wavetable([1]);
      const attack = Math.max(1, Math.floor((o.attack ?? 0.005) * this.rate));
      // Décroissance multiplicative (pas d'exp par échantillon).
      const k = o.decay ? Math.exp(-1 / (o.decay * this.rate)) : 1;
      const rel = Math.max(1, Math.floor(Math.min(0.05, o.dur * 0.3) * this.rate));
      const fixed = typeof o.f === 'number' ? o.f / this.rate : 0;
      const fn = typeof o.f === 'function' ? o.f : null;
      const tr = o.trem ? o.trem[0] / this.rate : 0;
      const depth = o.trem ? o.trem[1] : 0;
      const drive = o.drive ?? 0;
      const norm = drive ? 1 / Math.tanh(drive) : 1;
      let ph = 0;
      let tph = 0;
      let dec = 1;
      let idx = s0 % this.len;
      for (let i = 0; i < n; i++) {
        ph += fn ? fn(i / this.rate) / this.rate : fixed;
        ph -= Math.floor(ph);
        let v = tab[(ph * TABLE) | 0];
        if (drive) v = Math.tanh(v * drive) * norm;
        let e = i < attack ? i / attack : (dec *= k);
        const left = n - i;
        if (left < rel) e *= left / rel;
        if (tr) {
          tph += tr;
          tph -= Math.floor(tph);
          e *= 1 - depth + depth * (0.5 + 0.5 * sine[(tph * TABLE) | 0]);
        }
        d[idx] += v * e * o.gain;
        if (++idx >= this.len) idx = 0;
      }
    });
    return this;
  }
  /** Bruit filtré (passe-bas 1 pôle, coupure éventuellement glissante ; passe-haut optionnel). */
  noise(o: { at: number; dur: number; gain: number; lp: number | ((t: number) => number); hp?: number; attack?: number; decay?: number }) {
    const seed = Math.floor(this.rng() * 1e9);
    this.evs.push((d) => {
      const rng = mulberry32(seed);
      const [s0, n] = this.span(o.at, o.dur);
      const attack = Math.max(1, Math.floor((o.attack ?? 0.002) * this.rate));
      const k = o.decay ? Math.exp(-1 / (o.decay * this.rate)) : 1;
      const rel = Math.max(1, Math.floor(Math.min(0.05, o.dur * 0.3) * this.rate));
      const fn = typeof o.lp === 'function' ? o.lp : null;
      let cut = typeof o.lp === 'number' ? o.lp : 0;
      let lp = 0;
      let hpPrev = 0;
      let hpOut = 0;
      let dec = 1;
      let idx = s0 % this.len;
      for (let i = 0; i < n; i++) {
        if (fn && (i & 31) === 0) cut = fn(i / this.rate);
        lp += cut * (rng() * 2 - 1 - lp);
        let v = lp;
        if (o.hp) {
          hpOut = o.hp * (hpOut + v - hpPrev);
          hpPrev = v;
          v = hpOut;
        }
        let e = i < attack ? i / attack : (dec *= k);
        const left = n - i;
        if (left < rel) e *= left / rel;
        d[idx] += v * e * o.gain;
        if (++idx >= this.len) idx = 0;
      }
    });
    return this;
  }
  kick(at: number, gain: number, f0 = 95) {
    return this.tone({ at, dur: 0.35, gain, f: (t) => f0 * Math.exp(-t * 14) + 42, attack: 0.002, decay: 0.12 });
  }
  tom(at: number, gain: number, f0: number) {
    this.tone({ at, dur: 0.6, gain, f: (t) => f0 * (1 + 0.6 * Math.exp(-t * 30)), attack: 0.002, decay: 0.18, harm: [1, 0.3] });
    return this.noise({ at, dur: 0.12, gain: gain * 0.6, lp: 0.12, decay: 0.03 });
  }
  snare(at: number, gain: number) {
    this.noise({ at, dur: 0.25, gain, lp: 0.7, hp: 0.6, decay: 0.07 });
    return this.tone({ at, dur: 0.12, gain: gain * 0.5, f: 190, decay: 0.04 });
  }
  hat(at: number, gain: number) {
    return this.noise({ at, dur: 0.06, gain, lp: 0.95, hp: 0.3, decay: 0.015 });
  }
}

/** Ré mineur : fondamentales (midi) des accords, une par mesure. */
const ROOTS = [38, 38, 34, 34, 31, 31, 33, 33]; // ré, ré, si♭, si♭, sol, sol, la, la (octave 2)
/** Tierce de chaque accord (mineur sauf si♭ majeur et la majeur). */
const THIRDS = [3, 3, 4, 4, 3, 3, 4, 4];

function calme(L: Loop) {
  const chords = [
    [50, 53, 57, 64], // ré m9
    [46, 50, 53, 57], // si♭ maj7
    [43, 46, 50, 53], // sol m7
    [45, 50, 52, 55], // la 7sus4
  ];
  const bar = 4;
  for (let c = 0; c < 4; c++) {
    const at = L.at(c * 2 * bar);
    const dur = L.at(2 * bar) + 1.6; // déborde sur l'accord suivant : fondu enchaîné
    for (const m of chords[c]) {
      L.tone({ at, dur, f: hz(m), gain: 0.11, attack: 2.2, harm: [1, 0.25, 0.08], trem: [0.3 + m * 0.01, 0.25] });
      L.tone({ at, dur, f: hz(m) * 1.004, gain: 0.06, attack: 2.5, harm: [1, 0.15] });
    }
    // Basse tenue
    L.tone({ at, dur, f: hz(chords[c][0] - 12), gain: 0.16, attack: 1.5, harm: [1, 0.3] });
    // Arpège : une mesure sur deux, croches montantes, une octave au-dessus.
    const notes = chords[c].map((m) => m + 12);
    for (let k = 0; k < 8; k++) {
      L.tone({ at: at + L.at(bar + k * 0.5), dur: 1.2, f: hz(notes[k % 4] + (k >= 4 ? 12 : 0)), gain: 0.07, attack: 0.004, decay: 0.35, harm: [1, 0, 0.12] });
    }
  }
  // Vent : bruit très sourd qui respire.
  for (let k = 0; k < 4; k++) L.noise({ at: L.at(k * 8), dur: L.at(8) + 2, gain: 0.5, lp: (t) => 0.004 + 0.004 * Math.sin(t * 0.7 + k), attack: 2 });
  // Cloche lointaine.
  L.tone({ at: L.at(28), dur: 3, f: hz(81), gain: 0.05, decay: 1.2, harm: [1, 0, 0.3, 0, 0.1] });
}

function tension(L: Loop) {
  for (let b = 0; b < 8; b++) {
    const r = ROOTS[b];
    const t0 = L.at(b * 4);
    // Basse pulsée en croches (fondamentale, octave sur le « et » du 2 et du 4).
    for (let k = 0; k < 8; k++) {
      const up = k === 3 || k === 7;
      L.tone({ at: t0 + L.at(k * 0.5), dur: 0.3, f: hz(r + (up ? 12 : 0)), gain: k === 0 || k === 5 ? 0.42 : 0.28, attack: 0.004, decay: 0.12, harm: [1, 0.5, 0.33, 0.2] });
    }
    // Battement de cœur : « poum-poum » sur le 1 et le 3.
    L.kick(t0, 0.9);
    L.kick(t0 + L.at(0.38), 0.55, 80);
    L.kick(t0 + L.at(2), 0.7);
    L.kick(t0 + L.at(2.38), 0.45, 80);
    // Charleston discret sur les contretemps.
    for (let k = 0; k < 4; k++) L.hat(t0 + L.at(k + 0.5), 0.05);
    // Nappe : quinte et tierce, attaque lente, toutes les deux mesures.
    if (b % 2 === 0) {
      const dur = L.at(8) + 1.2;
      L.tone({ at: t0, dur, f: hz(r + 12), gain: 0.09, attack: 1.4, harm: [1, 0.2], trem: [3.1, 0.3] });
      L.tone({ at: t0, dur, f: hz(r + 12 + THIRDS[b]), gain: 0.07, attack: 1.6, harm: [1, 0.2], trem: [2.7, 0.3] });
      L.tone({ at: t0, dur, f: hz(r + 19), gain: 0.06, attack: 1.8, harm: [1] });
    }
  }
  // Cloches dissonantes (seconde mineure) : malaise.
  L.tone({ at: L.at(0), dur: 3, f: hz(81), gain: 0.06, decay: 1.1, harm: [1, 0, 0.35, 0, 0.12] });
  L.tone({ at: L.at(16), dur: 3, f: hz(82), gain: 0.06, decay: 1.1, harm: [1, 0, 0.35, 0, 0.12] });
  L.tone({ at: L.at(26), dur: 2, f: hz(77), gain: 0.04, decay: 0.8, harm: [1, 0, 0.35] });
}

function menace(L: Loop) {
  for (let b = 0; b < 8; b++) {
    const r = ROOTS[b];
    const t0 = L.at(b * 4);
    // Tambours graves (taiko) : 1, « et » du 2, 3 ; le 4 et son « et » une mesure sur deux.
    L.tom(t0, 0.9, 62);
    L.tom(t0 + L.at(1.5), 0.6, 70);
    L.tom(t0 + L.at(2), 0.8, 62);
    if (b % 2 === 1) {
      L.tom(t0 + L.at(3), 0.55, 82);
      L.tom(t0 + L.at(3.5), 0.65, 74);
    }
    L.snare(t0 + L.at(1), 0.32);
    L.snare(t0 + L.at(3), 0.32);
    // Cuivres saturés sur le 1 : grappe fondamentale + seconde mineure.
    L.tone({ at: t0, dur: 0.9, f: hz(r + 12), gain: 0.2, attack: 0.02, decay: 0.35, harm: [1, 0.6, 0.4, 0.3, 0.2], drive: 2.5 });
    L.tone({ at: t0, dur: 0.9, f: hz(r + 13), gain: 0.12, attack: 0.02, decay: 0.3, harm: [1, 0.5, 0.3], drive: 2 });
    // Cordes en trémolo : doubles croches, fondamentale et quinte à l'octave 4.
    for (let k = 0; k < 16; k++) {
      L.tone({ at: t0 + L.at(k * 0.25), dur: 0.16, f: hz(r + 24 + (k % 2 ? 7 : 0)), gain: 0.045, attack: 0.01, decay: 0.08, harm: [1, 0.4, 0.2] });
    }
  }
  // Montée de bruit sur la dernière mesure : relance la boucle.
  L.noise({ at: L.at(28), dur: L.at(4), gain: 0.35, lp: (t) => 0.02 + t * 0.12, hp: 0.9, attack: L.at(3.6), decay: 0.4 });
}

/** Les notes d'une boucle (à écrire dans un tampon de `len` échantillons, éventuellement par lots). */
export function trackScore(track: Track, rate = MUSIC_RATE): { len: number; evs: Ev[] } {
  const L = new Loop(rate, track, track === 'calme' ? 7 : track === 'tension' ? 11 : 13);
  if (track === 'calme') calme(L);
  else if (track === 'tension') tension(L);
  else menace(L);
  return { len: L.len, evs: L.evs };
}

/** Normalise au pic voulu (douce saturation au-delà). */
export function finishTrack(d: Float32Array, peak = 0.85): Float32Array {
  let m = 0;
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
  const k = m > 0 ? peak / m : 0;
  for (let i = 0; i < d.length; i++) d[i] = Math.tanh(d[i] * k * 1.1) / Math.tanh(1.1);
  return d;
}

/** Calcule une boucle d'un coup (tests ; le jeu la calcule par lots, voir audio.ts). */
export function renderTrack(track: Track, rate = MUSIC_RATE): Float32Array {
  const { len, evs } = trackScore(track, rate);
  const d = new Float32Array(len);
  for (const e of evs) e(d);
  return finishTrack(d);
}
