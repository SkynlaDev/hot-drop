// Effets sonores synthétisés (aucun fichier) : chaque son est un tableau d'échantillons calculé une fois.
// Pur et déterministe (pas de Web Audio ici) : testable hors navigateur.
import { mulberry32 } from '../logic/rng';

export type SfxId =
  | 'shot_pistol' | 'shot_smg' | 'shot_rifle' | 'shot_sniper' | 'shot_shotgun'
  | 'miss' | 'hit' | 'hit_armor' | 'crit' | 'melee' | 'reload'
  | 'frag' | 'flash' | 'smoke' | 'heal' | 'taser' | 'adrenaline' | 'mark' | 'death'
  | 'win' | 'lose'
  | 'click' | 'pickup' | 'place' | 'rotate' | 'sell' | 'coin' | 'craft' | 'link' | 'drop';

const TAU = Math.PI * 2;

/** Petit atelier de synthèse : un tampon, et des couches qu'on y additionne. */
class Buf {
  readonly d: Float32Array;
  private rng: () => number;
  constructor(readonly rate: number, seconds: number, seed: number) {
    this.d = new Float32Array(Math.ceil(rate * seconds));
    this.rng = mulberry32(seed);
  }
  get len() {
    return this.d.length;
  }
  /** Bruit filtré (passe-bas à 1 pôle, puis passe-haut optionnel), enveloppe exponentielle. */
  noise(o: { at?: number; dur: number; gain: number; lp?: number | ((t: number) => number); hp?: number; decay: number; attack?: number }) {
    const s0 = Math.floor((o.at ?? 0) * this.rate);
    const n = Math.min(this.len - s0, Math.ceil(o.dur * this.rate));
    let lp = 0;
    let hpPrev = 0;
    let hpOut = 0;
    for (let i = 0; i < n; i++) {
      const t = i / this.rate;
      const w = this.rng() * 2 - 1;
      const cut = typeof o.lp === 'function' ? o.lp(t) : o.lp ?? 1;
      lp += cut * (w - lp);
      let v = lp;
      if (o.hp) {
        hpOut = o.hp * (hpOut + v - hpPrev);
        hpPrev = v;
        v = hpOut;
      }
      this.d[s0 + i] += v * o.gain * env(t, o.attack ?? 0.001, o.decay);
    }
    return this;
  }
  /** Oscillateur à fréquence glissante (sinus, carré ou triangle). */
  tone(o: { at?: number; dur: number; gain: number; f: number | ((t: number) => number); decay: number; attack?: number; wave?: 'sine' | 'square' | 'tri' }) {
    const s0 = Math.floor((o.at ?? 0) * this.rate);
    const n = Math.min(this.len - s0, Math.ceil(o.dur * this.rate));
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / this.rate;
      const f = typeof o.f === 'function' ? o.f(t) : o.f;
      ph += f / this.rate;
      const x = ph % 1;
      const v = o.wave === 'square' ? (x < 0.5 ? 0.6 : -0.6) : o.wave === 'tri' ? 4 * Math.abs(x - 0.5) - 1 : Math.sin(TAU * x);
      this.d[s0 + i] += v * o.gain * env(t, o.attack ?? 0.002, o.decay);
    }
    return this;
  }
  /** Normalise au pic voulu et adoucit les 4 dernières ms (pas de clic de fin). */
  done(peak = 0.9): Float32Array {
    let m = 0;
    for (const v of this.d) m = Math.max(m, Math.abs(v));
    const k = m > 0 ? peak / m : 0;
    const fade = Math.floor(this.rate * 0.004);
    for (let i = 0; i < this.len; i++) {
      const tail = this.len - i;
      this.d[i] = Math.tanh(this.d[i] * k * 1.2) * (tail < fade ? tail / fade : 1);
    }
    return this.d;
  }
}

/** Montée linéaire puis décroissance exponentielle (decay = constante de temps, en s). */
function env(t: number, attack: number, decay: number): number {
  return t < attack ? t / attack : Math.exp(-(t - attack) / decay);
}

