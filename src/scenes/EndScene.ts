import Phaser from 'phaser';
import { C, FONT, W } from '../config';
import { RunState, clearRun, newRun, saveRun } from '../logic/run';
import { button, fadeIn, txt } from '../ui/widgets';
import { ART } from '../art';

export default class EndScene extends Phaser.Scene {
  constructor() {
    super('end');
  }

  create() {
    fadeIn(this);
    const run = this.registry.get('run') as RunState;
    const win = run.over === 'win';
    clearRun();
    // Décor de la dernière zone, assombri ; l'opérateur debout s'il s'est extrait.
    const biome = run.zone?.biome ?? run.done[run.done.length - 1] ?? 'port';
    const hero = this.add.image(W / 2, 0, `bg-${biome}`).setOrigin(0.5, 0);
    hero.setScale(620 / hero.height).setTint(win ? 0xffffff : 0x8a6a6a);
    if (win) {
      const op = ART.figures['op-stand'];
      this.add.image(W / 2, 600, 'fig-op-stand').setOrigin(op.ax, op.ay).setScale(3.2 / 3);
    }
    const fade = this.add.graphics();
    for (let i = 0; i < 24; i++) {
      fade.fillStyle(C.bg, (i / 24) * 0.95);
      fade.fillRect(0, 380 + i * 10, W, 10);
    }
    fade.fillStyle(C.bg, 1);
    fade.fillRect(0, 620, W, 700);
    this.add
      .text(W / 2, 690, win ? 'EXTRACTION\nRÉUSSIE' : 'OPÉRATEUR\nTOMBÉ', {
        fontFamily: FONT,
        fontSize: '88px',
        fontStyle: 'bold italic',
        stroke: '#000000',
        strokeThickness: 10,
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
    lines.forEach((s, i) => txt(this, W / 2, 880 + i * 42, s, 26, C.quiet).setOrigin(0.5));
    button(this, 160, 1000, 400, 96, 'Nouvelle run', () => {
      const r = newRun();
      saveRun(r);
      this.registry.set('run', r);
      this.scene.start('briefing');
    }, { primary: true });
    button(this, 160, 1120, 400, 84, 'Menu', () => this.scene.start('menu'));
  }
}
