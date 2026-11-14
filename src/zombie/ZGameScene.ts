// Mode Zombie : la partie (monde). La simulation (world.ts) avance, la scène l'affiche : sprites en réserve,
// effets (secousses, éclats, nombres, particules, sons). Le HUD, le joystick et les fenêtres sont dans
// ZHudScene, lancée par-dessus (sa caméra ne défile pas).
import Phaser from 'phaser';
import { C, H, TITLE_FONT, W } from '../config';
import { P, hex } from '../ui/palette';
import { txt, vibrate } from '../ui/widgets';
import { sfx, warmSfx, SfxId } from '../audio/sfx';
import { PX_FIGS, pxKey } from '../art';
import { MAX_ZOMBIES, xpToNext } from './data';
import { applyRun, equippedAccessories, loadSave, storeSave, weaponLevel, weaponProgress, ZClass } from './progress';
import { POOL, World } from './world';
import { DIGIT_H, DIGIT_W, GROUND, Z_ART, Z_SCALE, makeDigitTextures, makeZombieTextures, preloadZombieArt, zTexture } from './assets';
import { mulberry32 } from '../logic/rng';
import type ZHudScene from './ZHudScene';

type Img = Phaser.GameObjects.Image;

const SHOT_SFX: Record<string, SfxId> = {
  pistolet: 'shot_pistol', revolver: 'shot_pistol', smg: 'shot_smg', fusil_assaut: 'shot_rifle', kr4_mitrailleur: 'shot_rifle', pompe: 'shot_shotgun', precision: 'shot_sniper',
};
const PLAYER_SCALE = 1.25;
/** Profondeur d'un objet du monde : relative au soldat (les coordonnées du monde ne sont pas bornées). */
const ENT = 1000;
const FX = 3000;

/** Nombre de dégâts : des chiffres en images (pas de Text : leurs textures changeantes s'affichaient mal en masse). */
interface DmgNum {
  root: Phaser.GameObjects.Container;
  digits: Img[];
  life: number;
  vy: number;
}

export default class ZGameScene extends Phaser.Scene {
  world!: World;
  cls!: ZClass;
  slot = 0;
  /** Ralenti (mort). */
  slowmo = 1;
  ended = false;
  private ui!: ZHudScene;
  private ground!: Phaser.GameObjects.TileSprite;
  private player!: Img;
  private playerShadow!: Img;
  private zs: Img[] = [];
  private zsh: Img[] = [];
  private zKey: string[] = [];
  private zTint: number[] = [];
  private bullets: Img[] = [];
  private gems: Img[] = [];
  private pickups: Img[] = [];
  private mines: Img[] = [];
  private shells: Img[] = [];
  private markers: Img[] = [];
  private fires: Img[] = [];
  private turrets: Img[] = [];
  private drones: Img[] = [];
  private blades: Img[] = [];
  private decals: Img[] = [];
  private decalI = 0;
  private flashes: Img[] = [];
  private flashI = 0;
  private rings: Img[] = [];
  private ringI = 0;
  private muzzle!: Img;
  private zap!: Phaser.GameObjects.Graphics;
  private zaps: { x: number; y: number; x2: number; y2: number; t: number }[] = [];
  private nums: DmgNum[] = [];
  private numI = 0;
  private blood!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private debris!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hpBarG!: Phaser.GameObjects.Graphics;
  private lastHurt = 0;
  private finished = false;

  constructor() {
    super('zgame');
  }

  init(data: { slot?: number }) {
    this.slot = data.slot ?? 0;
  }

  preload() {
    preloadZombieArt(this.load);
  }