/** Coup de feu : claquement de bruit, « thump » grave, et queue d'écho plus ou moins longue. */
function gun(rate: number, seed: number, p: { len: number; crack: number; body: number; thump: number; tail: number; lp: number }) {
  return new Buf(rate, p.len, seed)
    .noise({ dur: 0.03, gain: 1, lp: 0.9, hp: 0.6, decay: p.crack })
    .noise({ dur: p.len, gain: 0.8, lp: p.lp, decay: p.body })
    .tone({ dur: 0.25, gain: 0.9, f: (t) => p.thump * Math.exp(-t * 18) + 40, decay: 0.05 })
    .noise({ at: 0.02, dur: p.len, gain: 0.25, lp: 0.05, decay: p.tail })
    .done(0.95);
}

/** Petite mélodie (fréquences en Hz, notes égales). */
function jingle(rate: number, notes: number[], step: number, wave: 'square' | 'tri', last = 0.5) {
  const b = new Buf(rate, step * notes.length + last, 1);
  notes.forEach((f, i) => {
    const end = i === notes.length - 1;
    b.tone({ at: i * step, dur: end ? last + step : step * 1.2, gain: 0.5, f, decay: end ? last * 0.5 : step * 0.6, wave });
    b.tone({ at: i * step, dur: end ? last + step : step * 1.2, gain: 0.2, f: f * 2, decay: end ? last * 0.3 : step * 0.4, wave: 'sine' });
  });
  return b.done(0.7);
}

