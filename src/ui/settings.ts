// Écran des paramètres : réglages du joueur gardés d'une partie à l'autre (logic/settings.ts).
import Phaser from 'phaser';
import { C, W } from '../config';
import { SPEEDS, getSettings, setSettings } from '../logic/settings';
import { button, modalBase, panel, txt, vibrate } from './widgets';
import { sfx } from '../audio/sfx';

/** Ouvre les paramètres par-dessus la scène ; chaque choix est enregistré tout de suite. */
export function openSettings(scene: Phaser.Scene, onClose?: () => void): void {
  const top = 300;
  const PH = 790;
  let root: Phaser.GameObjects.Container | null = null;
  const close = () => {
    root?.destroy();
    root = null;
    onClose?.();
  };
  const draw = () => {
    root?.destroy();
    const m = modalBase(scene, close);
    root = m;
    const s = getSettings();
    m.add(panel(scene, 40, top, W - 80, PH));
    m.add(txt(scene, 72, top + 30, 'PARAMÈTRES', 38, C.accentStr, { fontStyle: 'bold' }));

    // Vitesse des combats
    let y = top + 120;
    m.add(txt(scene, 72, y, 'Vitesse des combats', 26, C.text, { fontStyle: 'bold' }));
    m.add(txt(scene, 72, y + 36, 'Gardée d’une partie à l’autre ; le bouton ×1 du combat la change aussi.', 18, C.quiet, { wordWrap: { width: W - 150 } }));
    const bw = (W - 144 - 2 * 16) / SPEEDS.length;
    SPEEDS.forEach((sp, i) => {
      const b = button(scene, 72 + i * (bw + 16), y + 90, bw, 84, `×${sp}`, () => {
        setSettings({ speed: sp });
        draw();
      }, { primary: s.speed === sp, size: 30 });
      m.add(b.root);
    });

    // Vibrations
    y += 230;
    m.add(txt(scene, 72, y, 'Vibrations', 26, C.text, { fontStyle: 'bold' }));
    const vb = button(scene, 72, y + 50, W - 144, 84, s.vibration ? 'Activées' : 'Désactivées', () => {
      setSettings({ vibration: !getSettings().vibration });
      vibrate(30);
      draw();
    }, { primary: s.vibration, size: 28 });
    m.add(vb.root);

    // Son
    y += 150;
    m.add(txt(scene, 72, y, 'Son', 26, C.text, { fontStyle: 'bold' }));
    const sb = button(scene, 72, y + 50, W - 144, 84, s.sound ? 'Activé' : 'Coupé', () => {
      setSettings({ sound: !getSettings().sound });
      sfx('coin');
      draw();
    }, { primary: s.sound, size: 28 });
    m.add(sb.root);

    const ok = button(scene, 72, top + PH - 120, W - 144, 90, 'Fermer', close, { size: 28 });
    m.add(ok.root);
  };
  draw();
}