  create() {
    // Réinitialise l'état (la scène est relancée à chaque partie).
    this.zKey = [];
    this.zTint = [];
    this.nums = [];
    this.zaps = [];
    this.ended = false;
    this.slowmo = 1;
    this.finished = false;

    makeZombieTextures(this);
    const save = loadSave();
    this.cls = save.classes[this.slot] ?? save.classes.find((c) => c) ?? { name: 'Viper', fig: 'viper', weapon: 'fusil_assaut', perk: 'eclaireur' };
    const wp = weaponProgress(save, this.cls.weapon);
    this.world = new World(
      { weapon: this.cls.weapon, weaponLevel: weaponLevel(wp.xp).level, accessories: equippedAccessories(save, this.cls.weapon), perk: this.cls.perk },
      mulberry32((Date.now() ^ 0x5eed) >>> 0),
    );
    warmSfx([SHOT_SFX[this.cls.weapon], 'hit', 'frag', 'coin', 'reload', 'pickup', 'death', 'hit_armor']);

    this.cameras.main.setBackgroundColor(P.fond);
    this.ground = this.add.tileSprite(0, 0, W, H, GROUND).setOrigin(0).setScrollFactor(0).setDepth(-10);
    this.ground.setTileScale(2);

    const pool = (n: number, key: string, depth: number, blend?: Phaser.BlendModes) => {
      const out: Img[] = [];
      for (let i = 0; i < n; i++) {
        const im = this.add.image(0, 0, key).setVisible(false).setDepth(depth);
        if (blend !== undefined) im.setBlendMode(blend);
        out.push(im);
      }
      return out;
    };
    this.decals = pool(70, 'zb-blood', -5);
    this.fires = pool(POOL.fires, 'zb-glow', -4, Phaser.BlendModes.ADD);
    this.mines = pool(POOL.mines, 'zb-mine', -3);
    this.markers = pool(POOL.shells, 'zb-marker', -3);
    this.zsh = pool(MAX_ZOMBIES, 'zb-shadow', -2);
    this.gems = pool(POOL.gems, 'zb-gem1', -1);
    this.pickups = pool(POOL.pickups, 'zb-medkit', ENT);
    this.zs = pool(MAX_ZOMBIES, 'z-marcheur1', ENT);
    this.zKey = this.zs.map(() => '');
    this.zTint = this.zs.map(() => -1);
    this.turrets = pool(POOL.turrets, 'zb-turret', ENT);
    this.drones = pool(4, 'zb-drone', FX - 10);
    this.blades = pool(8, 'it-machette', FX - 9);
    this.bullets = pool(POOL.bullets, 'zb-bullet', FX, Phaser.BlendModes.ADD);
    this.shells = pool(POOL.shells, 'zb-grenade', FX + 1);
    this.flashes = pool(24, 'zb-glow', FX + 5, Phaser.BlendModes.ADD);
    this.rings = pool(16, 'zb-ring', FX + 6, Phaser.BlendModes.ADD);

    this.playerShadow = this.add.image(0, 0, 'zb-shadow').setDepth(-2).setScale(1.1);
    const f = PX_FIGS[this.cls.fig];
    this.player = this.add.image(0, 0, pxKey(this.cls.fig)).setOrigin(f.feet[0] / 64, f.feet[1] / 64).setScale(PLAYER_SCALE);
    this.muzzle = this.add.image(0, 0, 'zb-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(P.orangeClair).setVisible(false).setDepth(FX + 2);
    this.hpBarG = this.add.graphics().setDepth(FX + 20);
    this.zap = this.add.graphics().setDepth(FX + 3).setBlendMode(Phaser.BlendModes.ADD);

    this.blood = this.add.particles(0, 0, 'zb-px', {
      speed: { min: 60, max: 220 }, angle: { min: 200, max: 340 }, gravityY: 500, lifespan: { min: 250, max: 520 },
      scale: { start: 1.2, end: 0.4 }, tint: [0x5a1e22, 0x7a2a2a, 0x3d1a1e], emitting: false,
    }).setDepth(FX - 1);
    this.sparks = this.add.particles(0, 0, 'zb-px', {
      speed: { min: 80, max: 260 }, lifespan: { min: 120, max: 260 }, scale: { start: 0.9, end: 0 }, tint: [P.orangePale, P.or, P.orange],
      blendMode: Phaser.BlendModes.ADD, emitting: false,
    }).setDepth(FX + 4);
    this.debris = this.add.particles(0, 0, 'zb-px', {
      speed: { min: 120, max: 420 }, lifespan: { min: 300, max: 700 }, scale: { start: 1.6, end: 0 }, tint: [P.orange, P.braise, P.or, P.acierSombre],
      gravityY: 300, emitting: false,
    }).setDepth(FX + 4);

    makeDigitTextures(this);
    for (let i = 0; i < 32; i++) {
      const digits: Img[] = [];
      for (let k = 0; k < 5; k++) digits.push(this.add.image(0, 0, 'zd-0').setVisible(false));
      const root = this.add.container(0, 0, digits).setDepth(FX + 30).setVisible(false);
      this.nums.push({ root, digits, life: 0, vy: 0 });
    }

    this.syncCamera();
    this.scene.launch('zhud');
    this.ui = this.scene.get('zhud') as ZHudScene;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scene.stop('zhud'));
  }

