import Phaser from 'phaser';
import { C, W } from '../config';
import { ROUNDS } from '../logic/zone';
import { clearRun, loadRun } from '../logic/run';
import { button, fadeIn, plate, txt } from '../ui/widgets';
import { P } from '../ui/palette';
import { openSettings } from '../ui/settings';
import { drawLogo } from '../ui/logo';
import { MENU_ART } from '../art';

const H = 1280;
/** Bas de l'illustration (360×400 affichée ×2). */
const ART_H = 800;

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create() {
    fadeIn(this);
    this.add.rectangle(0, 0, W, H, C.bg).setOrigin(0);
    this.topoLines();

    // Illustration : parachutiste au-dessus de la ville, cercle de gaz à l'horizon. Lente respiration.
    const art = this.add.image(W / 2, ART_H / 2, MENU_ART).setScale(2);
    this.tweens.add({ targets: art, scale: 2.035, y: ART_H / 2 - 6, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Lueur du cercle de gaz (à gauche de l'horizon) qui pulse.
    const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 6; i > 0; i--) {
      glow.fillStyle(0xe8894a, 0.035);
      glow.fillCircle(150, 300, 70 + i * 26);
    }
    this.tweens.add({ targets: glow, alpha: 0.35, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Rayons du couchant : un éventail qui tourne très lentement autour du soleil.
    const rays = this.add.graphics({ x: 338, y: 352 }).setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      rays.fillStyle(P.orangeClair, 0.05);
      rays.fillTriangle(0, 0, Math.cos(a - 0.07) * 520, Math.sin(a - 0.07) * 520, Math.cos(a + 0.07) * 520, Math.sin(a + 0.07) * 520);
    }
    this.tweens.add({ targets: rays, angle: 360, duration: 120000, repeat: -1 });
    this.tweens.add({ targets: rays, alpha: 0.5, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Nuages de crépuscule qui dérivent devant le ciel.
    for (let i = 0; i < 5; i++) this.cloud(i);

    // Braises qui montent depuis la ville.
    for (let i = 0; i < 26; i++) this.ember(true);

    // Fondu de l'illustration vers le fond, sous le logo.
    const fade = this.add.graphics();
    const F0 = 520;
    for (let i = 0; i < 28; i++) {
      fade.fillStyle(C.bg, Math.pow(i / 28, 1.6));
      fade.fillRect(0, F0 + i * 10, W, 10);
    }
    fade.fillStyle(C.bg, 1);
    fade.fillRect(0, F0 + 280, W, H);

    const saved = loadRun();

    // Logo, avec une entrée en « largage ». Plus haut quand il y a une partie à continuer (un bouton de plus).
    const ly = saved ? 830 : 870;
    const logo = drawLogo(this, W / 2, ly, saved ? 124 : 136);
    logo.setAlpha(0).setY(ly - 50);
    this.tweens.add({ targets: logo, alpha: 1, y: ly, duration: 520, ease: 'Back.easeOut', delay: 120 });
    // Éclat qui scintille sur le logo de temps en temps.
    this.time.addEvent({ delay: 3800, loop: true, startAt: 2600, callback: () => this.glint(W / 2 + Phaser.Math.Between(-150, 150), ly - Phaser.Math.Between(40, 190)) });

    const BW = 440;
    const bx = (W - BW) / 2;
    let y = saved ? 912 : 975;
    if (saved) {
      this.enter(button(this, bx, y, BW, 96, 'Continuer', () => {
        this.registry.set('run', saved);
        this.scene.start('map');
      }, { primary: true, icon: 'ic-play' }).root, 0);
      const where = saved.round >= ROUNDS ? 'Duel final' : `Cercle ${saved.round + 1}/${ROUNDS}`;
      txt(this, W / 2, y + 112, `${where} · ${saved.credits} crédits`, 20, C.quiet).setOrigin(0.5);
      y += 140;
    }
    this.enter(button(this, bx, y, BW, saved ? 84 : 100, 'Nouvelle partie', () => {
      clearRun();
      this.registry.remove('run');
      this.scene.start('operator');
    }, { primary: !saved, size: saved ? 26 : 30, icon: saved ? 'ic-compass' : 'ic-play' }).root, 1);
    y += saved ? 98 : 120;
    this.enter(button(this, bx, y, BW, saved ? 70 : 76, 'Paramètres', () => openSettings(this), { size: 22, icon: 'ic-menu' }).root, 2);

    // Plaque de version, au pochoir.
    const v = plate(this, W / 2, H - 34, 'Prototype · saison 0', P.braise, 15).setAlpha(0.85);
    this.enter(v, 3);
  }

  /** Entrée en cascade d'un bouton : glisse depuis le bas et apparaît. */
  private enter(o: Phaser.GameObjects.Container, i: number) {
    const y = o.y;
    const a = o.alpha;
    o.setY(y + 40).setAlpha(0);
    this.tweens.add({ targets: o, y, alpha: a, duration: 420, delay: 380 + i * 110, ease: 'Back.easeOut' });
  }

  /** Fond façon carte d'état-major : courbes de niveau très discrètes sous l'illustration. */
  private topoLines() {
    const g = this.add.graphics();
    const rng = new Phaser.Math.RandomDataGenerator(['hotdrop-topo']);
    for (let k = 0; k < 9; k++) {
      const cx = rng.between(-100, W + 100);
      const cy = rng.between(820, H + 60);
      for (let r = 30; r < 260; r += 26) {
        g.lineStyle(2, P.trait, 0.35 - r / 900);
        g.beginPath();
        for (let a = 0; a <= 64; a++) {
          const t = (a / 64) * Math.PI * 2;
          const wob = 1 + 0.12 * Math.sin(t * 3 + k) + 0.07 * Math.sin(t * 5 + r);
          const x = cx + Math.cos(t) * r * 1.4 * wob;
          const y = cy + Math.sin(t) * r * 0.8 * wob;
          if (a === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.strokePath();
      }
    }
    // Repères de quadrillage
    g.lineStyle(1, P.trait, 0.25);
    for (let x = 0; x <= W; x += 120) g.lineBetween(x, 760, x, H);
    for (let y = 760; y <= H; y += 120) g.lineBetween(0, y, W, y);
  }

  /** Nuage sombre et allongé qui traverse le ciel lentement, puis recommence. */
  private cloud(i: number) {
    const y = 60 + i * 70 + Phaser.Math.Between(-20, 20);
    const w = Phaser.Math.Between(220, 360);
    const g = this.add.graphics();
    g.fillStyle(i % 2 ? P.prune : P.violetSombre, 0.35);
    for (let k = 0; k < 4; k++) g.fillEllipse(k * (w / 4), Phaser.Math.Between(-6, 6), w / 2, 26 + k * 3);
    const dir = i % 2 ? 1 : -1;
    const x0 = dir > 0 ? -w : W + w;
    g.setPosition(Phaser.Math.Between(0, W), y);
    const run = (from: number) => {
      g.x = from;
      this.tweens.add({ targets: g, x: dir > 0 ? W + w : -w, duration: Phaser.Math.Between(60000, 95000) * (Math.abs((dir > 0 ? W + w : -w) - from) / (W + 2 * w)), onComplete: () => run(x0) });
    };
    run(g.x);
  }

  /** Éclat en étoile à quatre branches qui grossit et disparaît. */
  private glint(x: number, y: number) {
    const g = this.add.graphics({ x, y }).setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
    g.fillStyle(P.blanc, 0.9);
    g.fillTriangle(-2, 0, 2, 0, 0, -22);
    g.fillTriangle(-2, 0, 2, 0, 0, 22);
    g.fillTriangle(0, -2, 0, 2, -22, 0);
    g.fillTriangle(0, -2, 0, 2, 22, 0);
    g.fillCircle(0, 0, 4);
    g.setScale(0).setAngle(0);
    this.tweens.add({ targets: g, scale: 1, angle: 45, duration: 260, yoyo: true, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
  }

  /** Une braise : monte en dérivant depuis les toits, puis renaît. */
  private ember(first = false) {
    const x = Phaser.Math.Between(0, W);
    const y0 = first ? Phaser.Math.Between(300, 760) : Phaser.Math.Between(640, 780);
    const s = Phaser.Math.Between(2, 4);
    const e = this.add.rectangle(x, y0, s, s, Phaser.Math.RND.pick([0xe8894a, 0xf4b06a, 0xe8894a])).setBlendMode(Phaser.BlendModes.ADD);
    e.setAlpha(0);
    this.tweens.add({
      targets: e,
      y: y0 - Phaser.Math.Between(220, 420),
      x: x + Phaser.Math.Between(-60, 60),
      alpha: { from: 0.9, to: 0 },
      duration: Phaser.Math.Between(3500, 7000),
      delay: first ? Phaser.Math.Between(0, 4000) : 0,
      onComplete: () => {
        e.destroy();
        this.ember();
      },
    });
  }
}
