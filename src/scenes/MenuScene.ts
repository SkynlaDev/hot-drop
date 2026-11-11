import Phaser from 'phaser';
import { C, W } from '../config';
import { ROUNDS } from '../logic/zone';
import { clearRun, loadRun } from '../logic/run';
import { button, fadeIn, txt } from '../ui/widgets';
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

    // Illustration : parachutiste au-dessus de la ville, cercle de gaz à l'horizon. Lente respiration.
    const art = this.add.image(W / 2, ART_H / 2, MENU_ART).setScale(2);
    this.tweens.add({ targets: art, scale: 2.035, y: ART_H / 2 - 6, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Lueur du cercle de gaz (à gauche de l'horizon) qui pulse.
    const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 6; i > 0; i--) {
      glow.fillStyle(0xff5a1a, 0.035);
      glow.fillCircle(150, 300, 70 + i * 26);
    }
    this.tweens.add({ targets: glow, alpha: 0.35, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

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

    const BW = 440;
    const bx = (W - BW) / 2;
    let y = saved ? 912 : 975;
    if (saved) {
      button(this, bx, y, BW, 96, 'Continuer', () => {
        this.registry.set('run', saved);
        this.scene.start('map');
      }, { primary: true });
      const where = saved.round >= ROUNDS ? 'Duel final' : `Cercle ${saved.round + 1}/${ROUNDS}`;
      txt(this, W / 2, y + 112, `${where} · ${saved.credits} crédits`, 20, C.quiet).setOrigin(0.5);
      y += 140;
    }
    button(this, bx, y, BW, saved ? 84 : 100, 'Nouvelle partie', () => {
      clearRun();
      this.registry.remove('run');
      this.scene.start('operator');
    }, { primary: !saved, size: saved ? 26 : 30 });
    y += saved ? 98 : 120;
    button(this, bx, y, BW, saved ? 70 : 76, 'Paramètres', () => openSettings(this), { size: 22 });

    txt(this, W / 2, H - 22, 'PROTOTYPE', 16, C.quiet, { fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0.6);
  }

  /** Une braise : monte en dérivant depuis les toits, puis renaît. */
  private ember(first = false) {
    const x = Phaser.Math.Between(0, W);
    const y0 = first ? Phaser.Math.Between(300, 760) : Phaser.Math.Between(640, 780);
    const s = Phaser.Math.Between(2, 4);
    const e = this.add.rectangle(x, y0, s, s, Phaser.Math.RND.pick([0xff8c1a, 0xffb347, 0xff5a1a])).setBlendMode(Phaser.BlendModes.ADD);
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
