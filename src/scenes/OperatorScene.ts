// Choix de l'opérateur au début d'une run : il fixe le pool d'objets et donne un passif.
import Phaser from 'phaser';
import { C, H, W, TITLE_FONT } from '../config';
import { FAMILY_INFO, ITEMS } from '../data/items';
import { opFig, pxFigure } from '../art';
import { OPERATORS, OPERATOR_IDS, OperatorId } from '../data/operators';
import { BASE_X0, BASE_X1, BASE_Y0, BASE_Y1 } from '../logic/grid';
import { clearRun, newRun, saveRun } from '../logic/run';
import { MENACE_INFO, loadProfile } from '../logic/profile';
import { describe } from '../logic/stats';
import { P, hex } from '../ui/palette';
import { Button, button, chamferPoints, fadeIn, itemView, pop, txt, vibrate, FADE_RGB } from '../ui/widgets';

const CARD = { x: 20, w: 680, h: 720 };
/** Onglets des opérateurs, puis la carte de celui qui est choisi. */
const TABS_Y = 152;
const CARD_Y = 262;
/** Bandeau de la Menace, sous les cartes. */
const MENACE_Y = 1000;
const PCELL = 50;

export default class OperatorScene extends Phaser.Scene {
  private chosen: OperatorId | null = null;
  private cards: { id: OperatorId; root: Phaser.GameObjects.Container; sel: Phaser.GameObjects.Graphics }[] = [];
  private tabs!: Phaser.GameObjects.Container;
  private go!: Button;
  /** Niveau de Menace choisi, et le plus haut débloqué pour l'opérateur choisi. */
  private menace = 0;
  private menaceMax = 0;
  private menaceRow!: Phaser.GameObjects.Container;

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
    txt(this, W / 2, 84, 'CHOISIS TON OPÉRATEUR', 38, C.text, { fontFamily: TITLE_FONT, stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
    txt(this, W / 2, 124, 'Il fixe les objets que tu trouveras pendant la run', 20, C.quiet).setOrigin(0.5);

    this.tabs = this.add.container(0, TABS_Y);
    this.menaceRow = this.add.container(0, MENACE_Y);
    this.go = button(this, 20, H - 128, W - 40, 100, 'Choisis un opérateur', () => this.deploy(), { primary: true, size: 30 });
    // Par défaut : le dernier opérateur joué.
    const last = loadProfile().history[0]?.operator;
    this.pick(last && OPERATOR_IDS.includes(last) ? last : OPERATOR_IDS[0], true);
  }

  /** Onglets : un par opérateur, couleur de sa famille ; celui qui est choisi est plein. */
  private drawTabs() {
    const t = this.tabs;
    t.removeAll(true);
    const n = OPERATOR_IDS.length;
    const gap = 10;
    const w = (W - 40 - gap * (n - 1)) / n;
    OPERATOR_IDS.forEach((id, i) => {
      const op = OPERATORS[id];
      const fam = FAMILY_INFO[op.family];
      const on = id === this.chosen;
      const x = 20 + i * (w + gap);
      const g = this.add.graphics();
      g.fillStyle(on ? fam.color : C.panel, on ? 0.25 : 1);
      g.fillPoints(chamferPoints(x, 0, w, 92, 12), true);
      g.lineStyle(on ? 4 : 2, on ? fam.color : C.panelLine, 1);
      g.strokePoints(chamferPoints(x, 0, w, 92, 12), false, true);
      t.add(g);
      t.add(pxFigure(this, x + 38, 86, opFig(id), 1.2).setAlpha(on ? 1 : 0.5));
      const nm = txt(this, x + 74, 32, op.name.toUpperCase(), 20, on ? C.text : C.quiet, { fontFamily: TITLE_FONT }).setOrigin(0, 0.5);
      if (nm.width > w - 82) nm.setScale((w - 82) / nm.width);
      t.add(nm);
      t.add(txt(this, x + 74, 62, fam.name, 15, fam.hex, { fontStyle: 'bold' }).setOrigin(0, 0.5));
      const z = this.add.zone(x + w / 2, 46, w, 92).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => this.pick(id));
      t.add(z);
    });
  }

