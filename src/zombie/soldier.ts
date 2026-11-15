// Mode Zombie : soldat en couches (prototype). Corps de Viper sans arme, arme posée dans la main, main avant
// redessinée par-dessus : changer d'arme (ou plus tard de skin d'arme) ne demande aucun nouveau sprite de
// personnage. Sprites : public/art/zombie/couches (tools/art/layer-weapons.py), positions : layersData.ts.
//
// Les trois images partagent la même origine (les pieds du corps, exprimés dans les pixels de chacune) : le
// retournement gauche/droite et l'échelle s'appliquent donc pareil aux trois.
import Phaser from 'phaser';
import type { WeaponId } from './data';
import { LAYERS } from './layersData';
import { WALK_FRAMES } from './gait';

type Posture = keyof typeof LAYERS.postures;
type LayeredWeapon = keyof typeof LAYERS.weapons;

const SIZE = 64;
const FEET: [number, number] = [32, 62];
const DIE_FRAMES = 9;
const DIE_FPS = 15;

const key = (p: Posture) => `zl-viper-${p}`;
const gunKey = (w: LayeredWeapon) => `zl-arme-${w}`;

/** Couches désactivables pour comparer : ?couches=0 dans l'adresse. */
function enabled(): boolean {
  return typeof location === 'undefined' || new URLSearchParams(location.search).get('couches') !== '0';
}

/** Vrai si l'arme a ses sprites en couches (prototype : pistolet et fusil d'assaut). */
export function hasLayers(w: WeaponId): w is LayeredWeapon {
  return w in LAYERS.weapons && enabled();
}

export function preloadLayers(load: Phaser.Loader.LoaderPlugin) {
  const tex = load.scene.textures;
  const keys: string[] = [];
  for (const p of Object.keys(LAYERS.postures) as Posture[]) {
    const k = key(p);
    if (!tex.exists(k)) load.image(k, `art/zombie/couches/viper-${p}.png`);
    for (const s of ['walk', 'die', 'main']) {
      if (!tex.exists(`${k}-${s}`)) load.spritesheet(`${k}-${s}`, `art/zombie/couches/viper-${p}-${s}.png`, { frameWidth: SIZE, frameHeight: SIZE });
      keys.push(`${k}-${s}`);
    }
    keys.push(k);
  }
  for (const w of Object.keys(LAYERS.weapons) as LayeredWeapon[]) {
    if (!tex.exists(gunKey(w))) load.image(gunKey(w), `art/zombie/couches/arme-${w}.png`);
    keys.push(gunKey(w));
  }
  load.once(Phaser.Loader.Events.COMPLETE, () => {
    for (const k of keys) if (tex.exists(k)) tex.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
  });
}

export class LayeredSoldier {
  readonly body: Phaser.GameObjects.Image;
  readonly gun: Phaser.GameObjects.Image;
  readonly hand: Phaser.GameObjects.Image;
  private readonly posture: Posture;
  private readonly w: (typeof LAYERS.weapons)[LayeredWeapon];
  /** Image montrée : 0 = pose fixe, 1..8 = marche. */
  private frame = -1;
  private phase = 0;
  private dead = false;
  /** Origine de l'arme (les pieds du corps, dans ses pixels), avant retournement. */
  private gunOrigin: [number, number] = [0, 0];

  constructor(private scene: Phaser.Scene, weapon: LayeredWeapon, scale: number) {
    this.w = LAYERS.weapons[weapon];
    this.posture = this.w.posture;
    this.body = scene.add.image(0, 0, key(this.posture)).setOrigin(FEET[0] / SIZE, FEET[1] / SIZE).setScale(scale);
    this.gun = scene.add.image(0, 0, gunKey(weapon)).setScale(scale);
    this.hand = scene.add.image(0, 0, `${key(this.posture)}-main`, 0).setOrigin(FEET[0] / SIZE, FEET[1] / SIZE).setScale(scale);
    this.setFrame(0);
  }

  /** Coin haut-gauche de l'arme, en pixels du corps, pour l'image `f`. */
  private gunAt(f: number): [number, number] {
    const p = LAYERS.postures[this.posture];
    const o = p.offsets[f];
    return [p.hand[0] + o[0] - this.w.grip[0], p.hand[1] + o[1] - this.w.grip[1]];
  }

