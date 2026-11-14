// Mode Zombie : rapport de fin de partie. Temps, kills, niveau, XP gagnée par l'arme, déblocages, records.
import Phaser from 'phaser';
import { C, TITLE_FONT, W } from '../config';
import { P, hex } from '../ui/palette';
import { button, fadeIn, panel, plate, txt } from '../ui/widgets';
import { sfx } from '../audio/sfx';
import { pxFigure } from '../art';
import { ACCESSORIES, GOALS, WEAPONS, ZOMBIES, ZType } from './data';
import { RunReport, RunResult, ZClass, totalKills, weaponLevel } from './progress';
import { makeZombieTextures, preloadZombieArt } from './assets';
import { drawBar, fitImage, fmtTime } from './ui';
import { zBackdrop } from './ZHubScene';

interface EndData {
  result: RunResult;
  report: RunReport;
  cls: ZClass;
  extracted: boolean;
  dead: boolean;
  slot: number;
}

export default class ZEndScene extends Phaser.Scene {
  constructor() {
    super('zend');
  }

  preload() {
    preloadZombieArt(this.load);
  }

  create() {
    makeZombieTextures(this);
    const d = this.registry.get('zEnd') as EndData | undefined;
    if (!d) {
      this.scene.start('zhub');
      return;
    }
    const { result: r, report: rep, cls } = d;
    const win = r.won;
    zBackdrop(this, 330);
    const fig = pxFigure(this, W / 2, 330, cls.fig, 3.2);
    // Tombé : silhouette grise, affaissée.
    if (!win && d.dead) fig.setTint(0x6b6370).setAlpha(0.8).setScale(3.2 * 1.1, 3.2 * 0.6);
    const title = txt(this, W / 2, 400, win ? 'EXTRACTION RÉUSSIE' : d.dead ? 'TOMBÉ AU COMBAT' : 'REPLI', win ? 56 : 60, win ? hex(P.gaz) : d.dead ? C.dangerStr : C.accentStr, {
      fontFamily: TITLE_FONT, stroke: '#000000', strokeThickness: 10, padding: { x: 20, y: 6 },
    }).setOrigin(0.5).setScale(2).setAlpha(0);
    if (title.width > W - 40) title.setData('fit', (W - 40) / title.width);
    const fit = (title.getData('fit') as number | undefined) ?? 1;
    this.tweens.add({ targets: title, scale: fit, alpha: 1, duration: 380, delay: 150, ease: 'Back.Out', onComplete: () => {
      this.cameras.main.shake(140, 0.005);
      sfx(win ? 'win' : 'lose', { vary: 0 });
    } });
    const sub = win
      ? r.time > 600 ? `Tenu ${fmtTime(r.time)}, dont ${fmtTime(r.time - 600)} en sans fin.` : 'Dix minutes. L’hélico décolle sous les griffes.'
      : d.dead ? `${cls.name} est tombé après ${fmtTime(r.time)}.` : `${cls.name} a décroché après ${fmtTime(r.time)}.`;
    txt(this, W / 2, 470, sub, 24, C.text).setOrigin(0.5);

    // Chiffres
    panel(this, 40, 510, W - 80, 170, P.trait2);
    const kills = totalKills(r);
    const cell = (i: number, label: string, value: string, rec: boolean) => {
      const x = 40 + (W - 80) * ((i + 0.5) / 3);
      txt(this, x, 534, label.toUpperCase(), 17, C.quiet, { fontFamily: TITLE_FONT }).setOrigin(0.5, 0);
      txt(this, x, 566, value, 46, C.text, { fontFamily: TITLE_FONT }).setOrigin(0.5, 0);
      if (rec) {
        const p = plate(this, x, 648, 'Record', P.or, 13);
        this.tweens.add({ targets: p, scale: 1.08, yoyo: true, repeat: -1, duration: 500 });
      }
    };
    cell(0, 'Temps', fmtTime(r.time), rep.records.includes('time'));
    cell(1, 'Zombies', `${kills}`, rep.records.includes('kills'));
    cell(2, 'Niveau', `${r.level}`, rep.records.includes('level'));
    const detail = (Object.keys(r.kills) as ZType[]).filter((t) => (r.kills[t] ?? 0) > 0).map((t) => `${r.kills[t]} ${ZOMBIES[t].name.toLowerCase()}${(r.kills[t] ?? 0) > 1 && t !== 'boss' ? 's' : ''}`).join(' · ');
    txt(this, W / 2, 694, `${detail}${r.elites ? ` · dont ${r.elites} élite${r.elites > 1 ? 's' : ''}` : ''}`, 17, hex(P.muet), { align: 'center', wordWrap: { width: W - 60 } }).setOrigin(0.5, 0);

    // XP d'arme
    panel(this, 40, 740, W - 80, 170, P.or);
    fitImage(this, `it-${r.weapon}`, 140, 812, 170);
    txt(this, 250, 760, WEAPONS[r.weapon].name.toUpperCase(), 22, C.text, { fontFamily: TITLE_FONT });
    const xpT = txt(this, 250, 794, `+0 XP d'arme`, 30, hex(P.or), { fontFamily: TITLE_FONT });
    const lvT = txt(this, W - 64, 760, `NIV. ${rep.levelBefore}`, 24, hex(P.or), { fontFamily: TITLE_FONT }).setOrigin(1, 0);
    const bar = this.add.graphics();
    // Animation : la barre se remplit, niveau après niveau.
    const st = { v: 0 };
    const draw = () => {
      const gained = Math.round(st.v);
      xpT.setText(`+${gained} XP d'arme`);
      const wl = weaponLevel(rep.xpBefore + gained);
      const lvl = wl.level;
      lvT.setText(lvl > rep.levelBefore ? `NIV. ${rep.levelBefore} → ${lvl}` : `NIV. ${lvl}`);
      bar.clear();
      drawBar(bar, 250, 850, W - 314, 16, wl.need ? wl.into / wl.need : 1, P.or);
    };
    draw();
    this.tweens.add({ targets: st, v: rep.weaponXp, duration: 1400, delay: 600, ease: 'Cubic.Out', onUpdate: draw, onComplete: () => {
      draw();
      if (rep.levelAfter > rep.levelBefore) {
        sfx('craft');
        this.cameras.main.flash(200, 233, 196, 106);
      }
    } });

    // Déblocages
    const unlocks: { icon: string; text: string }[] = [
      ...rep.newAccessories.map((a) => ({ icon: `it-${a}`, text: `${ACCESSORIES[a].name} débloqué` })),
      ...rep.newGoals.map((g) => {
        const goal = GOALS.find((x) => x.id === g)!;
        const icon = goal.reward.weapon ? `it-${goal.reward.weapon}` : goal.reward.perk ? 'ic-check' : 'ic-check';
        return { icon, text: `${goal.name} : ${goal.rewardText}` };
      }),
    ];
    if (unlocks.length) {
      plate(this, W / 2, 946, 'Déblocages', P.soin, 18);
      unlocks.slice(0, 3).forEach((u, i) => {
        const y = 990 + i * 44;
        fitImage(this, u.icon, 80, y, 38);
        const t = txt(this, 112, y, u.text, 21, C.goodStr, { fontStyle: 'bold' }).setOrigin(0, 0.5).setAlpha(0);
        this.tweens.add({ targets: t, alpha: 1, x: { from: 140, to: 112 }, delay: 1100 + i * 220, duration: 300 });
      });
    } else {
      txt(this, W / 2, 970, 'Prochain accessoire au prochain niveau d’arme.', 20, C.quiet).setOrigin(0.5);
    }

    const half = (W - 80 - 16) / 2;
    button(this, 40, 1150, half, 96, 'Rejouer', () => this.scene.start('zgame', { slot: d.slot }), { primary: true, icon: 'ic-reroll', size: 30 });
    button(this, 40 + half + 16, 1150, half, 96, 'QG', () => this.scene.start('zhub'), { icon: 'ic-compass', size: 30 });
    fadeIn(this);
  }
}