  update(_t: number, deltaMs: number) {
    if (!this.world) return;
    const dt = Math.min(0.05, deltaMs / 1000);
    const w = this.world;
    const ui = this.ui;
    if (ui && ui.ready && !ui.blocking() && !this.ended) {
      [w.mx, w.my] = ui.readMove();
      w.update(dt);
      this.handleEvents();
      if (w.dead) this.onDeath();
      else if (w.extracted && !w.endless) ui.openExtraction();
      else if (w.pendingLevels > 0) ui.openLevelUp();
    } else if (this.ended && this.slowmo < 1) {
      w.update(dt * this.slowmo);
    }
    this.syncCamera();
    this.render(dt);
  }

  private syncCamera() {
    const cam = this.cameras.main;
    cam.setScroll(this.world.px - W / 2, this.world.py - H / 2 - 40);
    this.ground.setTilePosition(cam.scrollX / this.ground.tileScaleX, cam.scrollY / this.ground.tileScaleY);
  }

  private depth(y: number) {
    return ENT + (y - this.world.py) * 0.5;
  }

  private render(dt: number) {
    const w = this.world;
    const now = this.time.now / 1000;
    // Soldat
    const bob = w.moving ? Math.abs(Math.sin(now * 12)) * 3 : 0;
    this.player.setPosition(w.px, w.py - bob).setFlipX(w.face < 0).setDepth(this.depth(w.py));
    this.player.setScale(PLAYER_SCALE * (1 + (w.moving ? Math.sin(now * 24) * 0.03 : 0)), PLAYER_SCALE * (1 - (w.moving ? Math.sin(now * 24) * 0.03 : 0)));
    const blink = w.invuln > 0 && Math.floor(now * 30) % 2 === 0;
    if (w.invuln > 0.05 && this.time.now - this.lastHurt < 150) this.player.setTintMode(Phaser.TintModes.FILL).setTint(P.danger);
    else this.player.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
    this.player.setAlpha(blink ? 0.6 : 1);
    this.playerShadow.setPosition(w.px, w.py);
    // PV et recharge sous le soldat
    const hb = this.hpBarG;
    hb.clear();
    if (w.hp < w.stats.maxHp) {
      hb.fillStyle(P.nuit, 0.8);
      hb.fillRect(w.px - 30, w.py + 10, 60, 7);
      hb.fillStyle(w.hp / w.stats.maxHp < 0.3 ? P.danger : P.soin, 1);
      hb.fillRect(w.px - 29, w.py + 11, 58 * (w.hp / w.stats.maxHp), 5);
    }
    if (w.reloadT > 0) {
      hb.fillStyle(P.nuit, 0.8);
      hb.fillRect(w.px - 30, w.py + 19, 60, 5);
      hb.fillStyle(P.orange, 1);
      hb.fillRect(w.px - 29, w.py + 20, 58 * (1 - w.reloadT / w.stats.reload), 3);
    }
    // Lueur de bouche
    if (this.muzzle.visible) {
      this.muzzle.setAlpha(this.muzzle.alpha - dt * 14);
      if (this.muzzle.alpha <= 0) this.muzzle.setVisible(false);
    }
    // Zombies
    for (let i = 0; i < MAX_ZOMBIES; i++) {
      const z = w.zombies[i];
      const im = this.zs[i];
      const sh = this.zsh[i];
      if (!z.active) {
        if (im.visible) {
          im.setVisible(false);
          sh.setVisible(false);
        }
        continue;
      }
      const key = zTexture(z.type, z.id);
      if (this.zKey[i] !== key) {
        this.zKey[i] = key;
        const a = Z_ART[key];
        im.setTexture(key).setOrigin(a.feetX / a.size, a.feetY / a.size);
      }
      const sc = Z_SCALE[z.type] * (z.elite ? 1.3 : 1);
      const ph = now * (z.speed / 9) + z.phase;
      const charging = z.type === 'boss' && (z.windT > 0 || z.chargeT > 0);
      im.setVisible(true)
        .setPosition(z.x + (z.windT > 0 ? Math.sin(now * 60) * 3 : 0), z.y - Math.abs(Math.sin(ph)) * 3)
        // Démarche en dandinant : écrasement/étirement plutôt qu'une rotation (sous Phaser 4, des sprites
        // tournés perdaient parfois la moitié de leur quad dans cette scène chargée).
        .setScale(sc * (1 + Math.sin(ph * 2) * 0.035) * (z.chargeT > 0 ? 1.12 : 1), sc * (1 - Math.sin(ph * 2) * 0.035) * (z.chargeT > 0 ? 0.92 : 1))
        .setFlipX(z.face < 0)
        .setDepth(this.depth(z.y));
      // Teinte : éclat blanc au coup, orange en feu, rouge pour l'élite, rouge vif quand le boss charge.
      // Les gros (boss, brutes, élites) ne virent pas au blanc à chaque balle : un simple voile clair.
      const big = z.type === 'boss' || z.type === 'brute' || z.elite;
      const tint = charging ? 1 : z.hitT > 0 ? (big ? 5 : 0) : z.burnT > 0 ? 2 : z.elite ? 3 : 4;
      if (tint !== this.zTint[i]) {
        this.zTint[i] = tint;
        if (tint === 0) im.setTintMode(Phaser.TintModes.FILL).setTint(P.blanc);
        else if (tint === 1) im.setTintMode(Phaser.TintModes.FILL).setTint(P.dangerClair);
        else if (tint === 2) im.setTintMode(Phaser.TintModes.MULTIPLY).setTint(0xffb070);
        else if (tint === 3) im.setTintMode(Phaser.TintModes.MULTIPLY).setTint(0xff8a80);
        else if (tint === 5) im.setTintMode(Phaser.TintModes.ADD).setTint(0x503028);
        else im.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
      }
      sh.setVisible(true).setPosition(z.x, z.y).setScale((z.r / 18) * 0.95, z.r / 18);
      // Barre de vie des gros (élites, brutes) quand ils sont entamés
      if ((z.elite || z.type === 'brute') && z.hp < z.maxHp) {
        const bw = z.r * 2.4;
        const top = z.y - (z.type === 'brute' ? 110 : 84) * (z.elite ? 1.25 : 1);
        hb.fillStyle(P.nuit, 0.85);
        hb.fillRect(z.x - bw / 2, top, bw, 6);
        hb.fillStyle(z.elite ? P.or : P.danger, 1);
        hb.fillRect(z.x - bw / 2 + 1, top + 1, (bw - 2) * (z.hp / z.maxHp), 4);
      }
      // Préparation de la charge du boss : couloir rouge vers le soldat.
      if (z.type === 'boss' && z.windT > 0) {
        const a = Math.atan2(w.py - z.y, w.px - z.x);
        const L = 520;
        const nx = -Math.sin(a) * z.r;
        const ny = Math.cos(a) * z.r;
        const ex = z.x + Math.cos(a) * L;
        const ey = z.y + Math.sin(a) * L;
        hb.fillStyle(P.danger, 0.18 + 0.12 * Math.abs(Math.sin(now * 20)));
        hb.fillTriangle(z.x + nx, z.y + ny, ex + nx, ey + ny, ex - nx, ey - ny);
        hb.fillTriangle(z.x + nx, z.y + ny, ex - nx, ey - ny, z.x - nx, z.y - ny);
      }
    }
    // Balles
    for (let i = 0; i < POOL.bullets; i++) {
      const b = w.bullets[i];
      const im = this.bullets[i];
      if (!b.active) {
        if (im.visible) im.setVisible(false);
        continue;
      }
      const key = b.src === 3 ? 'zb-spit' : b.src === 0 ? (b.crit ? 'zb-crit' : 'zb-bullet') : 'zb-drone-bullet';
      if (im.texture.key !== key) im.setTexture(key);
      im.setVisible(true).setPosition(b.x, b.y).setRotation(Math.atan2(b.vy, b.vx));
    }
    // Gemmes
    for (let i = 0; i < POOL.gems; i++) {
      const gm = w.gems[i];
      const im = this.gems[i];
      if (!gm.active) {
        if (im.visible) im.setVisible(false);
        continue;
      }
      const key = gm.v >= 20 ? 'zb-gem4' : gm.v >= 5 ? 'zb-gem3' : gm.v >= 2 ? 'zb-gem2' : 'zb-gem1';
      if (im.texture.key !== key) im.setTexture(key);
      im.setVisible(true).setPosition(gm.x, gm.y - 6 - Math.sin(now * 4 + i) * 2);
    }
    // Objets
    for (let i = 0; i < POOL.pickups; i++) {
      const p = w.pickups[i];
      const im = this.pickups[i];
      if (!p.active) {
        if (im.visible) im.setVisible(false);
        continue;
      }
      const key = `zb-${p.kind}`;
      if (im.texture.key !== key) im.setTexture(key).setScale(1.3);
      im.setVisible(true).setPosition(p.x, p.y - 14 - Math.abs(Math.sin(now * 3 + i)) * 8).setDepth(this.depth(p.y));
    }
    // Mines
    for (let i = 0; i < POOL.mines; i++) {
      const m = w.mines[i];
      this.mines[i].setVisible(m.active).setPosition(m.x, m.y).setScale(1.3).setAlpha(m.arm > 0 ? 0.5 : 0.8 + 0.2 * Math.sin(now * 10));
    }
    // Grenades et obus
    for (let i = 0; i < POOL.shells; i++) {
      const s = w.shells[i];
      const im = this.shells[i];
      const mk = this.markers[i];
      if (!s.active) {
        if (im.visible) im.setVisible(false);
        if (mk.visible) mk.setVisible(false);
        continue;
      }
      const k = s.t / s.dur;
      if (s.kind === 0) {
        if (im.texture.key !== 'zb-grenade') im.setTexture('zb-grenade');
        im.setVisible(true).setScale(1.4).setPosition(s.sx + (s.x - s.sx) * k, s.sy + (s.y - s.sy) * k - Math.sin(k * Math.PI) * 120).setRotation(k * 12);
        mk.setVisible(false);
      } else {
        if (im.texture.key !== 'zb-shell') im.setTexture('zb-shell');
        const fall = Math.max(0, (k - 0.55) / 0.45);
        im.setVisible(fall > 0).setScale(1.6).setRotation(0).setPosition(s.x, s.y - 600 * (1 - fall));
        mk.setVisible(true).setPosition(s.x, s.y).setScale((s.r / 32) * (1.3 - 0.3 * k), (s.r / 32) * 0.55 * (1.3 - 0.3 * k)).setAlpha(0.35 + 0.4 * Math.abs(Math.sin(now * 14)));
      }
    }
    // Mares de feu
    for (let i = 0; i < POOL.fires; i++) {
      const f = w.fires[i];
      const im = this.fires[i];
      im.setVisible(f.active);
      if (f.active) im.setPosition(f.x, f.y).setDisplaySize(f.r * 2.4, f.r * 1.4).setTint(P.orange).setAlpha(Math.min(1, f.t) * (0.6 + 0.2 * Math.sin(now * 20 + i)));
    }
    // Tourelles
    for (let i = 0; i < POOL.turrets; i++) {
      const t = w.turrets[i];
      this.turrets[i].setVisible(t.active).setPosition(t.x, t.y).setOrigin(0.5, 1).setScale(1.5).setFlipX(Math.cos(t.ang) < 0).setDepth(this.depth(t.y));
    }
    // Drones
    const nd = w.droneCount();
    for (let i = 0; i < 4; i++) {
      const im = this.drones[i];
      if (i >= nd) {
        im.setVisible(false);
        continue;
      }
      const [x, y] = w.dronePos(i, nd);
      im.setVisible(true).setPosition(x, y + Math.sin(now * 8 + i) * 3).setScale(1.4);
    }
    // Machettes
    const nb = w.bladeCount();
    const tb = w.evos.has('tourbillon');
    for (let i = 0; i < 8; i++) {
      const im = this.blades[i];
      if (i >= nb) {
        im.setVisible(false);
        continue;
      }
      const [x, y] = w.bladePos(i, nb);
      const key = tb ? 'it-lame_rouge' : 'it-machette';
      if (im.texture.key !== key) im.setTexture(key);
      im.setVisible(true).setPosition(x, y).setScale(tb ? 1.1 : 0.9).setRotation(now * 14 + i);
    }
    // Éclairs
    this.zap.clear();
    for (let i = this.zaps.length - 1; i >= 0; i--) {
      const z = this.zaps[i];
      z.t -= dt;
      if (z.t <= 0) {
        this.zaps.splice(i, 1);
        continue;
      }
      this.zap.lineStyle(3, P.precisionClaire, z.t / 0.15);
      this.zap.beginPath();
      this.zap.moveTo(z.x, z.y);
      for (let k = 1; k < 4; k++) {
        const f = k / 4;
        this.zap.lineTo(z.x + (z.x2 - z.x) * f + (Math.random() - 0.5) * 20, z.y + (z.y2 - z.y) * f + (Math.random() - 0.5) * 20);
      }
      this.zap.lineTo(z.x2, z.y2);
      this.zap.strokePath();
    }
    // Nombres de dégâts
    for (const n of this.nums) {
      if (n.life <= 0) continue;
      n.life -= dt;
      n.root.y += n.vy * dt;
      n.vy += 300 * dt;
      n.root.setAlpha(Math.min(1, n.life * 4));
      if (n.life <= 0) n.root.setVisible(false);
    }
  }

