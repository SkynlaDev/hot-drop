// Carnet : collection d'objets trouvés, statistiques, Menace par opérateur et dernières parties (profil local).
import Phaser from 'phaser';
import { C, TITLE_FONT, W, H, MONO } from '../config';
import { CATEGORY_NAMES, Category, ITEMS } from '../data/items';
import { OPERATORS, OPERATOR_IDS } from '../data/operators';
import { dims } from '../logic/grid';
import { MENACE_MAX, Profile, collection, loadProfile } from '../logic/profile';
import { TIER_COLORS, TIER_HEX, TIER_NAMES, tierOf } from '../logic/tier';
import { ROUNDS } from '../logic/zone';
import { P, hex } from '../ui/palette';
import { fadeIn, itemView, panel, plate, txt, vibrate } from '../ui/widgets';

const TILE = 64;
const COLS = 10;
const GRID_X = (W - COLS * TILE) / 2;
const CAT_ORDER: Category[] = ['arme', 'munition', 'accessoire', 'protection', 'explosif', 'medical', 'composant'];

export default class CarnetScene extends Phaser.Scene {
  private info!: Phaser.GameObjects.Text;
  private infoSub!: Phaser.GameObjects.Text;
  private sel!: Phaser.GameObjects.Graphics;

  constructor() {
    super('carnet');
  }

