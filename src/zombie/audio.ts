// Mode Zombie : sons et musique (Web Audio). Les échantillons sont calculés en code (zsynth.ts, music.ts) ;
// les décisions (intensité, limiteur de voix, cadence des grognements) sont dans mix.ts.
//
// Musique : « calme » dans les menus du mode, « tension » + « menace » superposées en partie (même tempo, même
// longueur, lancées au même instant) ; le volume de « menace » suit la menace (foule, horde, Colosse) avec un
// fondu. Les boucles sont calculées par petits lots entre deux images (pas d'à-coup au lancement).
import Phaser from 'phaser';
import { ZOMBIE_AUDIO, getSettings } from '../logic/settings';
import { audioOut } from '../audio/sfx';
import { MUSIC_RATE, Track, finishTrack, trackScore } from './music';
import { GROANS, ZSFX_RATE, ZSfxId, zsynth } from './zsynth';
import { Threat, VoiceLimiter, groanRate, intensity, layerGains } from './mix';
import type { World } from './world';

/** Volume général de la musique (sous les bruitages). */
const MUSIC_VOL = 0.34;
/** Constante de temps des fondus de couche (s). */
const FADE = 1.2;

/* -------------------------------------------------------------- */
/* Bruitages                                                       */
/* -------------------------------------------------------------- */

const buffers = new Map<ZSfxId, AudioBuffer>();
const limiter = new VoiceLimiter(8, {
  groan: { max: 2, gap: 0.3 },
  roar: { max: 1, gap: 0.8 },
  burst: { max: 3, gap: 0.08 },
  gem: { max: 2, gap: 0.06 },
  ui: { max: 2, gap: 0.05 },
});

function sfxBuffer(ctx: AudioContext, id: ZSfxId): AudioBuffer {
  let b = buffers.get(id);
  if (!b) {
    const d = zsynth(id, ZSFX_RATE);
    b = ctx.createBuffer(1, d.length, ZSFX_RATE);
    b.getChannelData(0).set(d);
    buffers.set(id, b);
  }
  return b;
}

/** Joue un bruitage du mode, s'il reste une voix libre dans sa catégorie. */
export function zsfx(id: ZSfxId, o: { kind?: string; vol?: number; pitch?: number; pan?: number } = {}): void {
  if (!ZOMBIE_AUDIO || !getSettings().sound) return;
  const out = audioOut();
  if (!out || out.ctx.state !== 'running') return;
  const { ctx, bus } = out;
  const kind = o.kind ?? 'ui';
  if (!limiter.tryStart(kind, ctx.currentTime)) return;
  const src = ctx.createBufferSource();
  src.buffer = sfxBuffer(ctx, id);
  src.playbackRate.value = o.pitch ?? 1;
  const g = ctx.createGain();
  g.gain.value = o.vol ?? 1;
  let node: AudioNode = src.connect(g);
  if (o.pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    node = node.connect(p);
  }
  node.connect(bus);
  src.onended = () => limiter.end(kind);
  src.start();
}

/** Calcule les bruitages à l'avance (évite un à-coup au premier grognement). */
export function warmZSfx(): void {
  if (!ZOMBIE_AUDIO) return;
  const out = audioOut();
  if (!out) return;
  for (const id of ['groan1', 'groan2', 'groan3', 'groan4', 'roar', 'roar_short', 'burst', 'zlevel', 'zpick', 'zgem'] as ZSfxId[]) sfxBuffer(out.ctx, id);
}

/* -------------------------------------------------------------- */
/* Musique                                                         */
/* -------------------------------------------------------------- */

type Mode = 'calme' | 'game';
const MODE_TRACKS: Record<Mode, Track[]> = { calme: ['calme'], game: ['tension', 'menace'] };
const ZOMBIE_SCENE_KEYS = ['zhub', 'zclass', 'zarsenal', 'zgame', 'zend'];

const tracks = new Map<Track, AudioBuffer>();
const rendering = new Map<Track, Promise<AudioBuffer | null>>();
let musicBus: GainNode | null = null;
let mode: Mode | null = null;
/** Couches en cours : source, volume, instant de départ (pour caler une couche qui arrive en retard). */
let layers = new Map<Track, { src: AudioBufferSourceNode; gain: GainNode; t0: number }>();
let target: Record<string, number> = {};