  /* -------------------------------------------------------------- */
  /* Effets                                                          */
  /* -------------------------------------------------------------- */

  private flash(x: number, y: number, size: number, tint: number, dur = 160) {
    const f = this.flashes[this.flashI++ % this.flashes.length];
    this.tweens.killTweensOf(f);
    f.setVisible(true).setPosition(x, y).setTint(tint).setAlpha(0.75).setDisplaySize(size, size);
    this.tweens.add({ targets: f, alpha: 0, displayWidth: size * 1.4, displayHeight: size * 1.4, duration: dur, onComplete: () => f.setVisible(false) });
  }

  private ring(x: number, y: number, r: number, tint: number) {
    const f = this.rings[this.ringI++ % this.rings.length];
    this.tweens.killTweensOf(f);
    f.setVisible(true).setPosition(x, y).setTint(tint).setAlpha(0.9).setScale(0.2, 0.12);
    this.tweens.add({ targets: f, alpha: 0, scaleX: r / 60, scaleY: (r / 60) * 0.6, duration: 320, ease: 'Quad.Out', onComplete: () => f.setVisible(false) });
  }

  private decal(x: number, y: number, key: string, scale: number, alpha = 0.9, life = 9000) {
    const d = this.decals[this.decalI++ % this.decals.length];
    this.tweens.killTweensOf(d);
    d.setTexture(key).setVisible(true).setPosition(x, y).setScale(scale).setAlpha(alpha).setFlipX(Math.random() < 0.5);
    this.tweens.add({ targets: d, alpha: 0, delay: life, duration: 2500, onComplete: () => d.setVisible(false) });
  }