/** Calcule un son. `rate` = fréquence d'échantillonnage du contexte audio. */
export function synth(id: SfxId, rate: number): Float32Array {
  switch (id) {
    case 'shot_pistol': return gun(rate, 11, { len: 0.28, crack: 0.012, body: 0.05, thump: 160, tail: 0.08, lp: 0.35 });
    case 'shot_smg': return gun(rate, 12, { len: 0.16, crack: 0.008, body: 0.03, thump: 190, tail: 0.04, lp: 0.45 });
    case 'shot_rifle': return gun(rate, 13, { len: 0.35, crack: 0.012, body: 0.06, thump: 120, tail: 0.1, lp: 0.3 });
    case 'shot_sniper': return gun(rate, 14, { len: 0.9, crack: 0.02, body: 0.09, thump: 90, tail: 0.32, lp: 0.25 });
    case 'shot_shotgun': return gun(rate, 15, { len: 0.6, crack: 0.02, body: 0.12, thump: 75, tail: 0.18, lp: 0.18 });
    case 'miss':
      return new Buf(rate, 0.18, 21).noise({ dur: 0.18, gain: 1, lp: 0.6, hp: 0.9, attack: 0.08, decay: 0.03 }).done(0.35);
    case 'hit':
      return new Buf(rate, 0.14, 22)
        .tone({ dur: 0.14, gain: 1, f: (t) => 140 * Math.exp(-t * 12) + 50, decay: 0.04 })
        .noise({ dur: 0.06, gain: 0.5, lp: 0.15, decay: 0.015 })
        .done(0.6);
    case 'hit_armor':
      return new Buf(rate, 0.25, 23)
        .noise({ dur: 0.02, gain: 0.6, lp: 0.8, hp: 0.5, decay: 0.006 })
        .tone({ dur: 0.25, gain: 0.5, f: 1870, decay: 0.05 })
        .tone({ dur: 0.25, gain: 0.35, f: 2710, decay: 0.04 })
        .tone({ dur: 0.25, gain: 0.25, f: 4150, decay: 0.03 })
        .done(0.45);
    case 'crit':
      return new Buf(rate, 0.4, 24)
        .tone({ dur: 0.16, gain: 1, f: (t) => 170 * Math.exp(-t * 10) + 50, decay: 0.06 })
        .noise({ dur: 0.08, gain: 0.6, lp: 0.3, decay: 0.02 })
        .tone({ at: 0.01, dur: 0.38, gain: 0.35, f: 1568, decay: 0.12, wave: 'tri' })
        .tone({ at: 0.01, dur: 0.38, gain: 0.2, f: 2349, decay: 0.09 })
        .done(0.8);
    case 'melee':
      return new Buf(rate, 0.22, 25)
        .noise({ dur: 0.12, gain: 0.8, lp: (t) => 0.1 + t * 6, hp: 0.7, attack: 0.07, decay: 0.03 })
        .tone({ at: 0.09, dur: 0.12, gain: 0.8, f: (t) => 120 * Math.exp(-t * 15) + 45, decay: 0.035 })
        .done(0.6);
    case 'reload':
      return new Buf(rate, 0.3, 26)
        .noise({ dur: 0.03, gain: 1, lp: 0.7, hp: 0.4, decay: 0.006 })
        .tone({ dur: 0.05, gain: 0.4, f: 900, decay: 0.012, wave: 'square' })
        .noise({ at: 0.16, dur: 0.04, gain: 1, lp: 0.8, hp: 0.4, decay: 0.008 })
        .tone({ at: 0.16, dur: 0.06, gain: 0.5, f: 650, decay: 0.015, wave: 'square' })
        .done(0.4);
    case 'frag':
      return new Buf(rate, 1.3, 27)
        .noise({ dur: 1.3, gain: 1, lp: (t) => 0.5 * Math.exp(-t * 4) + 0.02, decay: 0.35 })
        .tone({ dur: 0.6, gain: 1, f: (t) => 90 * Math.exp(-t * 5) + 30, decay: 0.18 })
        .noise({ at: 0.05, dur: 1.2, gain: 0.3, lp: 0.03, decay: 0.5 })
        .done(1);
    case 'flash':
      return new Buf(rate, 1.0, 28)
        .noise({ dur: 0.3, gain: 1, lp: 0.6, decay: 0.05 })
        .tone({ dur: 0.2, gain: 0.8, f: (t) => 110 * Math.exp(-t * 10) + 40, decay: 0.05 })
        .tone({ at: 0.05, dur: 0.95, gain: 0.18, f: 3300, decay: 0.35 })
        .done(0.85);
    case 'smoke':
      return new Buf(rate, 0.9, 29)
        .noise({ dur: 0.05, gain: 0.7, lp: 0.6, hp: 0.5, decay: 0.01 })
        .noise({ at: 0.04, dur: 0.86, gain: 0.6, lp: 0.5, hp: 0.95, attack: 0.08, decay: 0.3 })
        .done(0.45);
    case 'heal':
      return new Buf(rate, 0.5, 30)
        .tone({ dur: 0.2, gain: 0.5, f: 784, decay: 0.08, wave: 'tri' })
        .tone({ at: 0.08, dur: 0.2, gain: 0.5, f: 988, decay: 0.08, wave: 'tri' })
        .tone({ at: 0.16, dur: 0.34, gain: 0.5, f: 1319, decay: 0.12, wave: 'tri' })
        .done(0.5);
    case 'taser':
      return new Buf(rate, 0.45, 31)
        .tone({ dur: 0.45, gain: 0.5, f: (t) => 110 + 40 * Math.sin(TAU * 23 * t), decay: 0.2, wave: 'square' })
        .noise({ dur: 0.45, gain: 0.6, lp: 0.9, hp: 0.6, decay: 0.15 })
        .done(0.55);
    case 'adrenaline':
      return new Buf(rate, 0.4, 32)
        .tone({ dur: 0.4, gain: 0.5, f: (t) => 300 + 1600 * t, decay: 0.2, wave: 'square' })
        .tone({ at: 0.03, dur: 0.37, gain: 0.3, f: (t) => 450 + 2000 * t, decay: 0.15, wave: 'tri' })
        .done(0.4);
    case 'mark':
      return new Buf(rate, 0.3, 33)
        .tone({ dur: 0.1, gain: 0.5, f: 1760, decay: 0.03, wave: 'square' })
        .tone({ at: 0.09, dur: 0.2, gain: 0.5, f: 2637, decay: 0.06, wave: 'square' })
        .done(0.35);
    case 'death':
      return new Buf(rate, 1.0, 34)
        .tone({ dur: 0.9, gain: 1, f: (t) => 80 * Math.exp(-t * 2) + 30, decay: 0.3 })
        .noise({ dur: 0.8, gain: 0.6, lp: (t) => 0.2 * Math.exp(-t * 5) + 0.02, decay: 0.25 })
        .done(0.9);
    case 'win': return jingle(rate, [523, 659, 784, 1047], 0.1, 'square', 0.5);
    case 'lose': return jingle(rate, [392, 330, 262, 196], 0.16, 'tri', 0.6);
    case 'click':
      return new Buf(rate, 0.05, 41).tone({ dur: 0.05, gain: 1, f: (t) => 1400 - 6000 * t, decay: 0.012, wave: 'square' }).done(0.25);
    case 'pickup':
      return new Buf(rate, 0.09, 42).tone({ dur: 0.09, gain: 1, f: (t) => 500 + 5000 * t, decay: 0.03, wave: 'tri' }).done(0.3);
    case 'place':
      return new Buf(rate, 0.12, 43)
        .tone({ dur: 0.12, gain: 1, f: (t) => 220 * Math.exp(-t * 20) + 70, decay: 0.03 })
        .noise({ dur: 0.04, gain: 0.5, lp: 0.2, decay: 0.01 })
        .done(0.5);
    case 'rotate':
      return new Buf(rate, 0.07, 44).noise({ dur: 0.07, gain: 1, lp: 0.5, hp: 0.6, decay: 0.012 }).done(0.25);
    case 'sell':
    case 'coin':
      return new Buf(rate, 0.35, 45)
        .tone({ dur: 0.08, gain: 0.5, f: 1319, decay: 0.04, wave: 'square' })
        .tone({ at: 0.07, dur: 0.28, gain: 0.5, f: 1976, decay: 0.08, wave: 'square' })
        .done(0.3);
    case 'craft':
      return new Buf(rate, 0.7, 46)
        .tone({ dur: 0.15, gain: 0.5, f: 523, decay: 0.06, wave: 'square' })
        .tone({ at: 0.07, dur: 0.15, gain: 0.5, f: 784, decay: 0.06, wave: 'square' })
        .tone({ at: 0.14, dur: 0.15, gain: 0.5, f: 1047, decay: 0.06, wave: 'square' })
        .tone({ at: 0.21, dur: 0.45, gain: 0.5, f: 1568, decay: 0.15, wave: 'square' })
        .noise({ at: 0.2, dur: 0.4, gain: 0.15, lp: 0.9, hp: 0.95, decay: 0.12 })
        .done(0.45);
    case 'link':
      return new Buf(rate, 0.35, 47)
        .tone({ dur: 0.35, gain: 0.5, f: 1047, decay: 0.1, wave: 'tri' })
        .tone({ at: 0.06, dur: 0.29, gain: 0.5, f: 1568, decay: 0.1, wave: 'tri' })
        .done(0.35);
    case 'drop':
      return new Buf(rate, 0.8, 48)
        .noise({ dur: 0.8, gain: 1, lp: (t) => 0.05 + t * 0.4, hp: 0.8, attack: 0.6, decay: 0.05 })
        .tone({ at: 0.6, dur: 0.2, gain: 0.8, f: (t) => 150 * Math.exp(-t * 15) + 50, decay: 0.05 })
        .done(0.6);
  }
}

export const SFX_IDS: SfxId[] = [
  'shot_pistol', 'shot_smg', 'shot_rifle', 'shot_sniper', 'shot_shotgun', 'miss', 'hit', 'hit_armor', 'crit', 'melee', 'reload',
  'frag', 'flash', 'smoke', 'heal', 'taser', 'adrenaline', 'mark', 'death', 'win', 'lose',
  'click', 'pickup', 'place', 'rotate', 'sell', 'coin', 'craft', 'link', 'drop',
];
