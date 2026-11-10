import Phaser from 'phaser';
import { C, W, H } from '../config';
import { preloadArt } from '../art';

/** Charge les images avant le menu, avec une barre de progression. */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    const g = this.add.graphics();
    this.load.on('progress', (p: number) => {
      g.clear();
      g.fillStyle(C.cell, 1);
      g.fillRoundedRect(W / 2 - 200, H / 2 - 8, 400, 16, 8);
      g.fillStyle(C.accent, 1);
      g.fillRoundedRect(W / 2 - 200, H / 2 - 8, 400 * p, 16, 8);
    });
    preloadArt(this.load);
  }

  create() {
    this.scene.start('menu');
  }
}
