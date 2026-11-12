import Phaser from 'phaser';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/700.css';
import '@fontsource/black-ops-one/400.css';
import { C, H, W } from './config';
import BootScene from './scenes/BootScene';
import EndScene from './scenes/EndScene';
import LoadoutScene from './scenes/LoadoutScene';
import MapScene from './scenes/MapScene';
import MenuScene from './scenes/MenuScene';
import OperatorScene from './scenes/OperatorScene';
import ZoneScene from './scenes/ZoneScene';
import { initSfx } from './audio/sfx';

async function start() {
  initSfx();
  // Les textes Phaser sont rendus une seule fois : la police doit être prête avant.
  await Promise.all([document.fonts.load('500 20px Oswald'), document.fonts.load('700 20px Oswald'), document.fonts.load('400 20px "Black Ops One"')]).catch(() => undefined);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: C.bg,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 1 },
    scene: [BootScene, MenuScene, OperatorScene, MapScene, ZoneScene, LoadoutScene, EndScene],
  });
  // Accès de débogage depuis la console.
  (window as unknown as { game: Phaser.Game }).game = game;
}

void start();
