import Phaser from 'phaser';
import { C, FONT, W } from '../config';
import { RunState, clearRun, newRun, saveRun } from '../logic/run';
import { button, fadeIn, txt } from '../ui/widgets';

export default class EndScene extends Phaser.Scene {
  constructor() {
    super('end');
  }

  create() {
    fadeIn(this);
    const run = this.registry.get('run') as RunState;
    const win = run.over === 'win';
    clearRun();
    this.add
      .text(W / 2, 360, win ? 'EXTRACTION\nRÉUSSIE' : 'OPÉRATEUR\nTOMBÉ', {
        fontFamily: FONT,
        fontSize: '80px',
        fontStyle: 'bold',
        align: 'center',
        color: win ? C.goodStr : C.dangerStr,
        resolution: 2,
      })
      .setOrigin(0.5);
    const lines = [
      `Lieux visités : ${run.placesTotal} · zones terminées : ${run.done.length}/3${win ? ' · extraction réussie' : ''}`,
      `Objets dans le gilet : ${run.items.filter((i) => i.placed).length}`,
      `Crédits restants : ${run.credits}`,
    ];
    lines.forEach((s, i) => txt(this, W / 2, 560 + i * 50, s, 30, C.quiet).setOrigin(0.5));
    button(this, 160, 820, 400, 96, 'Nouvelle run', () => {
      const r = newRun();
      saveRun(r);
      this.registry.set('run', r);
      this.scene.start('briefing');
    }, { primary: true });
    button(this, 160, 944, 400, 84, 'Menu', () => this.scene.start('menu'));
  }
}
