// Fin de run : Top 1 (duel final gagné) ou élimination.
import Phaser from 'phaser';
import { C, FONT, W } from '../config';
import { OPERATORS } from '../data/operators';
import { RunState, clearRun } from '../logic/run';
import { ROUNDS } from '../logic/zone';
import { button, fadeIn, txt } from '../ui/widgets';
import { ART } from '../art';

export default class EndScene extends Phaser.Scene {
  constructor() {
    super('end');
  }

  create() {
    fadeIn(this);
    const run = this.registry.get('run') as RunState | undefined;
    if (!run) {
      this.scene.start('menu');
      return;
    }
    const win = run.over === 'win';
    clearRun();
    this.registry.remove('mapSeen');
    this.registry.remove('zoneSeen');

    const hero = this.add.image(W / 2, 0, win ? 'bg-port' : 'bg-industrie').setOrigin(0.5, 0);
    hero.setScale(620 / hero.height).setTint(win ? 0xffffff : 0x8a6a6a);
    const op = ART.figures['op-stand'];
    const fig = this.add.image(W / 2, 600, win ? 'fig-op-stand' : 'fig-op-kneel').setOrigin(op.ax, op.ay).setScale(3.2 / 3);
    if (!win) fig.setTint(0x6a5a5a);
    const fade = this.add.graphics();
    for (let i = 0; i < 24; i++) {
      fade.fillStyle(C.bg, (i / 24) * 0.95);
      fade.fillRect(0, 380 + i * 10, W, 10);
    }
    fade.fillStyle(C.bg, 1);
    fade.fillRect(0, 620, W, 700);

    const title = this.add
      .text(W / 2, 680, win ? 'TOP 1' : 'ÉLIMINÉ', {
        fontFamily: FONT,
        fontSize: win ? '150px' : '110px',
        fontStyle: 'bold italic',
        stroke: '#000000',
        strokeThickness: 12,
        padding: { left: 40, right: 40, top: 10, bottom: 4 },
        color: win ? C.accentStr : C.dangerStr,
        resolution: 2,
      })
      .setOrigin(0.5)
      .setScale(2.2)
      .setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 380, delay: 150, ease: 'Back.Out', onComplete: () => this.cameras.main.shake(160, 0.006) });
    txt(this, W / 2, 790, win ? 'Dernier debout. La zone est à toi.' : 'Le gaz se referme sans toi.', 28, C.text).setOrigin(0.5);

    // Cercles survécus : la manche atteinte (le duel final compte comme le dernier palier).
    const reached = win ? ROUNDS : Math.min(run.round, ROUNDS);
    const lines: [string, string][] = [
      ['Opérateur', OPERATORS[run.operator].name],
      ['Cercles survécus', `${reached}/${ROUNDS}${run.round >= ROUNDS && !win ? ' · tombé au Top 1' : ''}`],
      ['Goulag', run.goulagUsed ? 'utilisé' : 'pas utilisé'],
      ['Objets dans le sac', `${run.items.filter((i) => i.placed).length}`],
      ['Crédits', `${run.credits}`],
    ];
    lines.forEach(([k, v], i) => {
      const y = 850 + i * 40;
      const a = txt(this, 150, y, k, 24, C.quiet).setOrigin(0, 0.5).setAlpha(0);
      const b = txt(this, W - 150, y, v, 24, C.text, { fontStyle: 'bold' }).setOrigin(1, 0.5).setAlpha(0);
      this.tweens.add({ targets: [a, b], alpha: 1, x: '+=0', duration: 220, delay: 500 + i * 90 });
    });
    button(this, 120, 1068, 480, 100, 'Nouvelle run', () => this.scene.start('operator'), { primary: true, size: 30 });
    button(this, 220, 1180, 280, 80, 'Menu', () => this.scene.start('menu'), { size: 24 });
  }
}
