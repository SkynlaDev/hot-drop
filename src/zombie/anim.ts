// Mode Zombie : animations des personnages (PixelLab, public/art/zombie/anim) : marche des zombies et du
// soldat, chute des zombies abattus. Repli : si une feuille manque, l'image fixe (et le dandinement d'origine).
//
// La marche des 250 zombies n'utilise pas le lecteur d'animations de Phaser (un Sprite par zombie, une mise à
// jour par image) : l'image est choisie par GaitTracker selon la distance réellement parcourue (pas de pieds
// qui glissent), et posée par setFrame seulement quand elle change. Les chutes, peu nombreuses, sont de vraies
// animations Phaser.
import Phaser from 'phaser';
import { PX_FIGS, PxFigId, pxKey } from '../art';
import { Z_ART } from './assets';
import { GaitTracker, WALK_FRAMES } from './gait';

/** Zombies (clés de Z_ART) qui ont une marche, et ceux qui ont une chute. */
const WALKERS = Object.keys(Z_ART);
const FALLERS = ['z-marcheur1', 'z-marcheur2', 'z-marcheur3', 'z-marcheur4', 'z-coureur', 'z-cracheur', 'z-brute', 'z-boss'];
/** Images d'une chute (la première est la pose debout). */
const DIE_FRAMES = 9;
const DIE_FPS = 15;
/** Le corps reste au sol, puis s'efface (s). */
const CORPSE_HOLD = 0.9;
const CORPSE_FADE = 0.6;
const CORPSES = 24;

const PLAYER_SIZE = 64;

export const walkKey = (base: string) => `${base}-walk`;
export const dieKey = (base: string) => `${base}-die`;

function fileOf(base: string): string {
  return base.startsWith('z-') ? Z_ART[base].file : base.slice(base.indexOf('-') + 1);
}

/** Charge les feuilles (absentes : le loader le signale, l'image fixe reste). */
export function preloadZombieAnims(load: Phaser.Loader.LoaderPlugin) {
  const tex = load.scene.textures;
  const sheet = (key: string, file: string, size: number) => {
    if (!tex.exists(key)) load.spritesheet(key, `art/zombie/anim/${file}.png`, { frameWidth: size, frameHeight: size });
  };
  for (const k of WALKERS) sheet(walkKey(k), `${fileOf(k)}-walk`, Z_ART[k].size);
  for (const k of FALLERS) sheet(dieKey(k), `${fileOf(k)}-die`, Z_ART[k].size);
  for (const id of Object.keys(PX_FIGS) as PxFigId[]) {
    sheet(walkKey(pxKey(id)), `${id}-walk`, PLAYER_SIZE);
    sheet(dieKey(pxKey(id)), `${id}-die`, PLAYER_SIZE);
  }
  load.once(Phaser.Loader.Events.COMPLETE, () => {
    for (const key of tex.getTextureKeys()) if (key.endsWith('-walk') || key.endsWith('-die')) tex.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  });
}

function usable(scene: Phaser.Scene, key: string, frames: number) {
  return scene.textures.exists(key) && scene.textures.get(key).frameTotal - 1 >= frames;
}

interface Corpse {
  im: Phaser.GameObjects.Sprite;
  t: number;
}

/** Animation des personnages d'une partie. */
export class ZAnimator {
  private gait: GaitTracker;
  /** Par case : clé de base (z-…), et image de marche montrée (-1 : image fixe). */
  private base: string[];
  private frame: Int16Array;
  private walk = new Map<string, boolean>();
  private corpses: Corpse[] = [];
  private corpseI = 0;
  private playerFrame = -2;
  private playerPhase = 0;

