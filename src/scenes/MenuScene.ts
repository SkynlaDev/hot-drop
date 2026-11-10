import Phaser from 'phaser';
import { C, FONT, W } from '../config';
import { clearRun, loadRun, newRun, saveRun } from '../logic/run';
import { button, fadeIn, txt } from '../ui/widgets';

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

    this.add.text(W / 2, 300, 'HOT DROP', { fontFamily: FONT, fontSize: '104px', fontStyle: 'bold', color: C.accentStr, resolution: 2 }).setOrigin(0.5);
    txt(this, W / 2, 380, 'Zone de Vestra · prototype', 28, C.quiet).setOrigin(0.5);
    txt(this, W / 2, 470, 'Range ton gilet. Chaque case compte.', 30).setOrigin(0.5);

    const saved = loadRun();
    let y = 620;
    if (saved) {
      button(this, 160, y, 400, 96, 'Continuer la run', () => {
        this.registry.set('run', saved);
        this.scene.start('map');
      }, { primary: true }).root;
      y += 124;
    }
    button(this, 160, y, 400, 96, 'Nouvelle run', () => {
      clearRun();
      const run = newRun();
      saveRun(run);
      this.registry.set('run', run);
      this.scene.start('map');
    }, { primary: !saved });

    const help = [
      'Glisser : placer un objet dans le gilet',
      'Tap : tourner · Appui long : fiche',
      'Touche R : tourner pendant le glisser',
      'Les objets voisins créent des synergies',
    ];
    help.forEach((s, i) => txt(this, W / 2, 940 + i * 42, s, 24, C.quiet).setOrigin(0.5));
  }
}
