// Choix de l'opérateur au début d'une run : il fixe le pool d'objets et donne un passif.
import Phaser from 'phaser';
import { C, H, W } from '../config';
import { FAMILY_INFO, ITEMS } from '../data/items';
import { opFig, pxFigure } from '../art';
import { OPERATORS, OPERATOR_IDS, OperatorId } from '../data/operators';
import { BASE_X0, BASE_X1, BASE_Y0, BASE_Y1 } from '../logic/grid';
import { clearRun, newRun, saveRun } from '../logic/run';
import { Button, button, fadeIn, itemView, pop, txt, vibrate } from '../ui/widgets';

const CARD = { x: 20, w: 680, h: 452 };
const CARD_Y = [168, 640];
const PCELL = 50;

export default class OperatorScene extends Phaser.Scene {
  private chosen: OperatorId | null = null;
  private cards: { id: OperatorId; root: Phaser.GameObjects.Container; sel: Phaser.GameObjects.Graphics }[] = [];
  private go!: Button;

  constructor() {
    super('operator');
  }

  create() {
    fadeIn(this);
    this.chosen = null;
    this.cards = [];
    const g = this.add.graphics();
    g.lineStyle(1, C.cellLine, 0.5);
    for (let x = 0; x < W; x += 46) g.lineBetween(x, 0, x, H);
    for (let y = 0; y < H; y += 46) g.lineBetween(0, y, W, y);

    const back = txt(this, 28, 44, '‹ MENU', 22, C.quiet, { fontStyle: 'bold' }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    back.on('pointerup', () => this.scene.start('menu'));
    txt(this, W / 2, 96, 'CHOISIS TON OPÉRATEUR', 44, C.text, { fontStyle: 'bold italic', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
    txt(this, W / 2, 140, 'Il fixe les objets que tu trouveras pendant la run', 20, C.quiet).setOrigin(0.5);

    OPERATOR_IDS.forEach((id, i) => this.card(id, CARD_Y[i], i));

    this.go = button(this, 20, H - 128, W - 40, 100, 'Choisis un opérateur', () => this.deploy(), { primary: true, size: 30 });
    this.go.setEnabled(false);
  }

  private card(id: OperatorId, y: number, index: number) {
    const op = OPERATORS[id];
    const fam = FAMILY_INFO[op.family];
    const root = this.add.container(CARD.x, y);
    root.setSize(CARD.w, CARD.h);
    const g = this.add.graphics();
    // Fond, liseré de famille à gauche, bande de couleur en haut
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(0, 6, CARD.w, CARD.h, 22);
    g.fillStyle(C.panel, 1);
    g.fillRoundedRect(0, 0, CARD.w, CARD.h, 22);
    g.fillStyle(fam.color, 0.12);
    g.fillRoundedRect(0, 0, CARD.w, 120, { tl: 22, tr: 22, bl: 0, br: 0 });
    g.fillStyle(fam.color, 1);
    g.fillRoundedRect(0, 0, 10, CARD.h, { tl: 22, tr: 0, bl: 22, br: 0 });
    g.lineStyle(2, C.panelLine, 1);
    g.strokeRoundedRect(0, 0, CARD.w, CARD.h, 22);
    root.add(g);

    // Opérateur en silhouette derrière le nom
    const fig = pxFigure(this, CARD.w - 150, 118, opFig(id), 2.4, index === 1).setAlpha(0.22).setTint(fam.color);
    root.add(fig);

    // En-tête : icône de famille, nom, famille
    const badge = this.add.graphics();
    badge.fillStyle(0x0d0f0a, 1);
    badge.fillCircle(66, 62, 40);
    badge.lineStyle(4, fam.color, 1);
    badge.strokeCircle(66, 62, 40);
    root.add(badge);
    root.add(this.add.image(66, 62, `ic-f-${op.family}`).setDisplaySize(44, 44).setTint(fam.color));
    root.add(txt(this, 124, 60, op.name.toUpperCase(), 56, C.text, { fontStyle: 'bold italic', stroke: '#000000', strokeThickness: 5 }).setOrigin(0, 0.55));
    root.add(txt(this, 128, 98, `FAMILLE ${fam.name.toUpperCase()}`, 18, fam.hex, { fontStyle: 'bold' }).setOrigin(0, 0.5));

    // Colonne de gauche : accroche, passif, butin
    const tx = 32;
    const tw = 340;
    let ty = 142;
    const pitch = txt(this, tx, ty, op.pitch, 22, C.text, { wordWrap: { width: tw }, lineSpacing: 4 });
    root.add(pitch);
    ty += pitch.height + 18;
    root.add(txt(this, tx, ty, 'PASSIF', 16, C.quiet, { fontStyle: 'bold' }));
    ty += 24;
    const pas = txt(this, tx, ty, op.passive, 21, C.accentStr, { fontStyle: 'bold', wordWrap: { width: tw } });
    root.add(pas);
    ty += pas.height + 18;
    root.add(txt(this, tx, ty, 'SPÉCIALITÉ', 16, C.quiet, { fontStyle: 'bold' }));
    ty += 26;
    let cx = tx;
    let cy = ty;
    for (const f of [op.family]) {
      const fi = FAMILY_INFO[f];
      const t = txt(this, 0, 0, fi.name, 17, fi.hex, { fontStyle: 'bold' });
      const w = t.width + 22;
      if (cx + w > tx + tw) {
        cx = tx;
        cy += 38;
      }
      const chip = this.add.graphics();
      chip.fillStyle(fi.color, 0.14);
      chip.fillRoundedRect(cx, cy, w, 30, 15);
      chip.lineStyle(2, fi.color, 0.9);
      chip.strokeRoundedRect(cx, cy, w, 30, 15);
      t.setPosition(cx + 11, cy + 15).setOrigin(0, 0.5);
      root.add([chip, t]);
      cx += w + 8;
    }
    const gr = txt(this, cx, cy + 15, '+ ses objets de signature, et tout le reste', 17, C.quiet).setOrigin(0, 0.5);
    if (cx + gr.width > tx + tw) gr.setPosition(tx, cy + 38 + 15);
    root.add(gr);

    // Colonne de droite : sac de départ (sac de base 5 × 4 et objets de départ)
    const cols = BASE_X1 - BASE_X0 + 1;
    const rows = BASE_Y1 - BASE_Y0 + 1;
    const gx = CARD.w - 28 - cols * PCELL;
    const gy = 168;
    root.add(txt(this, gx + (cols * PCELL) / 2, gy - 16, 'SAC DE DÉPART', 16, C.quiet, { fontStyle: 'bold' }).setOrigin(0.5, 1));
    const grid = this.add.graphics();
    grid.fillStyle(0x0d0f0a, 1);
    grid.fillRoundedRect(gx - 8, gy - 8, cols * PCELL + 16, rows * PCELL + 16, 14);
    for (let x = 0; x < cols; x++) {
      for (let yy = 0; yy < rows; yy++) {
        grid.fillStyle(C.cell, 1);
        grid.fillRoundedRect(gx + x * PCELL + 2, gy + yy * PCELL + 2, PCELL - 4, PCELL - 4, 6);
      }
    }
    root.add(grid);
    // L'arme et son chargeur se choisissent au largage : leur place reste vide.
    for (const [defId, x, yy] of op.start) {
      if (ITEMS[defId].weapon || ITEMS[defId].synergy?.kind === 'mag') continue;
      const v = itemView(this, { defId, rot: 0 }, PCELL);
      v.setPosition(gx + (x - BASE_X0) * PCELL, gy + (yy - BASE_Y0) * PCELL);
      root.add(v);
    }
    root.add(txt(this, gx + (cols * PCELL) / 2, gy + PCELL, 'ARME AU\nLARGAGE', 15, C.accentStr, { fontStyle: 'bold', align: 'center' }).setOrigin(0.5));

    // Contour de sélection
    const sel = this.add.graphics();
    sel.lineStyle(5, C.accent, 1);
    sel.strokeRoundedRect(-3, -3, CARD.w + 6, CARD.h + 6, 24);
    sel.setVisible(false);
    root.add(sel);
    const check = this.add.container(CARD.w - 34, 34).setVisible(false);
    const cg = this.add.graphics();
    cg.fillStyle(C.accent, 1);
    cg.fillCircle(0, 0, 22);
    check.add([cg, this.add.image(0, 0, 'ic-check').setDisplaySize(26, 26).setTint(0x1a1206)]);
    root.add(check);
    sel.setData('check', check);

    const hit = this.add.zone(CARD.w / 2, CARD.h / 2, CARD.w, CARD.h).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.pick(id));
    root.add(hit);
    this.cards.push({ id, root, sel });

    // Entrée : glisse depuis le côté
    root.x = index === 0 ? -W : W;
    root.alpha = 0;
    this.tweens.add({ targets: root, x: CARD.x, alpha: 1, duration: 420, delay: 120 + index * 120, ease: 'Back.Out' });
  }

  private pick(id: OperatorId) {
    if (this.chosen === id) {
      this.deploy();
      return;
    }
    this.chosen = id;
    vibrate(8);
    for (const c of this.cards) {
      const on = c.id === id;
      c.sel.setVisible(on);
      (c.sel.getData('check') as Phaser.GameObjects.Container).setVisible(on);
      this.tweens.add({ targets: c.root, alpha: on ? 1 : 0.55, duration: 160 });
      if (on) pop(this, c.root, 1.03, 220);
    }
    this.go.setLabel(`Jouer ${OPERATORS[id].name} ▸`);
    this.go.setEnabled(true);
    pop(this, this.go.root, 1.06, 200);
  }

  private deploy() {
    if (!this.chosen) return;
    vibrate(15);
    clearRun();
    const run = newRun(this.chosen);
    saveRun(run);
    this.registry.set('run', run);
    this.registry.remove('mapSeen');
    this.cameras.main.fadeOut(220, 20, 22, 15);
    this.time.delayedCall(240, () => this.scene.start('map'));
  }
}