  private number(x: number, y: number, s: string, color: number, size = 22) {
    const n = this.nums[this.numI++ % this.nums.length];
    const k = size / DIGIT_H;
    const chars = s.slice(0, n.digits.length);
    let total = 0;
    for (let i = 0; i < chars.length; i++) total += DIGIT_W[chars[i]] ?? DIGIT_W['0'];
    let cx = -total / 2;
    n.digits.forEach((d, i) => {
      if (i >= chars.length) {
        d.setVisible(false);
        return;
      }
      const ch = chars[i];
      const w = DIGIT_W[ch] ?? DIGIT_W['0'];
      d.setTexture(`zd-${ch}`).setVisible(true).setTint(color).setPosition(cx + w / 2, 0);
      cx += w;
    });
    n.root.setScale(k).setPosition(x + (Math.random() - 0.5) * 20, y).setVisible(true).setAlpha(1);
    n.life = 0.6;
    n.vy = -260;
  }

  private shake(ms: number, k: number) {
    this.cameras.main.shake(ms, k);
  }

  private handleEvents() {
    const w = this.world;
    let hits = 0;
    let shots = 0;
    let gemSfx = false;
    for (let i = 0; i < w.evCount; i++) {
      const e = w.events[i];
      switch (e.k) {
        case 'shot': {
          shots++;
          const f = PX_FIGS[this.cls.fig];
          const mx = w.px + f.muzzle[0] * PLAYER_SCALE * w.face;
          const my = w.py + f.muzzle[1] * PLAYER_SCALE;
          this.muzzle.setVisible(true).setPosition(mx + Math.cos(e.v) * 10, my + Math.sin(e.v) * 10).setAlpha(1).setDisplaySize(46, 46);
          break;
        }
        case 'hit':
          hits++;
          if (e.crit || e.v >= 40) this.number(e.x, e.y - 30, `${e.v}`, e.crit ? P.dangerClair : P.texte, e.crit ? 30 : 22);
          else if (hits < 6) this.number(e.x, e.y - 30, `${e.v}`, P.discret, 18);
          this.sparks.explode(3, e.x, e.y);
          break;
        case 'kill': {
          const big = e.v >= 26 || e.x2 === 1;
          this.blood.explode(big ? 14 : 6, e.x, e.y - e.v);
          this.decal(e.x, e.y, Math.random() < 0.15 ? 'zb-goo' : 'zb-blood', big ? 2 : 1.2);
          if (e.crit) {
            // Boss abattu
            this.shake(500, 0.02);
            this.flash(e.x, e.y - 60, 420, P.orange, 500);
            this.ui.banner('COLOSSE ABATTU', C.accentStr, H * 0.36);
            sfx('death', { pitch: 0.6 });
            vibrate([60, 40, 120]);
          } else if (e.x2 === 1) sfx('death', { vol: 0.7 });
          else sfx('hit', { vol: 0.25, pitch: 0.8 });
          break;
        }
        case 'boom':
          this.flash(e.x, e.y, e.v * 1.8, P.orange, 200);
          this.ring(e.x, e.y, e.v, P.orangeClair);
          this.debris.explode(Math.min(18, 6 + Math.round(e.v / 10)), e.x, e.y);
          this.decal(e.x, e.y, 'zb-scorch', e.v / 48, 0.45, 2500);
          sfx('frag', { vol: Math.min(0.8, 0.25 + e.v / 300), vary: 0.15 });
          if (e.v > 70) this.shake(120, 0.004);
          break;
        case 'hurt':
          this.lastHurt = this.time.now;
          this.ui.hurtFlash();
          this.number(w.px, w.py - 100, `-${e.v}`, P.danger, 28);
          this.shake(110, 0.006);
          sfx('hit_armor', { vol: 0.7 });
          vibrate(35);
          break;
        case 'gem':
          gemSfx = true;
          break;
        case 'pickup':
          sfx('pickup');
          this.ring(e.x, e.y, 60, P.or);
          break;
        case 'heal':
          this.number(w.px, w.py - 100, `+${e.v}`, P.soinClair, 28);
          if (e.v >= 10) sfx('heal', { vol: 0.6 });
          break;
        case 'reload':
          sfx('reload', { vol: 0.5 });
          break;
        case 'boss':
          this.ui.banner('LE COLOSSE ARRIVE', C.dangerStr, H * 0.36);
          this.shake(600, 0.01);
          sfx('mark', { pitch: 0.6, vary: 0 });
          vibrate([80, 60, 80]);
          break;
        case 'elite':
          this.ui.toast('Un zombie d’élite approche : il porte une caisse', C.accentStr, 230);
          break;
        case 'horde':
          this.ui.banner('HORDE !', C.dangerStr, H * 0.36);
          sfx('mark', { vary: 0 });
          break;
        case 'shock':
          this.zaps.push({ x: e.x, y: e.y, x2: e.x2, y2: e.y2, t: 0.15 });
          sfx('taser', { vol: 0.35 });
          break;
        case 'spit':
          sfx('smoke', { vol: 0.25, pitch: 1.6 });
          break;
        case 'revive':
          this.ui.banner('SECONDE VIE', C.goodStr, H * 0.36);
          this.ui.screenFlash(P.blanc, 0.7, 600);
          sfx('adrenaline');
          break;
        case 'frappe':
          this.ui.screenFlash(P.orangePale, 0.85, 700);
          this.shake(700, 0.025);
          this.ui.banner('FRAPPE AÉRIENNE', C.accentStr, H * 0.36);
          sfx('frag', { pitch: 0.6, vary: 0 });
          vibrate([100, 50, 150]);
          break;
        case 'charge':
          sfx('mark', { pitch: 1.4, vol: 0.6 });
          break;
        case 'levelup':
          if (e.v === 1) this.ui.toast('Caisse de ravitaillement !', C.accentStr, 230);
          break;
        case 'mine':
          sfx('place', { vol: 0.4 });
          break;
        case 'turret':
          sfx('link', { vol: 0.5 });
          break;
        case 'blade':
          this.sparks.explode(2, e.x, e.y);
          sfx('melee', { vol: 0.25 });
          break;
        default:
          break;
      }
    }
    if (shots) sfx(SHOT_SFX[this.cls.weapon], { vol: this.cls.weapon === 'pompe' || this.cls.weapon === 'precision' ? 0.55 : 0.32 });
    if (gemSfx) sfx('coin', { vol: 0.22, pitch: 1.3 + Math.min(0.6, (w.xp / xpToNext(w.level)) * 0.6) });
  }