  constructor(private scene: Phaser.Scene, n: number) {
    this.gait = new GaitTracker(n + 1);
    this.base = new Array(n).fill('');
    this.frame = new Int16Array(n).fill(-2);
    for (const k of WALKERS) this.walk.set(k, usable(scene, walkKey(k), WALK_FRAMES));
    for (const k of [...FALLERS, ...(Object.keys(PX_FIGS) as PxFigId[]).map(pxKey)]) {
      const key = dieKey(k);
      if (usable(scene, key, DIE_FRAMES) && !scene.anims.exists(key)) {
        scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: DIE_FRAMES - 1 }), frameRate: DIE_FPS, repeat: 0 });
      }
    }
    for (let i = 0; i < CORPSES; i++) {
      const im = scene.add.sprite(0, 0, '__DEFAULT').setVisible(false).setActive(false);
      this.corpses.push({ im, t: 0 });
    }
  }

  /** Vrai si ce zombie a une marche animée (sinon : image fixe et dandinement). */
  animated(key: string): boolean {
    return this.walk.get(key) === true;
  }

  /**
   * Image du zombie de la case `i` (texture `key`, à x, y, échelle `scale`) : pose la bonne image de marche.
   * Renvoie vrai si la marche est animée.
   */
  zombie(im: Phaser.GameObjects.Image, i: number, id: number, key: string, x: number, y: number, scale: number, dt: number): boolean {
    const a = Z_ART[key];
    const anim = this.walk.get(key) === true;
    if (this.base[i] !== key) {
      this.base[i] = key;
      this.frame[i] = -2;
      if (!anim) im.setTexture(key);
      im.setOrigin(a.feetX / a.size, a.feetY / a.size);
    }
    if (!anim) return false;
    const f = this.gait.step(i, id, x, y, dt, a.size, scale);
    if (f !== this.frame[i]) {
      if (this.frame[i] === -2) im.setTexture(walkKey(key), f);
      else im.setFrame(f, false, false);
      this.frame[i] = f;
    }
    return true;
  }

  /**
   * Le zombie de la case `i` vient de disparaître (abattu) : sa chute s'il en a une et s'il est à l'écran.
   * Renvoie sa clé de texture (pour les sons : le gonflé explose).
   */
  zombieGone(i: number, im: Phaser.GameObjects.Image, elite: boolean): string {
    const key = this.base[i];
    this.gait.forget(i);
    if (!this.scene.anims.exists(dieKey(key))) return key;
    const view = this.scene.cameras.main.worldView;
    if (!view.contains(im.x, im.y - 30)) return key;
    const c = this.corpses[this.corpseI++ % CORPSES];
    c.t = 0;
    c.im
      .setTexture(dieKey(key), 0)
      .setActive(true)
      .setVisible(true)
      .setOrigin(im.originX, im.originY)
      .setPosition(im.x, im.y)
      .setScale(Math.abs(im.scaleX), Math.abs(im.scaleY))
      .setFlipX(im.flipX)
      .setAlpha(1)
      .setDepth(im.depth - 1);
    if (elite) c.im.setTint(0xff8a80);
    else c.im.clearTint();
    c.im.play(dieKey(key));
    return key;
  }

  /** Corps au sol : restent un moment puis s'effacent. */
  update(dt: number) {
    const life = DIE_FRAMES / DIE_FPS + CORPSE_HOLD;
    for (const c of this.corpses) {
      if (!c.im.active) continue;
      c.t += dt;
      if (c.t > life) {
        const k = 1 - (c.t - life) / CORPSE_FADE;
        if (k <= 0) c.im.stop().setVisible(false).setActive(false);
        else c.im.setAlpha(k);
      }
    }
  }

  /**
   * Le soldat tombe : sa chute à la place de l'image (qui est cachée). Faux s'il n'a pas de chute (repli :
   * affaissement en code).
   */
  playerDeath(im: Phaser.GameObjects.Image, fig: PxFigId): boolean {
    const key = dieKey(pxKey(fig));
    if (!this.scene.anims.exists(key)) return false;
    const s = this.scene.add
      .sprite(im.x, im.y, key, 0)
      .setOrigin(im.originX, im.originY)
      .setScale(Math.abs(im.scaleX), Math.abs(im.scaleY))
      .setFlipX(im.flipX)
      .setDepth(im.depth)
      .setTint(0xb8b0bc);
    s.anims.timeScale = 0.7;
    s.play(key);
    im.setVisible(false);
    return true;
  }

  /**
   * Soldat : image de marche selon sa vitesse (`speed` px/s quand il bouge), sinon pose fixe.
   * Renvoie vrai si la marche est animée.
   */
  player(im: Phaser.GameObjects.Image, fig: PxFigId, moving: boolean, speed: number, scale: number, dt: number): boolean {
    const wk = walkKey(pxKey(fig));
    if (!usable(this.scene, wk, WALK_FRAMES)) return false;
    let f = -1;
    if (moving) {
      // Même règle que les zombies : une image tous les STRIDE px (à l'échelle), bornée.
      const fps = Math.max(8, Math.min(16, speed / (5 * scale)));
      this.playerPhase = (this.playerPhase + fps * dt) % WALK_FRAMES;
      f = Math.floor(this.playerPhase);
    }
    if (f !== this.playerFrame) {
      if (f < 0) im.setTexture(pxKey(fig));
      else im.setTexture(wk, f);
      this.playerFrame = f;
    }
    return true;
  }
}
