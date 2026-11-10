import Phaser from 'phaser';
import { C, FONT, W } from '../config';
import { ROUNDS } from '../logic/zone';
import { clearRun, loadRun } from '../logic/run';
import { button, fadeIn, txt } from '../ui/widgets';
import { ART } from '../art';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create() {
    fadeIn(this);
    const g = this.add.graphics();
    g.lineStyle(1, C.cellLine, 0.5);
    for (let x = 0; x < W; x += 46) g.lineBetween(x, 0, x, 1280);
    for (let y = 0; y < 1280; y += 46) g.lineBetween(0, y, W, y);

    // Bandeau illustré : décor du Port au crépuscule, opérateur en premier plan, fondu vers le fond.
    const hero = this.add.image(W / 2, 0, 'bg-port').setOrigin(0.5, 0);
    hero.setScale(560 / hero.height);
    const op = ART.figures['op-stand'];
    this.add.image(W / 2 + 170, 520, 'fig-op-stand').setOrigin(op.ax, op.ay).setScale(3.4 / 3);
    const fade = this.add.graphics();
    for (let i = 0; i < 24; i++) {
      fade.fillStyle(C.bg, i / 24);
      fade.fillRect(0, 330 + i * 10, W, 10);
    }
    fade.fillStyle(C.bg, 1);
    fade.fillRect(0, 570, W, 720);
    this.add.text(56, 560, 'HOT DROP', { fontFamily: FONT, fontSize: '128px', fontStyle: 'bold italic', color: C.accentStr, resolution: 2, stroke: '#000000', strokeThickness: 10, padding: { left: 8, right: 40, top: 8, bottom: 4 } }).setOrigin(0, 1);
    txt(this, 62, 572, 'RÉGION DE VESTRA · PROTOTYPE', 24, C.quiet, { fontStyle: 'bold' });
    txt(this, 62, 612, 'Range ton sac. Chaque case compte.', 28);

    const saved = loadRun();
    let y = 700;
    if (saved) {
      button(this, 160, y, 400, 96, 'Continuer', () => {
        this.registry.set('run', saved);
        this.scene.start('map');
      }, { primary: true });
      const where = saved.round >= ROUNDS ? 'Duel final' : `Cercle ${saved.round + 1}/${ROUNDS}`;
      txt(this, W / 2, y + 108, `${where} · ${saved.credits} crédits`, 20, C.quiet).setOrigin(0.5);
      y += 150;
    }
    button(this, 160, y, 400, 96, 'Nouvelle run', () => {
      clearRun();
      this.registry.remove('run');
      this.scene.start('operator');
    }, { primary: !saved });

    const help = [
      `${ROUNDS} cercles de gaz, puis le duel Top 1`,
      'Largue-toi dans une zone, joue 3 cartes',
      'Chaque combat : ton sac contre le sien',
      'Les objets voisins créent des synergies',
    ];
    help.forEach((s, i) => txt(this, W / 2, 990 + i * 42, s, 24, C.quiet).setOrigin(0.5));
  }
}