  create() {
    fadeIn(this);
    const p = loadProfile();
    this.add.rectangle(0, 0, W, H, C.bg).setOrigin(0);
    const back = txt(this, 28, 44, '‹ MENU', 22, C.quiet, { fontStyle: 'bold' }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    back.on('pointerup', () => this.scene.start('menu'));
    txt(this, W / 2, 86, 'CARNET', 46, C.text, { fontFamily: TITLE_FONT, stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);

    this.stats(p, 128);
    const gridY = this.collectionGrid(p, 346);
    this.history(p, gridY + 16);
  }

  /** Parties, Top 1, et pour chaque opérateur : meilleur résultat et Menace. */
  private stats(p: Profile, y: number) {
    panel(this, 20, y, W - 40, 196);
    txt(this, 44, y + 22, `${p.runs} partie${p.runs > 1 ? 's' : ''} · ${p.top1} Top 1`, 24, C.text, { fontStyle: 'bold' });
    const c = collection(p);
    const prog = (label: string, [n, t]: [number, number], x: number, col: string) => {
      txt(this, x, y + 64, label, 15, C.quiet);
      txt(this, x, y + 82, `${n}/${t}`, 22, col, { fontStyle: 'bold', fontFamily: MONO });
    };
    prog('OBJETS', c.base, 44, C.text);
    prog('RECETTES', c.recipes, 194, TIER_HEX[1]);
    prog('LÉGENDAIRES', c.legendary, 344, TIER_HEX[2]);
    OPERATOR_IDS.forEach((id, i) => {
      const yy = y + 124 + i * 28;
      const best = p.best[id];
      const bestTxt = best > ROUNDS ? 'Top 1 gagné' : best >= ROUNDS ? 'Top 1 atteint' : best > 0 ? `${best} cercle${best > 1 ? 's' : ''}` : '—';
      const won = p.menaceWon[id];
      txt(this, 44, yy, OPERATORS[id].name.toUpperCase(), 17, C.accentStr, { fontStyle: 'bold' });
      txt(this, 190, yy, `record : ${bestTxt}`, 17, C.text);
      txt(this, W - 44, yy, `Menace ${p.menace[id]}/${MENACE_MAX}${won >= 0 ? ` · gagnée ${won}` : ''}`, 17, p.menace[id] ? hex(P.orange) : C.quiet).setOrigin(1, 0);
    });
  }

  /** Tous les objets, classés par niveau puis catégorie : en couleur s'ils ont déjà été trouvés. */
  private collectionGrid(p: Profile, y: number): number {
    const seen = new Set(p.seen);
    const ids = Object.values(ITEMS)
      .sort((a, b) => tierOf(a.id) - tierOf(b.id) || CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category) || a.price - b.price)
      .map((d) => d.id);
    plate(this, W / 2, y, 'Collection', P.or, 18);
    const top = y + 26;
    this.sel = this.add.graphics().setDepth(5);
    ids.forEach((id, i) => {
      const x = GRID_X + (i % COLS) * TILE;
      const yy = top + Math.floor(i / COLS) * TILE;
      const found = seen.has(id);
      const g = this.add.graphics();
      g.fillStyle(found ? C.panel : P.nuit, 1);
      g.fillRoundedRect(x + 2, yy + 2, TILE - 4, TILE - 4, 8);
      g.lineStyle(2, found ? TIER_COLORS[tierOf(id)] : P.trait, found ? 0.9 : 0.5);
      g.strokeRoundedRect(x + 2, yy + 2, TILE - 4, TILE - 4, 8);
      const d = dims({ defId: id, rot: 0 });
      const cell = Math.min((TILE - 12) / d.w, (TILE - 12) / d.h);
      const v = itemView(this, { defId: id, rot: 0 }, cell);
      v.setPosition(x + (TILE - d.w * cell) / 2, yy + (TILE - d.h * cell) / 2);
      if (!found) {
        v.setAlpha(0.12);
        txt(this, x + TILE / 2, yy + TILE / 2, '?', 26, hex(P.traitClair), { fontStyle: 'bold' }).setOrigin(0.5);
      }
      this.add.zone(x + TILE / 2, yy + TILE / 2, TILE, TILE).setInteractive({ useHandCursor: true }).on('pointerup', () => this.show(id, found, x, yy));
    });
    const bottom = top + Math.ceil(ids.length / COLS) * TILE;
    this.info = txt(this, W / 2, bottom + 14, 'Touche un objet', 20, C.quiet, { fontStyle: 'bold' }).setOrigin(0.5, 0);
    this.infoSub = txt(this, W / 2, bottom + 42, '', 16, C.quiet).setOrigin(0.5, 0);
    return bottom + 66;
  }

  private show(id: string, found: boolean, x: number, y: number) {
    vibrate(5);
    const d = ITEMS[id];
    this.sel.clear();
    this.sel.lineStyle(3, P.orangeClair, 1);
    this.sel.strokeRoundedRect(x, y, TILE, TILE, 10);
    if (!found) {
      this.info.setText('???').setColor(C.quiet);
      this.infoSub.setText(d.crafted ? 'Objet assemblé pas encore découvert' : d.legendary ? 'Légendaire pas encore trouvé' : 'Pas encore trouvé');
      return;
    }
    this.info.setText(d.name).setColor(TIER_HEX[tierOf(id)]);
    this.infoSub.setText(`${TIER_NAMES[tierOf(id)]} · ${d.wclass ?? CATEGORY_NAMES[d.category]}`);
  }

  /** Les dernières parties. */
  private history(p: Profile, y: number) {
    plate(this, W / 2, y, 'Dernières parties', P.acierClair, 16);
    if (!p.history.length) {
      txt(this, W / 2, y + 40, 'Aucune partie terminée pour l’instant.', 18, C.quiet).setOrigin(0.5, 0);
      return;
    }
    const rows = Math.max(1, Math.floor((H - 30 - (y + 30)) / 34));
    p.history.slice(0, rows).forEach((r, i) => {
      const yy = y + 30 + i * 34;
      const res = r.result === 'win' ? 'TOP 1' : r.round >= ROUNDS ? 'Top 1 perdu' : `Cercle ${r.round + 1}`;
      txt(this, 40, yy, r.date.split('-').reverse().slice(0, 2).join('/'), 16, C.quiet, { fontFamily: MONO });
      txt(this, 112, yy, OPERATORS[r.operator].name, 17, C.text, { fontStyle: 'bold' });
      txt(this, 232, yy, r.daily ? 'Défi' : `M${r.menace}`, 16, r.daily ? TIER_HEX[1] : C.quiet);
      txt(this, 300, yy, res, 17, r.result === 'win' ? C.accentStr : C.text, { fontStyle: 'bold' });
      txt(this, W - 40, yy, r.key.map((id) => ITEMS[id]?.short ?? id).join(', '), 14, C.quiet).setOrigin(1, 0);
    });
  }
}