  private setFrame(f: number) {
    if (f === this.frame) return;
    this.frame = f;
    if (f === 0) this.body.setTexture(key(this.posture));
    else this.body.setTexture(`${key(this.posture)}-walk`, f - 1);
    this.hand.setFrame(f);
    // Origine de l'arme : les pieds du corps, dans les pixels de l'arme.
    const [ax, ay] = this.gunAt(f);
    this.gunOrigin = [(FEET[0] - ax) / this.w.size[0], (FEET[1] - ay) / this.w.size[1]];
  }

  /** Marche selon la vitesse (même règle que l'ancien soldat). Renvoie toujours vrai (marche animée). */
  animate(moving: boolean, speed: number, scale: number, dt: number): boolean {
    if (this.dead) return true;
    let f = 0;
    if (moving) {
      const fps = Math.max(8, Math.min(16, speed / (5 * scale)));
      this.phase = (this.phase + fps * dt) % WALK_FRAMES;
      f = 1 + Math.floor(this.phase);
    }
    this.setFrame(f);
    return true;
  }

  /**
   * Recopie sur l'arme et la main la position, l'échelle, le sens, la profondeur et l'opacité du corps ; `hurt` :
   * couleur du flash de dégâts (null : aucun).
   */
  sync(hurt: number | null) {
    const b = this.body;
    for (const im of [this.gun, this.hand]) {
      if (this.dead && im === this.gun) continue;
      im.setPosition(b.x, b.y).setScale(b.scaleX, b.scaleY).setFlipX(b.flipX).setAlpha(b.alpha);
    }
    // Phaser retourne l'image dans sa propre boîte, sans la refléter autour de l'origine : on reflète l'origine
    // (le corps et la main, d'origine centrée sur 64 px, n'en ont pas besoin).
    if (!this.dead) this.gun.setOrigin(b.flipX ? 1 - this.gunOrigin[0] : this.gunOrigin[0], this.gunOrigin[1]);
    this.gun.setDepth(b.depth + 0.001);
    this.hand.setDepth(b.depth + 0.002);
    for (const im of [b, this.gun, this.hand]) {
      if (hurt !== null) im.setTintMode(Phaser.TintModes.FILL).setTint(hurt);
      else im.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
    }
  }

  /** Bout du canon dans le monde (pieds en x, y ; face : 1 vers la droite, -1 vers la gauche). */
  muzzle(x: number, y: number, face: number): [number, number] {
    const [ax, ay] = this.gunAt(Math.max(0, this.frame));
    const s = Math.abs(this.body.scaleX);
    return [x + (ax + this.w.muzzle[0] - FEET[0]) * s * face, this.body.y + (ay + this.w.muzzle[1] - FEET[1]) * s];
  }

  /** Images à faire disparaître ensemble (extraction). */
  parts() {
    return [this.body, this.gun, this.hand];
  }

  /** Le soldat tombe : chute du corps, l'arme lui échappe et tombe à côté. */
  die(tint: number) {
    if (this.dead) return;
    this.dead = true;
    const k = `${key(this.posture)}-die`;
    if (!this.scene.anims.exists(k)) {
      this.scene.anims.create({ key: k, frames: this.scene.anims.generateFrameNumbers(k, { start: 0, end: DIE_FRAMES - 1 }), frameRate: DIE_FPS, repeat: 0 });
    }
    const b = this.body;
    const s = this.scene.add
      .sprite(b.x, b.y, k, 0)
      .setOrigin(b.originX, b.originY)
      .setScale(Math.abs(b.scaleX), Math.abs(b.scaleY))
      .setFlipX(b.flipX)
      .setDepth(b.depth)
      .setTint(tint);
    s.anims.timeScale = 0.7;
    s.play(k);
    b.setVisible(false);
    this.hand.setVisible(false);
    const face = b.flipX ? -1 : 1;
    const sc = Math.abs(b.scaleY);
    // Centre de l'arme dans le monde, pour la faire tourner sur elle-même.
    const [ax, ay] = this.gunAt(Math.max(0, this.frame));
    const cx = b.x + (ax + this.w.size[0] / 2 - FEET[0]) * sc * face;
    const cy = b.y + (ay + this.w.size[1] / 2 - FEET[1]) * sc;
    this.gun.setOrigin(0.5).setPosition(cx, cy).setTintMode(Phaser.TintModes.MULTIPLY).setTint(tint);
    // L'arme tombe au sol devant les pieds (petite image : la rotation ne pose pas de problème d'affichage).
    this.scene.tweens.add({ targets: this.gun, y: b.y - 2 * sc, x: cx + 10 * face, angle: 80 * face, duration: 420, ease: 'Quad.In' });
  }
}
