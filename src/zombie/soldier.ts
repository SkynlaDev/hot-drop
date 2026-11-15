// Mode Zombie : soldat en couches (prototype). Corps de Viper sans arme, arme posée dans la main, main(s) avant
// redessinée(s) par-dessus : changer d'arme (ou plus tard de skin d'arme) ne demande aucun nouveau sprite de
// personnage. Quatre vues : profil (droite, et gauche par retournement), face (vers le bas de l'écran) et dos (vers
// le haut, l'arme passe derrière le corps). Sprites : public/art/zombie/couches (tools/art/layer-weapons.py),
// positions : layersData.ts.
//
// Les trois images partagent la même origine (les pieds du corps, exprimés dans les pixels de chacune) : le
// retournement gauche/droite et l'échelle s'appliquent donc pareil aux trois.
import Phaser from 'phaser';
import type { WeaponId } from './data';
import { LAYERS } from './layersData';
import { WALK_FRAMES } from './gait';

type View = keyof typeof LAYERS.views;
type LayeredWeapon = keyof typeof LAYERS.weapons;
/** Sens montré : profil (le retournement donne la gauche), face ou dos. */
export type Facing = 'profil' | 'face' | 'dos';

const SIZE = 64;
const FEET: [number, number] = [32, 62];
const DIE_FRAMES = 9;
const DIE_FPS = 15;
/** Au-delà de cette part de vertical dans la direction, on passe de face ou de dos (≈ 50° de l'horizontale). */
const VERTICAL = 0.77;

const bodyKey = (v: View) => `zl-viper-${v}`;
const gunKey = (w: LayeredWeapon, f: Facing) => `zl-arme-${w}${f === 'profil' ? '' : `-${f}`}`;

/** Couches désactivables pour comparer : ?couches=0 dans l'adresse. */
function enabled(): boolean {
  return typeof location === 'undefined' || new URLSearchParams(location.search).get('couches') !== '0';
}

/** Vrai si l'arme a ses sprites en couches (prototype : pistolet et fusil d'assaut). */
export function hasLayers(w: WeaponId): w is LayeredWeapon {
  return w in LAYERS.weapons && enabled();
}

/** Sens montré pour une direction (dx, dy) à l'écran. */
export function facingOf(dx: number, dy: number): Facing {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6 || Math.abs(dy) / len < VERTICAL) return 'profil';
  return dy > 0 ? 'face' : 'dos';
}

export function preloadLayers(load: Phaser.Loader.LoaderPlugin) {
  const tex = load.scene.textures;
  const keys: string[] = [];
  for (const v of Object.keys(LAYERS.views) as View[]) {
    const k = bodyKey(v);
    if (!tex.exists(k)) load.image(k, `art/zombie/couches/viper-${v}.png`);
    keys.push(k);
    const sheets = LAYERS.views[v].hands ? ['walk', 'die', 'main'] : ['walk', 'die'];
    for (const s of sheets) {
      if (!tex.exists(`${k}-${s}`)) load.spritesheet(`${k}-${s}`, `art/zombie/couches/viper-${v}-${s}.png`, { frameWidth: SIZE, frameHeight: SIZE });
      keys.push(`${k}-${s}`);
    }
  }
  for (const w of Object.keys(LAYERS.weapons) as LayeredWeapon[]) {
    for (const f of ['profil', 'face', 'dos'] as Facing[]) {
      const k = gunKey(w, f);
      if (!tex.exists(k)) load.image(k, `art/zombie/couches/arme-${w}${f === 'profil' ? '' : `-${f}`}.png`);
      keys.push(k);
    }
  }
  load.once(Phaser.Loader.Events.COMPLETE, () => {
    for (const k of keys) if (tex.exists(k)) tex.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
  });
}

export class LayeredSoldier {
  readonly body: Phaser.GameObjects.Image;
  readonly gun: Phaser.GameObjects.Image;
  readonly hand: Phaser.GameObjects.Image;
  private readonly weapon: LayeredWeapon;
  private readonly w: (typeof LAYERS.weapons)[LayeredWeapon];
  private facing: Facing = 'profil';
  /** Image montrée : 0 = pose fixe, 1..8 = marche ; -1 : à poser. */
  private frame = -1;
  private phase = 0;
  private dead = false;
  /** Origine de l'arme (les pieds du corps, dans ses pixels), avant retournement. */
  private gunOrigin: [number, number] = [0, 0];

