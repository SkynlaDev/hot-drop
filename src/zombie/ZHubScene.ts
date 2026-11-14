// Mode Zombie : QG (hors partie). Trois emplacements de classe, records, objectifs, accès à l'arsenal.
import Phaser from 'phaser';
import { C, H, TITLE_FONT, W } from '../config';
import { P, hex } from '../ui/palette';
import { button, fadeIn, modalBase, panel, plate, txt } from '../ui/widgets';
import { iconButton } from '../ui/hud';
import { pxFigure } from '../art';
import { GOALS, PERKS, WEAPONS } from './data';
import { CLASS_SLOTS, ZSave, loadSave, storeSave, weaponLevel, weaponProgress } from './progress';
import { GROUND, Z_ART, makeZombieTextures, preloadZombieArt } from './assets';
import { drawBar, fitImage, fmtTime } from './ui';

/** Décor commun des écrans du mode : asphalte assombri, horde en silhouette à l'horizon, lueur du couchant. */
export function zBackdrop(scene: Phaser.Scene, hordeY = 250) {
  scene.add.rectangle(0, 0, W, H, P.fond).setOrigin(0);
  scene.add.tileSprite(0, 0, W, H, GROUND).setOrigin(0).setTileScale(2).setAlpha(0.35);
  const glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 8; i > 0; i--) {
    glow.fillStyle(P.braise, 0.04);
    glow.fillEllipse(W / 2, hordeY - 20, 300 + i * 70, 120 + i * 30);
  }
  scene.tweens.add({ targets: glow, alpha: 0.5, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  // Horde : silhouettes sombres qui avancent très lentement.
  const keys = Object.keys(Z_ART).filter((k) => k !== 'z-boss');
  const rnd = new Phaser.Math.RandomDataGenerator(['horde']);
  for (let i = 0; i < 16; i++) {
    const key = rnd.pick(keys);
    const a = Z_ART[key];
    const x = (i / 15) * (W + 80) - 40 + rnd.between(-20, 20);
    const y = hordeY + rnd.between(-14, 30);
    const z = scene.add.image(x, y, key).setOrigin(a.feetX / a.size, a.feetY / a.size).setScale(1.1 + (y - hordeY) / 120).setTint(0x221a26).setFlipX(x > W / 2);
    scene.tweens.add({ targets: z, y: y - 3, scaleX: z.scaleX * 1.04, duration: rnd.between(500, 800), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  const fade = scene.add.graphics();
  for (let i = 0; i < 20; i++) {
    fade.fillStyle(P.fond, (i / 20) * 0.95);
    fade.fillRect(0, hordeY + 10 + i * 6, W, 6);
  }
  fade.fillStyle(P.fond, 0.95);
  fade.fillRect(0, hordeY + 130, W, H);
}

/** Titre du mode en haut d'écran. */
export function zTitle(scene: Phaser.Scene, sub: string, y = 92) {
  txt(scene, W / 2, y, 'MODE ZOMBIE', 64, hex(P.gaz), { fontFamily: TITLE_FONT, stroke: '#0f0d13', strokeThickness: 10 }).setOrigin(0.5);
  plate(scene, W / 2, y + 66, sub, P.braise, 18);
}

export default class ZHubScene extends Phaser.Scene {
  private save!: ZSave;

  constructor() {
    super('zhub');
  }

  preload() {
    preloadZombieArt(this.load);
  }

  create() {
    makeZombieTextures(this);
    this.save = loadSave();
    if (!this.save.classes[this.save.selected]) this.save.selected = this.save.classes.findIndex((c) => c) ;
    if (this.save.selected < 0) this.save.selected = 0;
    zBackdrop(this, 300);
    zTitle(this, 'Survie · 10 minutes');
    iconButton(this, 52, 52, 'ic-close', () => this.scene.start('menu'), 28);

    plate(this, W / 2, 352, 'Tes classes', P.orange, 20);
    for (let i = 0; i < CLASS_SLOTS; i++) this.classCard(i, 40, 392 + i * 178);

    const r = this.save.records;
    const rec = r.runs
      ? `Record ${fmtTime(r.bestTime)} · ${r.bestKills} zombies · niv. ${r.bestLevel} · ${r.wins} extraction${r.wins > 1 ? 's' : ''}`
      : 'Aucune partie jouée : tiens dix minutes face à la horde.';
    const title = this.save.goals.includes('endless15') ? 'Increvable · ' : '';
    txt(this, W / 2, 940, title + rec, 21, title ? hex(P.or) : C.quiet).setOrigin(0.5);

    const sel = this.save.classes[this.save.selected];
    const deploy = button(this, 40, 980, W - 80, 104, 'Déployer', () => {
      storeSave(this.save);
      this.scene.start('zgame', { slot: this.save.selected });
    }, { primary: true, icon: 'ic-play', size: 34 });
    deploy.setEnabled(!!sel);
    const half = (W - 80 - 16) / 2;
    button(this, 40, 1100, half, 84, 'Arsenal', () => {
      storeSave(this.save);
      this.scene.start('zarsenal', { weapon: sel?.weapon });
    }, { icon: 'ic-rifle', size: 26 });
    const done = this.save.goals.length;
    button(this, 40 + half + 16, 1100, half, 84, `Objectifs ${done}/${GOALS.length}`, () => this.openGoals(), { icon: 'ic-check', size: 24 });
    fadeIn(this);
  }

  private classCard(i: number, x: number, y: number) {
    const c = this.save.classes[i];
    const w = W - 80;
    const h = 160;
    const selected = i === this.save.selected && !!c;
    const root = this.add.container(x, y);
    root.add(panel(this, 0, 0, w, h, selected ? P.orange : P.trait2));
    if (!c) {
      root.add(txt(this, w / 2, h / 2 - 14, '+  CRÉER UNE CLASSE', 30, C.quiet, { fontFamily: TITLE_FONT }).setOrigin(0.5));
      root.add(txt(this, w / 2, h / 2 + 26, `Emplacement ${i + 1}`, 20, hex(P.muet)).setOrigin(0.5));
      const z = this.add.zone(w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => this.scene.start('zclass', { slot: i }));
      root.add(z);
      return;
    }
    const g = this.add.graphics();
    g.fillStyle(P.nuit, 1);
    g.fillRect(16, 14, 132, 132);
    g.lineStyle(2, selected ? P.orange : P.trait, 1);
    g.strokeRect(16, 14, 132, 132);
    root.add(g);
    root.add(pxFigure(this, 82, 146, c.fig, 2));
    root.add(txt(this, 168, 16, c.name.toUpperCase(), 32, selected ? C.accentStr : C.text, { fontFamily: TITLE_FONT }));
    const wp = weaponProgress(this.save, c.weapon);
    const wl = weaponLevel(wp.xp);
    g.fillStyle(P.muet, 1);
    g.fillRoundedRect(168, 64, 120, 58, 6);
    root.add(fitImage(this, `it-${c.weapon}`, 228, 93, 110, undefined, 50));
    root.add(txt(this, 300, 66, WEAPONS[c.weapon].name, 21, C.text));
    root.add(txt(this, 300, 94, `Arme niv. ${wl.level}`, 18, hex(P.or)));
    drawBar(g, 300, 122, 180, 8, wl.need ? wl.into / wl.need : 1, P.or);
    root.add(fitImage(this, `it-${PERKS[c.perk].icon}`, 524, 104, 44));
    root.add(txt(this, 524, 136, PERKS[c.perk].name, 17, C.quiet).setOrigin(0.5, 0.5));
    if (selected) {
      const tag = txt(this, w - 18, 20, 'SÉLECTIONNÉE', 16, C.accentStr, { fontFamily: TITLE_FONT }).setOrigin(1, 0);
      root.add(tag);
    }
    const z = this.add.zone(w / 2 - 50, h / 2, w - 100, h).setInteractive({ useHandCursor: true });
    z.on('pointerup', () => {
      if (this.save.selected === i) return;
      this.save.selected = i;
      storeSave(this.save);
      this.scene.restart();
    });
    root.add(z);
    const edit = iconButton(this, w - 48, h - 46, 'ic-menu', () => this.scene.start('zclass', { slot: i }), 26);
    root.add(edit);
  }

  private openGoals() {
    const root = modalBase(this, () => root.destroy());
    root.add(plate(this, W / 2, 220, 'Objectifs', P.or, 30));
    const r = this.save.records;
    GOALS.forEach((g, i) => {
      const y = 290 + i * 120;
      const done = this.save.goals.includes(g.id);
      root.add(panel(this, 40, y, W - 80, 104, done ? P.soin : P.trait2));
      const ic = this.add.image(90, y + 52, done ? 'ic-check' : 'ic-lock').setTint(done ? P.soin : P.muet);
      ic.setScale(36 / Math.max(ic.width, ic.height));
      root.add(ic);
      root.add(txt(this, 130, y + 18, g.name, 24, done ? C.goodStr : C.text, { fontStyle: 'bold' }));
      root.add(txt(this, 130, y + 56, `Récompense : ${g.rewardText}`, 20, C.quiet));
    });
    const y = 290 + GOALS.length * 120 + 10;
    root.add(txt(this, W / 2, y, `${r.totalKills} zombies abattus · ${r.runs} partie${r.runs > 1 ? 's' : ''} · ${r.bossKills} Colosse${r.bossKills > 1 ? 's' : ''}`, 20, C.quiet).setOrigin(0.5, 0));
    root.add(button(this, W / 2 - 160, y + 50, 320, 80, 'Fermer', () => root.destroy(), { size: 24 }).root);
  }
}