  /* -------------------------------------------------------------- */
  /* Modales : niveau, pause, extraction, mort                       */
  /* -------------------------------------------------------------- */

  private onDeath() {
    if (this.ended) return;
    this.ended = true;
    this.ui.closeAll();
    sfx('lose', { vary: 0 });
    vibrate([100, 60, 200]);
    this.shake(400, 0.015);
    this.player.setTintMode(Phaser.TintModes.MULTIPLY).setTint(0x6b6370);
    // Le soldat s'affaisse (pas de rotation : voir la démarche des zombies).
    this.tweens.add({ targets: this.player, scaleY: PLAYER_SCALE * 0.55, scaleX: PLAYER_SCALE * 1.15, alpha: 0.7, duration: 500, ease: 'Bounce.Out' });
    // Ralenti, puis rapport.
    this.slowmo = 0.25;
    this.ui.banner('TOMBÉ AU COMBAT', C.dangerStr, H * 0.36);
    this.time.delayedCall(1600, () => this.finish(false));
  }

  /** Fin de partie : enregistre la progression et passe à l'écran de fin. */
  finish(extracted: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.ended = true;
    this.ui.closeAll();
    const result = this.world.result();
    const save = loadSave();
    const report = applyRun(save, result);
    storeSave(save);
    this.registry.set('zEnd', { result, report, cls: this.cls, extracted, dead: this.world.dead, slot: this.slot });
    this.cameras.main.fadeOut(300, 15, 13, 19);
    this.time.delayedCall(320, () => {
      this.scene.stop('zhud');
      this.scene.start('zend');
    });
  }
}