  /** Bandeau de la Menace : niveau choisi (flèches), son nom, ce qu'il ajoute ; verrouillé tant qu'on n'a pas gagné. */
  private drawMenace() {
    const r = this.menaceRow;
    r.removeAll(true);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35);
    g.fillPoints(chamferPoints(20, 0, W - 40, 112, 14), true);
    g.lineStyle(2, this.menace > 0 ? P.braise : C.panelLine, 1);
    g.strokePoints(chamferPoints(20, 0, W - 40, 112, 14), false, true);
    r.add(g);
    if (!this.chosen) {
      r.add(txt(this, W / 2, 56, 'MENACE : gagne un Top 1 pour débloquer le niveau suivant', 19, C.quiet).setOrigin(0.5));
      return;
    }
    const m = this.menace;
    const col = m === 0 ? C.text : hex(m >= 4 ? P.dangerClair : P.orange);
    r.add(txt(this, W / 2, 30, `MENACE ${m}${m ? ' · ' + MENACE_INFO[m].name.toUpperCase() : ''}`, 26, col, { fontFamily: TITLE_FONT }).setOrigin(0.5));
    const desc = m === 0 ? (this.menaceMax ? `Débloqué jusqu'à la Menace ${this.menaceMax}` : 'Gagne un Top 1 pour débloquer la Menace 1') : MENACE_INFO.slice(1, m + 1).map((x) => x.text).join(' ');
    const d = txt(this, W / 2, 70, desc, 16, C.quiet, { align: 'center', wordWrap: { width: W - 200 } }).setOrigin(0.5);
    if (d.height > 64) d.setScale(64 / d.height);
    r.add(d);
    const arrow = (x: number, dir: -1 | 1) => {
      const on = dir < 0 ? m > 0 : m < this.menaceMax;
      const t = txt(this, x, 56, dir < 0 ? '◀' : '▶', 40, on ? C.accentStr : hex(P.trait2)).setOrigin(0.5);
      if (on) {
        t.setInteractive({ useHandCursor: true }).on('pointerup', () => {
          this.menace = Math.max(0, Math.min(this.menaceMax, m + dir));
          vibrate(6);
          this.drawMenace();
        });
      }
      r.add(t);
    };
    arrow(62, -1);
    arrow(W - 62, 1);
  }

  private card(id: OperatorId, y: number, index: number) {
    const op = OPERATORS[id];
    const fam = FAMILY_INFO[op.family];
    const root = this.add.container(CARD.x, y);
    root.setSize(CARD.w, CARD.h);
    const g = this.add.graphics();
    // Fond, liseré de famille à gauche, bande de couleur en haut
    g.fillStyle(0x000000, 0.4);
    g.fillPoints(chamferPoints(2, 6, CARD.w, CARD.h, 20), true);
    g.fillStyle(C.panel, 1);
    g.fillPoints(chamferPoints(0, 0, CARD.w, CARD.h, 20), true);
    g.fillStyle(fam.color, 0.12);
    g.fillPoints(chamferPoints(0, 0, CARD.w, 120, 20), true);
    g.fillStyle(fam.color, 1);
    g.fillRect(6, 20, 8, CARD.h - 40);
    g.lineStyle(2, C.panelLine, 1);
    g.strokePoints(chamferPoints(0, 0, CARD.w, CARD.h, 20), false, true);
    // Coins renforcés de la couleur de la famille
    g.fillStyle(fam.color, 1);
    for (const [cx, cy] of [[0, 0], [CARD.w, 0], [0, CARD.h], [CARD.w, CARD.h]]) {
      const sx = cx ? -1 : 1;
      const sy = cy ? -1 : 1;
      g.fillTriangle(cx, cy + sy * 20, cx + sx * 20, cy, cx + sx * 28, cy + sy * 8);
    }
    root.add(g);

    // Opérateur en silhouette derrière le nom
    const fig = pxFigure(this, CARD.w - 150, 118, opFig(id), 2.4, index === 1).setAlpha(0.22).setTint(fam.color);
    root.add(fig);

    // En-tête : icône de famille, nom, famille
    const badge = this.add.graphics();
    badge.fillStyle(0x0f0d13, 1);
    badge.fillCircle(66, 62, 40);
    badge.lineStyle(4, fam.color, 1);
    badge.strokeCircle(66, 62, 40);
    root.add(badge);
    root.add(this.add.image(66, 62, `ic-f-${op.family}`).setDisplaySize(44, 44).setTint(fam.color));
    root.add(txt(this, 124, 60, op.name.toUpperCase(), 48, C.text, { fontFamily: TITLE_FONT, stroke: '#000000', strokeThickness: 5 }).setOrigin(0, 0.55));
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
    const gr = txt(this, cx, cy + 15, '+ signatures et tronc commun', 17, C.quiet).setOrigin(0, 0.5);
    if (cx + gr.width > tx + tw) gr.setPosition(tx, cy + 38 + 15);
    root.add(gr);

    // Colonne de droite : sac de départ (sac de base 5 × 4 et objets de départ)
    const cols = BASE_X1 - BASE_X0 + 1;
    const rows = BASE_Y1 - BASE_Y0 + 1;
    const gx = CARD.w - 28 - cols * PCELL;
    const gy = 168;
    root.add(txt(this, gx + (cols * PCELL) / 2, gy - 16, 'SAC DE DÉPART', 16, C.quiet, { fontStyle: 'bold' }).setOrigin(0.5, 1));
    const grid = this.add.graphics();
    grid.fillStyle(0x0f0d13, 1);
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

    // Objets de signature : seul cet opérateur les trouve.
    // Une ligne par objet : l'objet, son nom et sa première ligne de fiche.
    const sigs = Object.values(ITEMS).filter((d) => d.signature === id);
    let sy = Math.max(400, gr.y + gr.height + 22, gy + rows * PCELL + 24);
    root.add(txt(this, 32, sy, 'OBJETS DE SIGNATURE', 16, C.quiet, { fontStyle: 'bold' }));
    sy += 28;
    const SC = 30;
    for (const d of sigs) {
      const v = itemView(this, { defId: d.id, rot: 0 }, SC);
      v.setPosition(32, sy);
      root.add(v);
      const tx2 = 32 + 3 * SC + 14;
      root.add(txt(this, tx2, sy, d.name, 18, C.text, { fontStyle: 'bold' }));
      // Accessoires et munitions : leur effet est leur étoile ; sinon la première ligne de la fiche.
      const lines = describe({ defId: d.id }).lines;
      const line = (d.synergy ? lines.find((l) => l.startsWith('★'))?.replace(/^★ /, '') : lines.find((l) => !l.startsWith('★'))) ?? '';
      const lt = txt(this, tx2, sy + 24, line, 15, C.quiet, { wordWrap: { width: CARD.w - tx2 - 30 } });
      root.add(lt);
      sy += Math.max(d.shape.length * SC, 24 + lt.height) + 10;
    }
    // Record de l'opérateur (profil local).
    const prof = loadProfile();
    const best = prof.best[id];
    const rec = best > 5 ? 'Top 1 gagné' : best >= 5 ? 'Top 1 atteint' : best > 0 ? `${best} cercle${best > 1 ? 's' : ''}` : 'aucune partie';
    root.add(txt(this, 32, CARD.h - 44, `RECORD : ${rec.toUpperCase()} · MENACE DÉBLOQUÉE : ${prof.menace[id]}`, 16, C.quiet, { fontStyle: 'bold' }));

    // Contour de sélection
    const sel = this.add.graphics();
    sel.lineStyle(5, C.accent, 1);
    sel.strokePoints(chamferPoints(-3, -3, CARD.w + 6, CARD.h + 6, 22), false, true);
    sel.setVisible(false);
    root.add(sel);
    const check = this.add.container(CARD.w - 34, 34).setVisible(false);
    const cg = this.add.graphics();
    cg.fillStyle(C.accent, 1);
    cg.fillCircle(0, 0, 22);
    check.add([cg, this.add.image(0, 0, 'ic-check').setDisplaySize(26, 26).setTint(0x17141c)]);
    root.add(check);
    sel.setData('check', check);

    const hit = this.add.zone(CARD.w / 2, CARD.h / 2, CARD.w, CARD.h).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.pick(id));
    root.add(hit);
    this.cards.push({ id, root, sel });

    // Entrée : glisse depuis le côté
    root.x = index === 0 ? -60 : 60;
    root.alpha = 0;
    this.tweens.add({ targets: root, x: CARD.x, alpha: 1, duration: 260, ease: 'Back.Out' });
  }

  private pick(id: OperatorId, first = false) {
    if (this.chosen === id) return;
    const from = OPERATOR_IDS.indexOf(this.chosen ?? id);
    this.chosen = id;
    if (!first) vibrate(8);
    for (const c of this.cards) c.root.destroy();
    this.cards = [];
    this.card(id, CARD_Y, OPERATOR_IDS.indexOf(id) < from ? 0 : 1);
    this.drawTabs();
    this.menaceMax = loadProfile().menace[id];
    this.menace = this.menaceMax;
    this.drawMenace();
    this.go.setLabel(`Jouer ${OPERATORS[id].name} ▸`);
    this.go.setEnabled(true);
    if (!first) pop(this, this.go.root, 1.04, 160);
  }

  private deploy() {
    if (!this.chosen) return;
    vibrate(15);
    clearRun();
    const run = newRun(this.chosen, undefined, { menace: this.menace });
    saveRun(run);
    this.registry.set('run', run);
    this.registry.remove('mapSeen');
    this.cameras.main.fadeOut(220, ...FADE_RGB);
    this.time.delayedCall(240, () => this.scene.start('map'));
  }
}