  constructor(private scene: Phaser.Scene, weapon: LayeredWeapon, scale: number) {
    this.weapon = weapon;
    this.w = LAYERS.weapons[weapon];
    this.body = scene.add.image(0, 0, bodyKey(this.w.posture)).setOrigin(FEET[0] / SIZE, FEET[1] / SIZE).setScale(scale);
    this.gun = scene.add.image(0, 0, gunKey(weapon, 'profil')).setScale(scale);
    this.hand = scene.add.image(0, 0, `${bodyKey(this.w.posture)}-main`, 0).setOrigin(FEET[0] / SIZE, FEET[1] / SIZE).setScale(scale);
    this.setFrame(0);
  }

  private view(): View {
    return this.facing === 'profil' ? this.w.posture : this.facing;
  }

  private place() {
    return this.w[this.facing];
  }

  /** Coin haut-gauche de l'arme, en pixels du corps, pour l'image `f`. */
  private gunAt(f: number): [number, number] {
    const o = LAYERS.views[this.view()].offsets[f];
    const p = this.place();
    return [p.at[0] + o[0], p.at[1] + o[1]];
  }

  private setFrame(f: number) {
    if (f === this.frame) return;
    this.frame = f;
    const v = this.view();
    if (f === 0) this.body.setTexture(bodyKey(v));
    else this.body.setTexture(`${bodyKey(v)}-walk`, f - 1);
    const hands = LAYERS.views[v].hands;
    this.hand.setVisible(hands && !this.dead);
    if (hands) this.hand.setTexture(`${bodyKey(v)}-main`, f);
    // Origine de l'arme : les pieds du corps, dans les pixels de l'arme.
    const [ax, ay] = this.gunAt(f);
    const p = this.place();
    this.gunOrigin = [(FEET[0] - ax) / p.size[0], (FEET[1] - ay) / p.size[1]];
  }

  /** Change de sens (profil, face, dos) ; la marche continue à la même phase. */
  face(facing: Facing) {
    if (this.dead || facing === this.facing) return;
    this.facing = facing;
    this.gun.setTexture(gunKey(this.weapon, facing));
    const f = this.frame;
    this.frame = -1;
    this.setFrame(Math.max(0, f));
  }

  get facingNow(): Facing {
    return this.facing;
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
    // Phaser retourne une image dans sa propre boîte, sans la refléter autour de l'origine : on reflète l'origine
    // (le corps et la main, d'origine centrée sur 64 px, n'en ont pas besoin).
    if (!this.dead) this.gun.setOrigin(b.flipX ? 1 - this.gunOrigin[0] : this.gunOrigin[0], this.gunOrigin[1]);
    // De dos, l'arme est tenue devant le soldat : derrière le corps à l'écran.
    this.gun.setDepth(b.depth + (this.facing === 'dos' ? -0.001 : 0.001));
    this.hand.setDepth(b.depth + 0.002);
    for (const im of [b, this.gun, this.hand]) {
      if (hurt !== null) im.setTintMode(Phaser.TintModes.FILL).setTint(hurt);
      else im.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
    }
  }

  /** Bout du canon dans le monde (x : les pieds ; le sens vient du retournement du corps). */
  muzzle(x: number): [number, number] {
    const [ax, ay] = this.gunAt(Math.max(0, this.frame));
    const m = this.place().muzzle;
    const s = Math.abs(this.body.scaleX);
    const dir = this.body.flipX ? -1 : 1;
    return [x + (ax + m[0] + 0.5 - FEET[0]) * s * dir, this.body.y + (ay + m[1] + 0.5 - FEET[1]) * s];
  }

  /** Images à faire disparaître ensemble (extraction). */
  parts() {
    return [this.body, this.gun, this.hand];
  }

  /** Le soldat tombe : chute du corps (dans le sens montré), l'arme lui échappe et tombe à côté. */
  die(tint: number) {
    if (this.dead) return;
    this.dead = true;
    const k = `${bodyKey(this.view())}-die`;
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
    const dir = b.flipX ? -1 : 1;
    const sc = Math.abs(b.scaleY);
    // Centre de l'arme dans le monde, pour la faire tourner sur elle-même.
    const [ax, ay] = this.gunAt(Math.max(0, this.frame));
    const p = this.place();
    const cx = b.x + (ax + p.size[0] / 2 - FEET[0]) * sc * dir;
    const cy = b.y + (ay + p.size[1] / 2 - FEET[1]) * sc;
    this.gun.setOrigin(0.5).setPosition(cx, cy).setDepth(b.depth + 0.001).setTintMode(Phaser.TintModes.MULTIPLY).setTint(tint);
    // L'arme tombe au sol devant les pieds (petite image : la rotation ne pose pas de problème d'affichage).
    this.scene.tweens.add({ targets: this.gun, y: b.y - 2 * sc, x: cx + 10 * dir, angle: 80 * dir, duration: 420, ease: 'Quad.In' });
  }
}