/** Calcule une boucle par lots de ~6 ms, entre deux images. */
function renderTrack(track: Track): Promise<AudioBuffer | null> {
  let p = rendering.get(track);
  if (p) return p;
  p = new Promise((resolve) => {
    const out = audioOut();
    if (!out) return resolve(null);
    const { len, evs } = trackScore(track, MUSIC_RATE);
    const d = new Float32Array(len);
    let i = 0;
    const step = () => {
      const t0 = performance.now();
      while (i < evs.length && performance.now() - t0 < 6) evs[i++](d);
      if (i < evs.length) {
        setTimeout(step, 0);
        return;
      }
      finishTrack(d);
      const b = out.ctx.createBuffer(1, len, MUSIC_RATE);
      b.getChannelData(0).set(d);
      tracks.set(track, b);
      resolve(b);
    };
    setTimeout(step, 0);
  });
  rendering.set(track, p);
  return p;
}

function bus(ctx: AudioContext): GainNode {
  if (!musicBus) {
    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(ctx.destination);
  }
  return musicBus;
}

function stopLayers(fade = 0.5) {
  const out = audioOut();
  if (!out) return;
  const now = out.ctx.currentTime;
  for (const [, l] of layers) {
    l.gain.gain.cancelScheduledValues(now);
    l.gain.gain.setTargetAtTime(0, now, fade / 3);
    l.src.stop(now + fade + 0.1);
  }
  layers = new Map();
}

/** Lance une couche (calée sur celles déjà en cours, pour que « menace » tombe en mesure). */
function startLayer(track: Track, buf: AudioBuffer, vol: number) {
  const out = audioOut();
  if (!out || layers.has(track)) return;
  const { ctx } = out;
  const when = ctx.currentTime + 0.05;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(vol, when, FADE / 2);
  src.connect(gain).connect(bus(ctx));
  const ref = [...layers.values()][0];
  const offset = ref ? (when - ref.t0) % buf.duration : 0;
  src.start(when, offset);
  layers.set(track, { src, gain, t0: when - offset });
}

/** Applique le mode voulu et le réglage « Musique ». */
function apply() {
  const out = audioOut();
  if (!out) return;
  const on = ZOMBIE_AUDIO && getSettings().music && mode !== null;
  const b = bus(out.ctx);
  const now = out.ctx.currentTime;
  b.gain.cancelScheduledValues(now);
  b.gain.setTargetAtTime(on ? MUSIC_VOL : 0, now, 0.3);
  if (!on) {
    stopLayers(1);
    return;
  }
  const want = MODE_TRACKS[mode!];
  // Couches d'un autre mode : fondu de sortie.
  for (const [t, l] of layers) {
    if (want.includes(t)) continue;
    l.gain.gain.setTargetAtTime(0, now, 0.4);
    l.src.stop(now + 1.6);
    layers.delete(t);
  }
  const m = mode;
  for (const t of want) {
    void renderTrack(t).then((buf) => {
      if (!buf || mode !== m || !getSettings().music) return;
      startLayer(t, buf, target[t] ?? 1);
    });
  }
}

/** Choisit la musique du mode Zombie pour cette scène ; elle s'arrête quand on quitte le mode. */
export function zMusic(scene: Phaser.Scene, m: Mode): void {
  if (mode !== m) {
    mode = m;
    target = m === 'game' ? { tension: 1, menace: 0 } : { calme: 0.6 };
    apply();
  }
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    // La scène suivante démarre juste après : on regarde alors s'il reste une scène du mode.
    setTimeout(() => {
      const anyZ = ZOMBIE_SCENE_KEYS.some((k) => scene.game.scene.isActive(k));
      if (!anyZ) {
        mode = null;
        apply();
      }
    }, 60);
  });
}

/** À appeler quand le réglage « Musique » change. */
export function zMusicRefresh(): void {
  apply();
}

