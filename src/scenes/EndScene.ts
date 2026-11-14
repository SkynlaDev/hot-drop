// Fin de run : Top 1 (duel final gagné) ou élimination.
import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { C, TITLE_FONT, W } from '../config';
import { OPERATORS } from '../data/operators';
import { RunState, clearRun } from '../logic/run';
import { ROUNDS } from '../logic/zone';
import { bagView, button, fadeIn, itemView, panel, plate, txt } from '../ui/widgets';
import { P } from '../ui/palette';
import { usableCells } from '../logic/grid';
import { opFig, pxFigure } from '../art';
import { MENACE_INFO, RunOutcome, loadProfile, recordRun, saveProfile } from '../logic/profile';

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
    // Profil : la run n'est enregistrée qu'une fois, même si l'écran est rouvert.
    let outcome: RunOutcome | null = null;
    if (this.registry.get('recorded') !== run.seed) {
      const prof = loadProfile();
      outcome = recordRun(prof, run);
      saveProfile(prof);
      this.registry.set('recorded', run.seed);
    }
    this.registry.remove('mapSeen');
    this.registry.remove('zoneSeen');

    const hero = this.add.image(W / 2, 0, win ? 'bg-port' : 'bg-industrie').setOrigin(0.5, 0);
    hero.setScale(620 / hero.height).setTint(win ? 0xffffff : 0x6b6370);
    const fig = pxFigure(this, W / 2, 600, opFig(run.operator), 3.6);
    // Défaite : l'opérateur est à terre.
    if (!win) fig.setTint(0x6b6370).setAngle(-82).setY(584);
    const fade = this.add.graphics();
    for (let i = 0; i < 24; i++) {
      fade.fillStyle(C.bg, (i / 24) * 0.95);
      fade.fillRect(0, 380 + i * 10, W, 10);
    }
    fade.fillStyle(C.bg, 1);
    fade.fillRect(0, 620, W, 700);

    const title = this.add
      .text(W / 2, 672, win ? 'TOP 1' : 'ÉLIMINÉ', {
        fontFamily: TITLE_FONT,
        fontSize: win ? '130px' : '96px',
        stroke: '#000000',
        strokeThickness: 12,
        padding: { left: 40, right: 40, top: 10, bottom: 4 },
        color: win ? C.accentStr : C.dangerStr,
        resolution: 2,
      })
      .setOrigin(0.5)
      .setScale(2.2)
      .setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 380, delay: 150, ease: 'Back.Out', onComplete: () => {
      this.cameras.main.shake(160, 0.006);
      sfx(win ? 'win' : 'lose', { vary: 0 });
    } });
    txt(this, W / 2, 770, win ? 'Dernier debout. La zone est à toi.' : 'Le gaz se referme sans toi.', 26, C.text).setOrigin(0.5);

    // Rapport de mission : stats à gauche, sac final en miniature à droite, tampon par-dessus.
    const PX = 30;
    const PY = 810;
    const PW = W - 60;
    const PH = 250;
    panel(this, PX, PY, PW, PH, win ? P.orSombre : P.braiseSombre);
    plate(this, W / 2, PY, 'Rapport de mission', win ? P.or : P.danger, 18);
    const reached = win ? ROUNDS : Math.min(run.round, ROUNDS);
    const lines: [string, string][] = [
      ['Opérateur', OPERATORS[run.operator].name],
      ['Cercles', `${reached}/${ROUNDS}${run.round >= ROUNDS && !win ? ' · Top 1' : ''}`],
      ['Goulag', run.goulagUsed ? 'utilisé' : 'intact'],
      ['Objets', `${run.items.filter((i) => i.placed).length}`],
      ['Duels gagnés', `${run.wins ?? 0}`],
      [run.daily ? 'Défi du jour' : 'Menace', run.daily ? run.daily.split('-').reverse().join('/') : `${run.menace ?? 0}${run.menace ? ' · ' + MENACE_INFO[run.menace].name : ''}`],
    ];
    lines.forEach(([k, v], i) => {
      const y = PY + 50 + i * 38;
      const a = txt(this, PX + 30, y, k, 20, C.quiet).setOrigin(0, 0.5).setAlpha(0);
      const b = txt(this, PX + 300, y, v, 21, C.text, { fontStyle: 'bold' }).setOrigin(1, 0.5).setAlpha(0);
      this.tweens.add({ targets: [a, b], alpha: 1, duration: 220, delay: 500 + i * 90 });
    });
    this.miniBag(run, PX + 330, PY + 30, PW - 350, PH - 50);

    // Tampon
    const st = this.add.container(PX + PW - 150, PY + PH - 46).setAngle(-12).setAlpha(0).setScale(2.4);
    const stLabel = txt(this, 0, 0, win ? 'MISSION ACCOMPLIE' : 'K.I.A.', win ? 22 : 30, win ? '#e9c46a' : '#ef7b72', { fontFamily: TITLE_FONT }).setOrigin(0.5);
    const sg = this.add.graphics();
    sg.lineStyle(4, win ? P.or : P.dangerClair, 0.9);
    sg.strokeRect(-stLabel.width / 2 - 14, -stLabel.height / 2 - 6, stLabel.width + 28, stLabel.height + 12);
    st.add([sg, stLabel]);
    this.tweens.add({ targets: st, alpha: 0.85, scale: 1, duration: 260, delay: 1150, ease: 'Back.Out', onComplete: () => this.cameras.main.shake(90, 0.004) });

    // Ambiance : étincelles d'or (victoire) ou cendres qui tombent (défaite).
    for (let i = 0; i < 24; i++) this.particle(win, true);

    // Ce que la run débloque : niveau de Menace, record, meilleur résultat du défi du jour.
    const news = outcome?.unlocked ? `MENACE ${outcome.unlocked} DÉBLOQUÉE` : outcome?.dailyBest && run.daily ? 'DÉFI DU JOUR : MEILLEUR RÉSULTAT' : outcome?.record ? 'NOUVEAU RECORD' : '';
    if (news) {
      const pl = plate(this, W / 2, 1092, news, outcome?.unlocked ? P.or : P.orange, 20).setAlpha(0).setScale(1.6);
      this.tweens.add({ targets: pl, alpha: 1, scale: 1, duration: 300, delay: 1500, ease: 'Back.Out', onComplete: () => sfx('mark', { vol: 0.7 }) });
    }

    button(this, 60, 1130, 380, 96, 'Nouvelle run', () => this.scene.start('operator'), { primary: true, size: 28, icon: 'ic-reroll' });
    button(this, 460, 1130, 200, 96, 'Menu', () => this.scene.start('menu'), { size: 24, icon: 'ic-menu' });
  }

  /** Sac final en miniature, centré dans la boîte (x, y, w, h). */
  private miniBag(run: RunState, x: number, y: number, w: number, h: number) {
    const bags = run.bags.filter((b) => b.placed);
    const items = run.items.filter((i) => i.placed);
    const cells = [...usableCells(run.bags)].map((k) => k.split(',').map(Number));
    if (!cells.length) return;
    const x0 = Math.min(...cells.map((c) => c[0]));
    const y0 = Math.min(...cells.map((c) => c[1]));
    const cw = Math.max(...cells.map((c) => c[0])) - x0 + 1;
    const chh = Math.max(...cells.map((c) => c[1])) - y0 + 1;
    const cell = Math.floor(Math.min(w / cw, h / chh, 34));
    const gx = x + (w - cw * cell) / 2;
    const gy = y + (h - chh * cell) / 2;
    const root = this.add.container(0, 0).setAlpha(0);
    const g = this.add.graphics();
    g.fillStyle(P.nuit, 0.8);
    g.fillRect(gx - 4, gy - 4, cw * cell + 8, chh * cell + 8);
    g.fillStyle(C.canvas, 1);
    for (const [cx, cy] of cells) g.fillRect(gx + (cx - x0) * cell + 1, gy + (cy - y0) * cell + 1, cell - 2, cell - 2);
    root.add(g);
    for (const b of bags) root.add(bagView(this, b, cell).setPosition(gx + (b.x - x0) * cell, gy + (b.y - y0) * cell).setAlpha(0.6));
    for (const it of items) root.add(itemView(this, it, cell).setPosition(gx + (it.x - x0) * cell, gy + (it.y - y0) * cell));
    this.tweens.add({ targets: root, alpha: 1, duration: 300, delay: 700 });
  }

  /** Étincelle d'or qui monte, ou cendre qui tombe ; renaît à la fin. */
  private particle(win: boolean, first = false) {
    const x = Phaser.Math.Between(0, W);
    const y0 = win ? Phaser.Math.Between(first ? 100 : 600, 700) : Phaser.Math.Between(first ? -20 : -40, first ? 600 : -10);
    const p = this.add.rectangle(x, y0, win ? 3 : 4, win ? 3 : 4, win ? P.or : P.gris).setAlpha(0);
    if (win) p.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: p, y: win ? y0 - Phaser.Math.Between(200, 420) : y0 + Phaser.Math.Between(300, 600), x: x + Phaser.Math.Between(-50, 50),
      alpha: { from: 0.9, to: 0 }, angle: win ? 0 : 180, duration: Phaser.Math.Between(3000, 6000), delay: first ? Phaser.Math.Between(0, 3000) : 0,
      onComplete: () => {
        p.destroy();
        if (this.scene.isActive()) this.particle(win);
      },
    });
  }
}
