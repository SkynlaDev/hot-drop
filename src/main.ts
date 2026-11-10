import Phaser from 'phaser';
import { C, H, W } from './config';
import BriefingScene from './scenes/BriefingScene';
import EndScene from './scenes/EndScene';
import LoadoutScene from './scenes/LoadoutScene';
import MapScene from './scenes/MapScene';
import MenuScene from './scenes/MenuScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: C.bg,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 1 },
  scene: [MenuScene, BriefingScene, MapScene, LoadoutScene, EndScene],
});

// Accès de débogage depuis la console.
(window as unknown as { game: Phaser.Game }).game = game;