/** Volume d'une couche de la partie (fondu). */
function setLayer(t: Track, v: number) {
  if (Math.abs((target[t] ?? 0) - v) < 0.02) return;
  target[t] = v;
  const l = layers.get(t);
  const out = audioOut();
  if (l && out) l.gain.gain.setTargetAtTime(v, out.ctx.currentTime, FADE);
}

/* -------------------------------------------------------------- */
/* Sons d'une partie                                               */
/* -------------------------------------------------------------- */

const GROAN_PITCH: Record<string, number> = { marcheur: 1, coureur: 1.18, cracheur: 1.08, kamikaze: 0.88, brute: 0.72, boss: 0.6 };

/** Sons d'une partie : grognements, Colosse, gonflés, et menace pour la musique. */
export class ZSound {
  private sinceHorde = Infinity;
  private groanAcc = 0;
  private rng = Math.random;

  constructor(private scene: Phaser.Scene) {
    warmZSfx();
    zMusic(scene, 'game');
  }

  /** Événement de la simulation. */
  event(k: string, x: number, px: number) {
    const pan = Math.max(-1, Math.min(1, (x - px) / 500)) * 0.6;
    switch (k) {
      case 'horde':
        this.sinceHorde = 0;
        break;
      case 'boss':
        zsfx('roar', { kind: 'roar', vol: 0.95, pan });
        break;
      case 'charge':
        zsfx('roar_short', { kind: 'roar', vol: 0.75, pan, pitch: 0.95 + this.rng() * 0.1 });
        break;
      default:
        break;
    }
  }

  /** Un zombie vient de disparaître (clé de texture z-…). */
  gone(key: string, x: number, px: number) {
    if (key === 'z-kamikaze') zsfx('burst', { kind: 'burst', vol: 0.8, pitch: 0.9 + this.rng() * 0.2, pan: Math.max(-1, Math.min(1, (x - px) / 500)) * 0.6 });
  }

  /** Plaques d'XP ramassées cette image (`fill` : avancement du niveau 0..1, la note monte). */
  gems(fill: number) {
    zsfx('zgem', { kind: 'gem', vol: 0.35, pitch: 1 + fill * 0.5 + this.rng() * 0.04 });
  }

  /** Chaque image : menace (musique) et grognements au hasard. */
  frame(dt: number, w: World) {
    this.sinceHorde += dt;
    let boss = false;
    for (const z of w.zombies) {
      if (z.active && z.type === 'boss') {
        boss = true;
        break;
      }
    }
    const threat: Threat = { zombies: w.alive, boss, sinceHorde: this.sinceHorde, hpFrac: w.hp / w.stats.maxHp };
    if (mode === 'game') {
      const g = layerGains(intensity(threat));
      setLayer('tension', g.tension);
      setLayer('menace', g.menace);
    }
    // Grognements : cadence selon la foule, voix d'un zombie au hasard proche de l'écran.
    this.groanAcc += groanRate(w.alive) * dt;
    if (this.groanAcc < 1) return;
    this.groanAcc -= 1 + this.rng() * 0.5;
    const view = this.scene.cameras.main.worldView;
    for (let tries = 0; tries < 8; tries++) {
      const z = w.zombies[Math.floor(this.rng() * w.zombies.length)];
      if (!z.active || z.type === 'boss') continue;
      if (z.x < view.x - 150 || z.x > view.right + 150 || z.y < view.y - 150 || z.y > view.bottom + 150) continue;
      const d = Math.hypot(z.x - w.px, z.y - w.py);
      const vol = 0.32 * Math.max(0.35, 1 - d / 900);
      const id = GROANS[Math.floor(this.rng() * GROANS.length)];
      zsfx(id, { kind: 'groan', vol, pitch: (GROAN_PITCH[z.type] ?? 1) * (0.92 + this.rng() * 0.16), pan: Math.max(-1, Math.min(1, (z.x - w.px) / 450)) * 0.7 });
      return;
    }
  }
}

/** État de la musique (essais, console) : mode, couches lancées et leurs volumes visés. */
export function zAudioDebug() {
  return { mode, music: getSettings().music, layers: [...layers.keys()], target: { ...target }, voices: limiter.playing(), ready: [...tracks.keys()] };
}
