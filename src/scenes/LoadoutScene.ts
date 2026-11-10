import Phaser from 'phaser';
import { BUTTON, C, CELL, COMBAT, GRID_X, GRID_Y, MONO, RESERVE, SELL, STATUS, TRAY, W } from '../config';
import { buildEncounter } from '../data/enemies';
import { FAMILY_INFO, Family, ITEMS } from '../data/items';
import { THREAT_INFO, Threat } from '../data/threats';
import { CombatEvent, CombatResult, EnemyUnit, simulate } from '../logic/combat';
import { COLS, ItemInst, ROWS, Rot, canPlace, cellKey, cellZones, cellsAt, dims, expandable, itemAt, maskOf, nextRot, overlapping, rotationIsNoop } from '../logic/grid';
import { RARITY_HEX, RARITY_NAMES } from '../logic/rarity';
import { hashParts, rngFor } from '../logic/rng';
import {
  EXTENSION_CELLS, FLOORS, NODE_INFO, NodeType, REROLL_COST, extensionPrice, RESERVE_MAX, RunState, START_SURSIS, addDrops, canFuse, fuse, isCombat,
  reserve, rewardCredits, rollDrops, rollShop, saveRun, shopOffers, takeItem, completeZone, level,
} from '../logic/run';
import { computeLoadout, describe, estimateDps, OPERATOR, sellValue } from '../logic/stats';
import { Button, banner, button, fadeIn, fillMask, flashItem, itemView, modalBase, panel, pop, toast, txt, vibrate } from '../ui/widgets';

type Phase = 'prep' | 'combat' | 'post' | 'over';
type Container = Phaser.GameObjects.Container;

interface DragState {
  inst: ItemInst;
  from: 'grid' | 'tray';
  downX: number;
  downY: number;
  moved: boolean;
  rot: Rot;
  grabX: number;
  grabY: number;
  lift: number;
  ghost?: Container;
  longPress?: Phaser.Time.TimerEvent;
}

interface Actor {
  x: number;
  feet: number;
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  fig: Container;
  bars: Phaser.GameObjects.Graphics;
  hpText: Phaser.GameObjects.Text;
  barW: number;
  barY: number;
}

interface CombatPlay {
  result: CombatResult;
  idx: number;
  t: number;
  player: Actor;
  enemies: Actor[];
}

const SPEEDS = [1, 2, 4];
const LONG_PRESS_MS = 450;
const DRAG_THRESHOLD = 12;

export default class LoadoutScene extends Phaser.Scene {
  private run!: RunState;
  private node!: NodeType;
  private place = '';
  private threats: Threat[] = [];
  /** Famille de butin annoncée par le lieu. */
  private family?: Family;
  private famTiers: Map<string, number> | null = null;
  private phase: Phase = 'prep';
  private enemies: EnemyUnit[] = [];
  private views = new Map<number, Container>();
  private trayViews = new Map<number, Container>();
  private trayItems: ItemInst[] = [];
  private drag: DragState | null = null;
  private modal: Container | null = null;
  private play: CombatPlay | null = null;
  private resultText = '';
  private popUid: number | null = null;
  private linkKeys: Set<string> | null = null;
  private lastCredits = -1;
  private freeze = 0;
  private hidden = new Set<number>();

  private itemLayer!: Container;
  private trayLayer!: Container;
  private combatLayer!: Container;
  private linkG!: Phaser.GameObjects.Graphics;
  private gridG!: Phaser.GameObjects.Graphics;
  private extHint!: Phaser.GameObjects.Text;
  private previewG!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private statusRight!: Phaser.GameObjects.Text;
  private reserveLabel!: Phaser.GameObjects.Text;
  private mainBtn!: Button;
  private altBtn!: Button;
  private speedBtn!: Button;
  private skipBtn!: Button;

  constructor() {
    super('loadout');
  }

  /** Vrai dans la 3e et dernière zone : l'exfiltration est gardée par Cdt Kesh. */
  private get finalZone(): boolean {
    return this.run.stage >= 2;
  }

  init(data: { node: NodeType; place?: string; threats?: Threat[]; family?: Family }) {
    this.run = this.registry.get('run');
    this.family = data.family;
    this.node = data.node;
    this.place = data.place ?? NODE_INFO[data.node].name;
    this.threats = data.node === 'boss' ? this.run.zone?.exfilThreats ?? [] : data.threats ?? [];
    this.famTiers = null;
    this.phase = isCombat(this.node) ? 'prep' : 'post';
    this.views = new Map();
    this.trayViews = new Map();
    this.trayItems = [];
    this.drag = null;
    this.modal = null;
    this.play = null;
    this.resultText = '';
    this.popUid = null;
    this.linkKeys = null;
    this.lastCredits = -1;
    this.freeze = 0;
    this.hidden = new Set();
    const node = this.node;
    this.enemies = isCombat(node)
      ? buildEncounter(node === 'boss' && !this.finalZone ? 'gardien' : node, level(this.run), rngFor(this.run.seed, this.run.stage, this.run.floor, 'enc'), this.threats)
      : [];
  }

  create() {
    fadeIn(this);
    this.drawStatic();
    this.gridG = this.add.graphics().setDepth(1);
    this.itemLayer = this.add.container(0, 0).setDepth(2);
    this.linkG = this.add.graphics().setDepth(5);
    this.previewG = this.add.graphics().setDepth(40);
    this.trayLayer = this.add.container(0, 0).setDepth(2);
    this.combatLayer = this.add.container(0, 0).setDepth(3);

    this.statusText = txt(this, 24, STATUS.h / 2, '', 26, C.text, { fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.statusRight = txt(this, W - 24, STATUS.h / 2, '', 24, C.quiet).setOrigin(1, 0.5);
    this.reserveLabel = txt(this, RESERVE.x + 6, RESERVE.y + 8, '', 18, C.quiet);
    this.extHint = txt(this, W / 2, GRID_Y - 6, '', 18, '#7ddc86', { fontStyle: 'bold', backgroundColor: '#0d0f0acc', padding: { x: 10, y: 4 } }).setOrigin(0.5, 1).setDepth(30);

    this.mainBtn = button(this, BUTTON.x + 240, BUTTON.y, BUTTON.w - 240, BUTTON.h, '', () => this.onMain(), { primary: true });
    this.altBtn = button(this, BUTTON.x, BUTTON.y, 224, BUTTON.h, 'Boutique', () => this.openShop(), { size: 24 });
    this.speedBtn = button(this, COMBAT.x + COMBAT.w - 232, COMBAT.y + 12, 106, 52, '×1', () => this.cycleSpeed(), { size: 22 });
    this.skipBtn = button(this, COMBAT.x + COMBAT.w - 118, COMBAT.y + 12, 106, 52, 'Passer', () => this.skipCombat(), { size: 22 });
    for (const b of [this.mainBtn, this.altBtn, this.speedBtn, this.skipBtn]) b.root.setDepth(20);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.input.keyboard?.on('keydown-R', () => this.rotateDragged());

    this.refresh();

    if (this.node === 'marchand') this.openShop();
    if (this.node === 'caisse' || this.node === 'planque') this.time.delayedCall(350, () => this.claimNodeReward());
  }

  // ---------------------------------------------------------------- décor fixe

  private drawStatic() {
    const g = this.add.graphics();
    g.fillStyle(0x0f110c, 1);
    g.fillRect(STATUS.x, STATUS.y, STATUS.w, STATUS.h);
    g.lineStyle(2, C.panelLine, 1);
    g.lineBetween(0, STATUS.h, W, STATUS.h);

    panel(this, COMBAT.x, COMBAT.y, COMBAT.w, COMBAT.h);

    // Légende des zones (la grille elle-même est redessinée à chaque rafraîchissement)
    const legend: [string, number][] = [['Poitrine : armure +25 %', C.zonePoitrine], ['Flancs : recharge −10 %', C.zoneFlancs], ['Ceinture : délai −15 %', C.zoneCeinture]];
    let lx = GRID_X;
    for (const [label, col] of legend) {
      g.fillStyle(col, 1);
      g.fillRoundedRect(lx, GRID_Y - 24, 14, 14, 3);
      const t = txt(this, lx + 20, GRID_Y - 26, label, 14, C.quiet);
      lx += 28 + t.width;
    }

    // Plateau du bas : vente + réserve (graphics dédié, dessiné au-dessus du panneau)
    panel(this, TRAY.x, TRAY.y, TRAY.w, TRAY.h);
    const tg = this.add.graphics();
    tg.fillStyle(C.danger, 0.12);
    tg.fillRoundedRect(SELL.x + 8, SELL.y + 8, SELL.w - 16, SELL.h - 16, 12);
    tg.lineStyle(2, C.danger, 0.6);
    tg.strokeRoundedRect(SELL.x + 8, SELL.y + 8, SELL.w - 16, SELL.h - 16, 12);
    txt(this, SELL.x + SELL.w / 2, SELL.y + SELL.h / 2 - 12, 'VENDRE', 18, C.dangerStr, { fontStyle: 'bold' }).setOrigin(0.5);
    txt(this, SELL.x + SELL.w / 2, SELL.y + SELL.h / 2 + 14, '50 %', 16, C.quiet).setOrigin(0.5);
    const slotW = RESERVE.w / RESERVE.slots;
    for (let i = 0; i < RESERVE.slots; i++) {
      tg.lineStyle(2, C.cellLine, 1);
      tg.strokeRoundedRect(RESERVE.x + i * slotW + 3, RESERVE.y + 32, slotW - 6, RESERVE.h - 42, 10);
    }
  }

  // ---------------------------------------------------------------- rafraîchissement

  private unlockedSet() {
    return new Set(this.run.unlocked);
  }

  private drawGrid() {
    const g = this.gridG;
    g.clear();
    const un = this.unlockedSet();
    const exp = this.run.extensions > 0 && this.editable() ? expandable(un) : new Set<string>();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const px = GRID_X + x * CELL;
        const py = GRID_Y + y * CELL;
        const z = cellZones(x, y);
        const fill = z.includes('ceinture') ? C.zoneCeinture : z.includes('poitrine') ? C.zonePoitrine : z.includes('flancs') ? C.zoneFlancs : C.cell;
        if (un.has(cellKey(x, y))) {
          g.fillStyle(fill, 1);
          g.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
        } else if (exp.has(cellKey(x, y))) {
          g.fillStyle(fill, 0.35);
          g.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
          g.lineStyle(3, C.good, 0.9);
          g.strokeRoundedRect(px + 5, py + 5, CELL - 10, CELL - 10, 8);
          g.fillStyle(C.good, 0.9);
          g.fillRect(px + CELL / 2 - 10, py + CELL / 2 - 2, 20, 4);
          g.fillRect(px + CELL / 2 - 2, py + CELL / 2 - 10, 4, 20);
        } else {
          g.fillStyle(fill, z.length ? 0.4 : 0.12);
          g.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
          g.lineStyle(1, C.cellLine, 0.5);
          g.strokeRect(px + 6, py + 6, CELL - 12, CELL - 12);
        }
      }
    }
    g.lineStyle(3, C.panelLine, 1);
    g.strokeRoundedRect(GRID_X - 6, GRID_Y - 6, COLS * CELL + 12, ROWS * CELL + 12, 12);
    this.extHint.setText(exp.size ? `+${this.run.extensions} case${this.run.extensions > 1 ? 's' : ''} à débloquer : touche une case verte` : '');
    this.extHint.setVisible(exp.size > 0);
  }

  private refresh() {
    const { loadout, links } = computeLoadout(this.run.items);
    this.drawGrid();

    // Objets posés
    this.itemLayer.removeAll(true);
    this.views.clear();
    for (const it of this.run.items.filter((i) => i.placed)) {
      const v = itemView(this, it, CELL).setPosition(GRID_X + it.x * CELL, GRID_Y + it.y * CELL);
      this.itemLayer.add(v);
      this.views.set(it.uid, v);
    }

    if (this.popUid !== null) {
      const v = this.views.get(this.popUid);
      if (v) pop(this, v);
      this.popUid = null;
    }

    // Liens de synergie sur les bords partagés ; les nouveaux s'allument.
    const keys = new Set(links.map((l) => `${l.a}-${l.b}`));
    const fresh = this.linkKeys ? links.filter((l) => !this.linkKeys!.has(`${l.a}-${l.b}`)) : [];
    this.linkKeys = keys;
    for (const l of fresh) this.synergyBurst(l);
    if (fresh.length) {
      toast(this, `Synergie : ${fresh[0].label}`, C.accentStr, 360);
      vibrate([12, 40, 12]);
    }
    // Paliers de famille nouvellement atteints
    const tiers = new Map(loadout.families.map((f) => [f.family, f.tier] as [string, number]));
    if (this.famTiers) {
      for (const f of loadout.families) {
        if (f.tier > (this.famTiers.get(f.family) ?? 0)) {
          const fi = FAMILY_INFO[f.family];
          this.time.delayedCall(fresh.length ? 700 : 0, () => toast(this, `${fi.name} palier ${f.tier === 2 ? 4 : 2} : ${f.tier === 2 ? fi.tier4 : fi.tier2}`, fi.hex, 430));
          this.cameras.main.flash(160, 255, 210, 140);
          vibrate([20, 50, 20]);
        }
      }
    }
    this.famTiers = tiers;
    this.linkG.clear();
    for (const l of links) {
      const { cx, cy, dx, dy } = l.edge;
      const ex = GRID_X + (cx + 0.5 + dx * 0.5) * CELL;
      const ey = GRID_Y + (cy + 0.5 + dy * 0.5) * CELL;
      this.linkG.fillStyle(C.accent, 1);
      if (dx !== 0) this.linkG.fillRoundedRect(ex - 5, ey - 22, 10, 44, 4);
      else this.linkG.fillRoundedRect(ex - 22, ey - 5, 44, 10, 4);
    }

    // Réserve
    this.trayLayer.removeAll(true);
    this.trayViews.clear();
    this.trayItems = reserve(this.run);
    const slotW = RESERVE.w / RESERVE.slots;
    this.trayItems.slice(0, RESERVE.slots).forEach((it, i) => {
      const { w, h } = dims(it);
      const s = Math.min((slotW - 16) / (w * CELL), (RESERVE.h - 80) / (h * CELL));
      const v = itemView(this, it, CELL).setScale(s);
      const sx = RESERVE.x + i * slotW;
      v.setPosition(sx + (slotW - w * CELL * s) / 2, RESERVE.y + 38 + (RESERVE.h - 80 - h * CELL * s) / 2);
      this.trayLayer.add(v);
      this.trayViews.set(it.uid, v);
      if (this.hidden.has(it.uid)) v.setVisible(false);
      this.trayLayer.add(txt(this, sx + slotW / 2, RESERVE.y + RESERVE.h - 24, RARITY_NAMES[it.rarity], 14, RARITY_HEX[it.rarity]).setOrigin(0.5));
    });
    this.reserveLabel.setText(`RÉSERVE ${this.trayItems.length}/${RESERVE_MAX} · n'agit pas en combat`);

    // Barre d'état
    const r = this.run;
    if (this.lastCredits >= 0 && r.credits !== this.lastCredits) {
      this.tweens.killTweensOf(this.statusText);
      this.statusText.setScale(1.18);
      this.tweens.add({ targets: this.statusText, scale: 1, duration: 300, ease: 'Back.Out' });
    }
    this.lastCredits = r.credits;
    this.statusText.setText(`Sursis ${'●'.repeat(r.sursis)}${'○'.repeat(Math.max(0, 3 - r.sursis))}   ${r.credits} cr`);
    this.statusRight.setText(`Z${r.stage + 1} · Tour ${Math.min(r.floor + 1, FLOORS)}/${FLOORS} · ${this.place}`);

    if (this.phase !== 'combat') this.drawPreview(loadout, links.length);
    this.updateButtons();
    saveRun(this.run);
  }

  private synergyBurst(l: { edge: { cx: number; cy: number; dx: number; dy: number } }) {
    const { cx, cy, dx, dy } = l.edge;
    const x = GRID_X + (cx + 0.5 + dx * 0.5) * CELL;
    const y = GRID_Y + (cy + 0.5 + dy * 0.5) * CELL;
    const g = this.add.graphics().setDepth(45).setPosition(x, y);
    g.lineStyle(4, C.accent, 1);
    g.strokeCircle(0, 0, 18);
    g.fillStyle(C.accent, 0.5);
    g.fillCircle(0, 0, 10);
    this.tweens.add({ targets: g, scale: 2.6, alpha: 0, duration: 520, ease: 'Quad.Out', onComplete: () => g.destroy() });
  }

  private drawPreview(loadout: ReturnType<typeof computeLoadout>['loadout'], nLinks: number) {
    const L = this.combatLayer;
    L.removeAll(true);
    const x0 = COMBAT.x + 24;
    let y = COMBAT.y + 20;
    L.add(txt(this, x0, y, `${OPERATOR.name.toUpperCase()} · ASSAUT`, 20, C.accentStr, { fontStyle: 'bold' }));
    y += 36;
    const rows: [string, string, string?][] = [
      ['PV / Armure', `${loadout.maxHp} / ${loadout.armor}`],
      ['DPS estimé', `${Math.round(estimateDps(loadout))}`],
      ['Gilet', `${this.run.unlocked.length}/${COLS * ROWS} cases`],
      ['Synergies', `${nLinks}`, nLinks ? C.accentStr : undefined],
    ];
    for (const [k, v, col] of rows) {
      L.add(txt(this, x0, y, k, 19, C.quiet));
      L.add(txt(this, x0 + 286, y, v, 19, col ?? C.text, { fontFamily: MONO, fontStyle: 'bold' }).setOrigin(1, 0));
      y += 30;
    }
    // Familles : progression vers les paliers 2 et 4
    y += 6;
    for (const f of loadout.families.slice(0, 4)) {
      const fi = FAMILY_INFO[f.family];
      const pips = Array.from({ length: 4 }, (_, i) => (i < f.count ? '●' : '○')).join('');
      L.add(txt(this, x0, y, fi.name, 17, f.tier ? fi.hex : C.quiet, { fontStyle: f.tier ? 'bold' : 'normal' }));
      L.add(txt(this, x0 + 120, y - 1, pips, 17, fi.hex));
      if (f.count > 4) L.add(txt(this, x0 + 200, y, `+${f.count - 4}`, 15, fi.hex));
      y += 24;
    }

    const x1 = COMBAT.x + 340;
    let y1 = COMBAT.y + 20;
    const info = NODE_INFO[this.node];
    L.add(txt(this, x1, y1, `${this.place.toUpperCase()} · ${info.name.toUpperCase()}`, 19, C.text, { fontStyle: 'bold', wordWrap: { width: 320 } }));
    y1 += 34;
    if (this.resultText) {
      L.add(txt(this, x1, y1, this.resultText, 21, C.text, { wordWrap: { width: 320 }, lineSpacing: 8 }));
    } else if (isCombat(this.node)) {
      for (const th of this.threats) {
        const ti = THREAT_INFO[th];
        L.add(txt(this, x1, y1, ti.name.toUpperCase(), 17, ti.hex, { fontStyle: 'bold' }));
        const eff = txt(this, x1, y1 + 22, ti.effect, 15, C.quiet, { wordWrap: { width: 320 } });
        L.add(eff);
        y1 += 28 + eff.height;
      }
      // Escouade regroupée par type
      const groups = new Map<string, { n: number; e: EnemyUnit }>();
      for (const e of this.enemies) {
        const g = groups.get(e.name);
        if (g) g.n++;
        else groups.set(e.name, { n: 1, e });
      }
      y1 += 4;
      for (const { n, e } of groups.values()) {
        const arm = e.armor ? ` · arm. ${e.armor}` : '';
        L.add(txt(this, x1, y1, `${n > 1 ? `${n}× ` : ''}${e.name}`, 18, e.boss ? C.accentStr : C.text, { fontStyle: 'bold' }));
        L.add(txt(this, x1, y1 + 22, `PV ${e.hp}${arm} · ${e.dmg.toFixed(1).replace('.', ',')} dgt / ${e.interval.toString().replace('.', ',')} s`, 15, C.quiet));
        y1 += 46;
      }
    } else {
      L.add(txt(this, x1, y1, info.desc, 20, C.quiet, { wordWrap: { width: 320 } }));
    }
  }

  private updateButtons() {
    const p = this.phase;
    this.mainBtn.setLabel(p === 'prep' ? 'PRÊT · lancer le combat' : p === 'combat' ? 'Combat en cours…' : p === 'over' ? 'Voir le bilan' : 'Continuer →');
    this.mainBtn.setEnabled(p !== 'combat' && !this.modal);
    this.altBtn.root.setVisible(this.node === 'marchand');
    this.speedBtn.root.setVisible(p === 'combat');
    this.skipBtn.root.setVisible(p === 'combat');
    this.speedBtn.setLabel(`×${this.run.speed}`);
  }

  // ---------------------------------------------------------------- entrées

  private editable() {
    return !this.modal && (this.phase === 'prep' || this.phase === 'post');
  }

  private gridCell(px: number, py: number): [number, number] | null {
    const cx = Math.floor((px - GRID_X) / CELL);
    const cy = Math.floor((py - GRID_Y) / CELL);
    return cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS ? [cx, cy] : null;
  }

  private traySlot(px: number, py: number): ItemInst | undefined {
    if (px < RESERVE.x || px > RESERVE.x + RESERVE.w || py < RESERVE.y || py > RESERVE.y + RESERVE.h) return undefined;
    return this.trayItems[Math.floor((px - RESERVE.x) / (RESERVE.w / RESERVE.slots))];
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (!this.editable()) return;
    let inst: ItemInst | undefined;
    let from: 'grid' | 'tray' = 'grid';
    const cell = this.gridCell(p.x, p.y);
    if (cell && this.run.extensions > 0 && expandable(this.unlockedSet()).has(cellKey(cell[0], cell[1]))) {
      this.unlockCell(cell[0], cell[1]);
      return;
    }
    if (cell) inst = itemAt(this.run.items, cell[0], cell[1]);
    if (!inst) {
      inst = this.traySlot(p.x, p.y);
      from = 'tray';
    }
    if (!inst) return;
    const { w, h } = dims(inst);
    const d: DragState = {
      inst, from, downX: p.x, downY: p.y, moved: false, rot: inst.rot,
      grabX: from === 'grid' ? p.x - (GRID_X + inst.x * CELL) : (w * CELL) / 2,
      grabY: from === 'grid' ? p.y - (GRID_Y + inst.y * CELL) : (h * CELL) / 2,
      lift: p.wasTouch ? 70 : 0,
    };
    d.longPress = this.time.delayedCall(LONG_PRESS_MS, () => {
      if (this.drag === d && !d.moved) {
        this.drag = null;
        vibrate(15);
        this.showInfo(d.inst);
      }
    });
    this.drag = d;
  }

  private unlockCell(x: number, y: number) {
    this.run.unlocked.push(cellKey(x, y));
    this.run.extensions--;
    vibrate(15);
    const fx = this.add.graphics().setDepth(45).setPosition(GRID_X + (x + 0.5) * CELL, GRID_Y + (y + 0.5) * CELL);
    fx.fillStyle(C.good, 0.6);
    fx.fillRoundedRect(-CELL / 2, -CELL / 2, CELL, CELL, 10);
    this.tweens.add({ targets: fx, scale: 1.5, alpha: 0, duration: 380, ease: 'Quad.Out', onComplete: () => fx.destroy() });
    const z = cellZones(x, y);
    if (z.length) toast(this, `Case débloquée · ${z.includes('ceinture') ? 'Ceinture' : z.includes('flancs') ? 'Flanc' : 'Poitrine'}`, C.goodStr, 360);
    this.refresh();
  }

  private onMove(p: Phaser.Input.Pointer) {
    const d = this.drag;
    if (!d || !p.isDown) return;
    if (!d.moved && Phaser.Math.Distance.Between(p.x, p.y, d.downX, d.downY) > DRAG_THRESHOLD) {
      d.moved = true;
      d.longPress?.remove();
      this.makeGhost(d);
      (d.from === 'grid' ? this.views : this.trayViews).get(d.inst.uid)?.setVisible(false);
    }
    if (d.moved) this.updateGhost(p.x, p.y);
  }

  private makeGhost(d: DragState) {
    d.ghost?.destroy();
    const ghost = this.add.container(0, 0).setDepth(50);
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.45);
    fillMask(shadow, maskOf(d.inst.defId, d.rot), CELL, 4, 12, 10, 14);
    ghost.add([shadow, itemView(this, { ...d.inst, rot: d.rot }, CELL)]);
    ghost.setSize(dims(d.inst, d.rot).w * CELL, dims(d.inst, d.rot).h * CELL);
    d.ghost = ghost;
  }

  private rotateDragged() {
    const d = this.drag;
    if (!d || !d.moved) return;
    d.rot = nextRot(d.rot);
    const { w, h } = dims(d.inst, d.rot);
    d.grabX = (w * CELL) / 2;
    d.grabY = (h * CELL) / 2;
    this.makeGhost(d);
    const p = this.input.activePointer;
    this.updateGhost(p.x, p.y);
  }

  /** Ancre (case haut-gauche) visée par le fantôme, et si le centre est au-dessus de la grille. */
  private dropAnchor(d: DragState, px: number, py: number) {
    const gx = px - d.grabX;
    const gy = py - d.grabY - d.lift;
    const { w, h } = dims(d.inst, d.rot);
    const ax = Math.round((gx - GRID_X) / CELL);
    const ay = Math.round((gy - GRID_Y) / CELL);
    const cxp = gx + (w * CELL) / 2;
    const cyp = gy + (h * CELL) / 2;
    const overGrid = cxp > GRID_X - CELL / 2 && cxp < GRID_X + COLS * CELL + CELL / 2 && cyp > GRID_Y - CELL / 2 && cyp < GRID_Y + ROWS * CELL + CELL / 2;
    return { gx, gy, ax, ay, w, h, overGrid };
  }

  private fuseTarget(d: DragState, ax: number, ay: number): ItemInst | undefined {
    const ov = overlapping(this.run.items, d.inst, ax, ay, d.rot);
    return ov.length === 1 && canFuse(ov[0], d.inst) ? ov[0] : undefined;
  }

  private updateGhost(px: number, py: number) {
    const d = this.drag;
    if (!d?.ghost) return;
    const a = this.dropAnchor(d, px, py);
    d.ghost.setPosition(a.gx, a.gy);
    this.previewG.clear();
    if (!a.overGrid) return;
    const valid = canPlace(this.run.items, d.inst, a.ax, a.ay, d.rot, this.unlockedSet());
    const fusion = !valid && this.fuseTarget(d, a.ax, a.ay);
    const col = valid ? C.good : fusion ? C.accent : C.danger;
    for (const [cx, cy] of cellsAt(d.inst, a.ax, a.ay, d.rot)) {
      if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) continue;
      this.previewG.fillStyle(col, 0.3);
      this.previewG.fillRoundedRect(GRID_X + cx * CELL + 3, GRID_Y + cy * CELL + 3, CELL - 6, CELL - 6, 8);
      this.previewG.lineStyle(2, col, 0.9);
      this.previewG.strokeRoundedRect(GRID_X + cx * CELL + 3, GRID_Y + cy * CELL + 3, CELL - 6, CELL - 6, 8);
    }
  }

  private onUp(p: Phaser.Input.Pointer) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    d.longPress?.remove();
    this.previewG.clear();
    if (!d.moved) {
      this.rotateInPlace(d.inst, d.from);
      return;
    }
    d.ghost?.destroy();
    const inst = d.inst;
    const inSell = p.x >= SELL.x && p.x <= SELL.x + SELL.w && p.y >= SELL.y && p.y <= SELL.y + SELL.h;
    const a = this.dropAnchor(d, p.x, p.y);

    if (inSell) {
      const v = sellValue(inst);
      this.run.credits += v;
      this.run.items = this.run.items.filter((i) => i.uid !== inst.uid);
      toast(this, `Vendu : +${v} cr`, C.accentStr);
      vibrate(10);
    } else if (a.overGrid) {
      const target = this.fuseTarget(d, a.ax, a.ay);
      if (canPlace(this.run.items, inst, a.ax, a.ay, d.rot, this.unlockedSet())) {
        Object.assign(inst, { x: a.ax, y: a.ay, rot: d.rot, placed: true });
        this.popUid = inst.uid;
        vibrate(8);
      } else if (target) {
        fuse(this.run, target, inst);
        this.popUid = target.uid;
        this.cameras.main.flash(180, 255, 200, 120);
        toast(this, `Fusion : ${ITEMS[target.defId].name} ${RARITY_NAMES[target.rarity]}`, RARITY_HEX[target.rarity]);
        vibrate(30);
      } else {
        toast(this, 'Pas la place ici', C.dangerStr);
        this.cameras.main.shake(120, 0.004);
      }
    } else if (this.traySlot(p.x, p.y) && canFuse(this.traySlot(p.x, p.y)!, inst)) {
      const target = this.traySlot(p.x, p.y)!;
      fuse(this.run, target, inst);
      this.cameras.main.flash(180, 255, 200, 120);
      toast(this, `Fusion : ${ITEMS[target.defId].name} ${RARITY_NAMES[target.rarity]}`, RARITY_HEX[target.rarity]);
      vibrate(30);
      this.refresh();
      const tv = this.trayViews.get(target.uid);
      if (tv) pop(this, tv, 1.4, 320);
      return;
    } else if (inst.placed) {
      if (reserve(this.run).length >= RESERVE_MAX) toast(this, 'Réserve pleine', C.dangerStr);
      else Object.assign(inst, { placed: false, rot: d.rot });
    } else {
      inst.rot = d.rot;
    }
    this.refresh();
  }

  private rotateInPlace(inst: ItemInst, from: 'grid' | 'tray') {
    const nr = nextRot(inst.rot);
    if (rotationIsNoop(inst.defId, inst.rot)) return;
    if (from === 'tray') {
      inst.rot = nr;
      this.refresh();
      return;
    }
    // Essaie de tourner sur place, sinon en décalant légèrement.
    const nd = dims(inst, nr);
    for (let dy = 0; dy < nd.h; dy++) {
      for (let dx = 0; dx < nd.w; dx++) {
        if (canPlace(this.run.items, inst, inst.x - dx, inst.y - dy, nr, this.unlockedSet())) {
          Object.assign(inst, { x: inst.x - dx, y: inst.y - dy, rot: nr });
          this.popUid = inst.uid;
          vibrate(8);
          this.refresh();
          return;
        }
      }
    }
    toast(this, 'Pas la place de tourner', C.dangerStr);
  }

  // ---------------------------------------------------------------- modales

  private closeModal() {
    this.modal?.destroy();
    this.modal = null;
    this.updateButtons();
  }

  private showInfo(inst: ItemInst) {
    const info = describe(inst);
    // Ouverte pendant un appui long : le relâchement du doigt ne doit pas la refermer.
    let armed = !this.input.activePointer.isDown;
    const m = modalBase(this, () => {
      if (!armed) {
        armed = true;
        return;
      }
      this.closeModal();
    });
    const h = 150 + info.lines.length * 40;
    const y = 640 - h / 2;
    m.add(panel(this, 40, y, W - 80, h, Phaser.Display.Color.HexStringToColor(RARITY_HEX[inst.rarity]).color));
    m.add(txt(this, 76, y + 30, info.title, 32, C.text, { fontStyle: 'bold' }));
    m.add(txt(this, 76, y + 74, info.subtitle, 22, RARITY_HEX[inst.rarity]));
    info.lines.forEach((l, i) => m.add(txt(this, 76, y + 124 + i * 40, l, 22, C.text, { wordWrap: { width: W - 150 } })));
    m.add(txt(this, W / 2, y + h + 30, 'Touche pour fermer', 20, C.quiet).setOrigin(0.5));
    this.modal = m;
    this.updateButtons();
  }

  private card(m: Container, x0: number, y0: number, w: number, h: number, inst: ItemInst, footer: string, footerCol: string, onTap: () => void, dim = false, delay = 0) {
    const cc = this.add.container(x0, y0);
    m.add(cc);
    const host = m;
    m = cc;
    const x = 0;
    const y = 0;
    if (delay >= 0) {
      cc.setAlpha(0).setY(y0 + 70);
      this.tweens.add({ targets: cc, y: y0, alpha: 1, delay, duration: 320, ease: 'Back.Out' });
    }
    void host;
    const g = this.add.graphics();
    g.fillStyle(C.panel, 1);
    g.fillRoundedRect(x, y, w, h, 14);
    g.lineStyle(3, Phaser.Display.Color.HexStringToColor(RARITY_HEX[inst.rarity]).color, dim ? 0.3 : 1);
    g.strokeRoundedRect(x, y, w, h, 14);
    m.add(g);
    const d = dims(inst);
    const s = Math.min((w - 30) / (d.w * CELL), 110 / (d.h * CELL));
    const v = itemView(this, inst, CELL).setScale(s);
    v.setPosition(x + (w - d.w * CELL * s) / 2, y + 16 + (110 - d.h * CELL * s) / 2);
    m.add(v);
    const info = describe(inst);
    m.add(txt(this, x + w / 2, y + 140, info.title, 20, C.text, { fontStyle: 'bold', align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5, 0));
    m.add(txt(this, x + w / 2, y + 196, RARITY_NAMES[inst.rarity], 18, RARITY_HEX[inst.rarity]).setOrigin(0.5, 0));
    m.add(txt(this, x + w / 2, y + 224, info.lines[0], 15, C.quiet, { align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5, 0));
    m.add(txt(this, x + w / 2, y + h - 30, footer, 20, footerCol, { fontStyle: 'bold' }).setOrigin(0.5));
    if (dim) v.setAlpha(0.35);
    const z = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    z.on('pointerdown', () => cc.setScale(0.97).setPosition(x0 + w * 0.015, cc.y + h * 0.015));
    z.on('pointerout', () => cc.setScale(1).setPosition(x0, y0));
    z.on('pointerup', () => {
      cc.setScale(1).setPosition(x0, y0);
      onTap();
    });
    m.add(z);
  }

  /** Butin qui jaillit d'un point (ennemi, caisse) puis vole vers sa case de réserve. */
  private flyToReserve(items: ItemInst[], from: { x: number; y: number }[], delay = 0) {
    items.forEach((it) => this.hidden.add(it.uid));
    this.refresh();
    items.forEach((it, i) => {
      const v = this.trayViews.get(it.uid);
      const src = from[i % from.length];
      const d = dims(it);
      const s0 = Math.min(0.6, 110 / (Math.max(d.w, d.h) * CELL));
      const f = itemView(this, it, CELL).setScale(s0).setDepth(60).setAlpha(0);
      f.setPosition(src.x - (d.w * CELL * s0) / 2, src.y - (d.h * CELL * s0) / 2);
      const t0 = delay + i * 280;
      this.tweens.add({ targets: f, alpha: 1, y: f.y - 50, delay: t0, duration: 260, ease: 'Back.Out' });
      this.tweens.add({
        targets: f,
        x: v ? v.x : RESERVE.x + RESERVE.w / 2,
        y: v ? v.y : RESERVE.y + 40,
        scale: v ? v.scaleX : 0.3,
        delay: t0 + 380,
        duration: 480,
        ease: 'Cubic.InOut',
        onComplete: () => {
          f.destroy();
          this.hidden.delete(it.uid);
          if (v) {
            v.setVisible(true);
            pop(this, v, 1.45, 320);
          }
          vibrate(10);
        },
      });
    });
  }

  private announceLoot(n: number, credits: number) {
    if (n) toast(this, `Butin : ${n} objet${n > 1 ? 's' : ''} → réserve`, C.accentStr, 930);
    if (credits) this.time.delayedCall(900, () => toast(this, `Réserve pleine : butin revendu +${credits} cr`, C.accentStr, 930));
  }

  /** Récompense des nœuds sans combat, donnée une seule fois par étage. */
  private claimNodeReward() {
    const r = this.run;
    if (r.claimedFloor === level(r)) return;
    r.claimedFloor = level(r);
    const center = { x: COMBAT.x + COMBAT.w / 2 + 120, y: COMBAT.y + 200 };
    if (this.node === 'caisse') {
      const { taken, credits } = addDrops(r, rollDrops(r, 2, 0, 'caisse', this.family));
      this.resultText = 'Caisse de ravitaillement ouverte.';
      this.flyToReserve(taken, [center]);
      this.announceLoot(taken.length, credits);
    } else if (this.node === 'planque') {
      r.extensions += EXTENSION_CELLS;
      if (r.sursis < START_SURSIS) {
        r.sursis++;
        this.resultText = `Repos à la planque :\n+1 sursis et ${EXTENSION_CELLS} cases\nde gilet à débloquer.`;
        banner(this, '+1 SURSIS', C.goodStr, 236);
      } else {
        r.credits += 8;
        this.resultText = `Sursis déjà au maximum :\n+8 crédits et ${EXTENSION_CELLS} cases\nde gilet à débloquer.`;
        banner(this, '+8 CR', C.accentStr, 236);
      }
      vibrate(30);
      this.refresh();
    }
  }

  private openShop() {
    if (this.modal) return;
    const offers = shopOffers(this.run);
    const m = modalBase(this);
    m.add(txt(this, W / 2, 190, 'MARCHAND', 36, C.text, { fontStyle: 'bold' }).setOrigin(0.5));
    m.add(txt(this, W / 2, 236, `Tu as ${this.run.credits} cr`, 24, C.accentStr).setOrigin(0.5));
    const cw = 320;
    const ch = 300;
    offers.forEach((o, i) => {
      const x = 30 + (i % 2) * (cw + 20);
      const y = 280 + Math.floor(i / 2) * (ch + 20);
      const afford = this.run.credits >= o.price;
      this.card(m, x, y, cw, ch, o.inst, o.sold ? 'Vendu' : `${o.price} cr`, o.sold ? C.quiet : afford ? C.accentStr : C.dangerStr, () => {
        if (o.sold) return;
        if (this.run.credits < o.price) return toast(this, 'Pas assez de crédits', C.dangerStr, 1040);
        if (reserve(this.run).length >= RESERVE_MAX) return toast(this, 'Réserve pleine', C.dangerStr, 1040);
        this.run.credits -= o.price;
        o.sold = true;
        takeItem(this.run, o.inst);
        vibrate(10);
        this.reopenShop(true);
      }, o.sold, this.shopAnimated ? -1 : i * 70);
    });
    const ext = extensionPrice(this.run);
    m.add(button(this, 30, 920, 660, 84, `Extension de gilet +${EXTENSION_CELLS} cases · ${ext} cr`, () => {
      if (this.run.credits < ext) return toast(this, 'Pas assez de crédits', C.dangerStr, 1140);
      this.run.credits -= ext;
      this.run.extBought++;
      this.run.extensions += EXTENSION_CELLS;
      vibrate([12, 40, 12]);
      this.closeModal();
      this.refresh();
      toast(this, `+${EXTENSION_CELLS} cases : touche les cases vertes du gilet`, C.goodStr, 900);
    }, { size: 22 }).root);
    m.add(button(this, 30, 1020, 320, 84, `Relancer (${REROLL_COST} cr)`, () => {
      if (this.run.credits < REROLL_COST) return toast(this, 'Pas assez de crédits', C.dangerStr, 1140);
      this.run.credits -= REROLL_COST;
      this.run.shop!.rerolls++;
      rollShop(this.run);
      this.reopenShop(false);
    }, { size: 22 }).root);
    m.add(button(this, 370, 1020, 320, 84, 'Fermer', () => {
      this.closeModal();
      this.refresh();
    }, { size: 22 }).root);
    this.modal = m;
    this.updateButtons();
  }

  private shopAnimated = false;

  private reopenShop(still: boolean) {
    this.closeModal();
    this.refresh();
    this.shopAnimated = still;
    this.openShop();
    this.shopAnimated = false;
  }

  // ---------------------------------------------------------------- flux du nœud

  private onMain() {
    if (this.modal) return;
    if (this.phase === 'prep') this.startCombat();
    else if (this.phase === 'post') this.continueRun();
    else if (this.phase === 'over') this.scene.start('end');
  }

  private continueRun() {
    if (!this.run.zone) {
      saveRun(this.run);
      this.scene.start('briefing');
      return;
    }
    this.run.floor++;
    this.run.shop = undefined;
    saveRun(this.run);
    this.scene.start('map');
  }

  private cycleSpeed() {
    this.run.speed = SPEEDS[(SPEEDS.indexOf(this.run.speed) + 1) % SPEEDS.length];
    this.updateButtons();
  }

  // ---------------------------------------------------------------- combat

  private startCombat() {
    const { loadout } = computeLoadout(this.run.items);
    this.run.attempts++;
    const result = simulate(loadout, this.enemies, hashParts(this.run.seed, this.run.stage, this.run.floor, 'combat', this.run.attempts), this.threats);
    this.phase = 'combat';
    this.resultText = '';
    const L = this.combatLayer;
    L.removeAll(true);
    const feet = COMBAT.y + COMBAT.h - 34;
    const player = this.makeActor(COMBAT.x + 130, feet, loadout.maxHp, loadout.armor, 'VIPER', 0xc8c2a8, 1, 1);
    const n = this.enemies.length;
    const xs = n === 1 ? [560] : n === 2 ? [480, 620] : [420, 530, 640];
    const enemies = this.enemies.map((e, i) =>
      this.makeActor(COMBAT.x + xs[i] - 20, feet, e.hp, e.armor, e.name, e.boss ? 0xff8c1a : 0x9a7f6a, e.boss ? 1.2 : 0.9, -1),
    );
    this.play = { result, idx: 0, t: 0, player, enemies };
    this.updateButtons();
  }

  private makeActor(x: number, feet: number, hp: number, armor: number, name: string, color: number, scale: number, dir: 1 | -1): Actor {
    const fig = this.add.container(x, feet).setScale(scale);
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillCircle(0, -92, 15);
    g.fillRoundedRect(-19, -74, 38, 46, 8);
    g.fillRect(-16, -30, 13, 30);
    g.fillRect(3, -30, 13, 30);
    g.fillStyle(0x2a2a2a, 1);
    g.fillRect(dir > 0 ? 6 : -46, -62, 40, 7);
    fig.add(g);
    const barW = 110;
    const bars = this.add.graphics();
    const hpText = txt(this, x, feet - 152 * scale - 2, '', 15, C.text, { fontFamily: MONO, fontStyle: 'bold' }).setOrigin(0.5);
    const label = txt(this, x, feet - 152 * scale - 46, name, 17, C.quiet).setOrigin(0.5);
    this.combatLayer.add([fig, bars, hpText, label]);
    const a: Actor = { x, feet, hp, maxHp: hp, armor, maxArmor: armor, fig, bars, hpText, barW, barY: feet - 152 * scale };
    this.drawBars(a);
    return a;
  }

  private drawBars(a: Actor) {
    const y = a.barY;
    const g = a.bars;
    const x0 = a.x - a.barW / 2;
    g.clear();
    g.fillStyle(0x000000, 0.6);
    g.fillRoundedRect(x0, y - 8, a.barW, 16, 4);
    g.fillStyle(a.hp / a.maxHp > 0.3 ? C.good : C.danger, 1);
    g.fillRoundedRect(x0, y - 8, Math.max(0, (a.barW * a.hp) / a.maxHp), 16, 4);
    if (a.maxArmor > 0) {
      g.fillStyle(0x000000, 0.6);
      g.fillRect(x0, y - 20, a.barW, 7);
      g.fillStyle(C.armor, 1);
      g.fillRect(x0, y - 20, (a.barW * a.armor) / a.maxArmor, 7);
    }
    a.hpText.setText(`${Math.ceil(a.hp)}`);
  }

  private actorOf(t: 'p' | number): Actor {
    return t === 'p' ? this.play!.player : this.play!.enemies[t];
  }

  private floatText(a: Actor, s: string, color: string, size = 26) {
    const sp = this.run.speed;
    const t = txt(this, a.x + Phaser.Math.Between(-18, 18), a.feet - 120, s, size, color, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(30)
      .setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 160 / sp, ease: 'Back.Out' });
    this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, delay: 250 / sp, duration: 550 / sp, ease: 'Quad.In', onComplete: () => t.destroy() });
  }

  /** Secousse d'écran + arrêt sur image, proportionnels à l'importance du coup. */
  private impact(tier: 'small' | 'medium' | 'large') {
    if (this.play === null) return;
    const cfg = { small: [60, 0.002, 0], medium: [110, 0.005, 0.05], large: [260, 0.011, 0.12] }[tier];
    this.cameras.main.shake(cfg[0], cfg[1]);
    this.freeze = Math.max(this.freeze, cfg[2]);
  }

  /** Recul et clignotement d'un personnage touché. */
  private hitReact(a: Actor) {
    const dir = a === this.play?.player ? -1 : 1;
    const x0 = a.x;
    this.tweens.killTweensOf(a.fig);
    a.fig.x = x0 + 9 * dir;
    a.fig.alpha = a.fig.alpha < 0.5 ? a.fig.alpha : 0.55;
    this.tweens.add({ targets: a.fig, x: x0, duration: 120 / this.run.speed, ease: 'Quad.Out' });
    if (a.hp > 0) this.tweens.add({ targets: a.fig, alpha: 1, duration: 120 / this.run.speed });
  }

  private tracer(from: Actor, to: Actor, color: number) {
    const g = this.add.graphics().setDepth(25);
    g.lineStyle(3, color, 1);
    g.lineBetween(from.x + (to.x > from.x ? 30 : -30), from.feet - 60, to.x, to.feet - 60);
    this.tweens.add({ targets: g, alpha: 0, duration: 140 / this.run.speed, onComplete: () => g.destroy() });
  }

  private boom(a: Actor, color = C.accent) {
    const g = this.add.graphics().setDepth(25).setPosition(a.x, a.feet - 60);
    g.fillStyle(color, 0.75);
    g.fillCircle(0, 0, 40);
    g.lineStyle(4, color, 1);
    g.strokeCircle(0, 0, 52);
    g.setScale(0.3);
    this.tweens.add({ targets: g, scale: 1.2, alpha: 0, duration: 380 / this.run.speed, ease: 'Quad.Out', onComplete: () => g.destroy() });
  }

  private applyEvent(e: CombatEvent, animate: boolean) {
    const P = this.play!;
    switch (e.kind) {
      case 'shot': {
        const to = this.actorOf(e.to);
        const from = this.actorOf(e.from);
        to.hp = e.hp;
        to.armor = e.armor;
        this.drawBars(to);
        if (!animate) break;
        this.tracer(from, to, e.from === 'p' ? C.accent : C.danger);
        if (e.miss) this.floatText(to, 'raté', C.quiet, 20);
        else this.floatText(to, `${e.amount}${e.crit ? '!' : ''}`, e.crit ? C.accentStr : e.to === 'p' ? C.dangerStr : C.text, e.crit ? 34 : 26);
        if (e.uid !== undefined) flashItem(this, this.views.get(e.uid), e.crit ? C.accent : 0xffffff);
        if (!e.miss) {
          this.hitReact(to);
          if (e.crit) this.impact('medium');
          else if (e.to === 'p' && e.amount >= 10) this.impact('small');
        }
        if (e.to === 'p' && !e.miss) vibrate(5);
        break;
      }
      case 'reload':
        if (animate) flashItem(this, this.views.get(e.uid), 0x4f9bff);
        break;
      case 'frag':
        for (const h of e.hits) {
          const a = P.enemies[h.to];
          a.hp = h.hp;
          a.armor = h.armor;
          this.drawBars(a);
          if (animate) {
            this.boom(a);
            this.hitReact(a);
            this.floatText(a, `${e.amount}`, C.accentStr, 30);
          }
        }
        if (animate) {
          flashItem(this, this.views.get(e.uid), C.accent);
          this.impact('medium');
        }
        break;
      case 'smoke':
        if (animate) {
          flashItem(this, this.views.get(e.uid), 0xaaaaaa);
          const g = this.add.graphics().setDepth(24);
          g.fillStyle(0xbfbfbf, 0.35);
          g.fillEllipse(COMBAT.x + 520, COMBAT.y + 200, 340, 200);
          this.tweens.add({ targets: g, alpha: 0, duration: ((e.until - e.t) * 1000) / this.run.speed, onComplete: () => g.destroy() });
        }
        break;
      case 'flash':
        if (animate) {
          flashItem(this, this.views.get(e.uid), 0xffffff);
          for (const a of P.enemies) if (a.hp > 0) this.floatText(a, 'ÉTOURDI', '#ffffff', 18);
          this.cameras.main.flash(120, 255, 255, 255);
        }
        break;
      case 'adrenaline':
        if (animate) {
          flashItem(this, this.views.get(e.uid), C.good);
          this.floatText(P.player, 'ADRÉNALINE', C.goodStr, 20);
        }
        break;
      case 'medic':
        for (const h of e.hits) {
          const a = P.enemies[h.to];
          a.hp = h.hp;
          this.drawBars(a);
          if (animate) this.floatText(a, `+${e.amount}`, C.goodStr, 20);
        }
        break;
      case 'heal':
        P.player.hp = e.hp;
        this.drawBars(P.player);
        if (animate) {
          this.floatText(P.player, `+${e.amount}`, C.goodStr, 30);
          flashItem(this, this.views.get(e.uid), C.good);
        }
        break;
      case 'enemyGrenade':
        P.player.hp = e.hp;
        P.player.armor = e.armor;
        this.drawBars(P.player);
        if (animate) {
          this.boom(P.player, C.danger);
          this.hitReact(P.player);
          this.floatText(P.player, `${e.amount}`, C.dangerStr, 30);
          this.impact('medium');
          vibrate(20);
        }
        break;
      case 'reflect': {
        const a = P.enemies[e.to];
        a.hp = e.hp;
        a.armor = e.armor;
        this.drawBars(a);
        if (animate) this.floatText(a, `${e.amount}`, '#f2c94c', 20);
        break;
      }
      case 'death': {
        const a = this.actorOf(e.who);
        if (animate) {
          this.tweens.killTweensOf(a.fig);
          this.tweens.add({ targets: a.fig, alpha: 0.25, angle: e.who === 'p' ? -80 : 80, duration: 300 / this.run.speed, ease: 'Quad.In' });
          this.impact(e.who === 'p' || this.play?.enemies.every((x) => x.hp <= 0) ? 'large' : 'medium');
          this.boom(a, e.who === 'p' ? C.danger : 0xffffff);
        }
        else a.fig.setAlpha(0.25).setAngle(e.who === 'p' ? -80 : 80);
        break;
      }
    }
  }

  update(_time: number, delta: number) {
    const P = this.play;
    if (!P) return;
    if (this.freeze > 0) {
      this.freeze -= delta / 1000;
      return;
    }
    P.t += (delta / 1000) * this.run.speed;
    const ev = P.result.events;
    while (P.idx < ev.length && ev[P.idx].t <= P.t) this.applyEvent(ev[P.idx++], true);
    if (P.idx >= ev.length && P.t >= P.result.duration + 0.8) this.finishCombat();
  }

  private skipCombat() {
    const P = this.play;
    if (!P) return;
    while (P.idx < P.result.events.length) this.applyEvent(P.result.events[P.idx++], false);
    this.finishCombat();
  }

  private finishCombat() {
    const P = this.play;
    if (!P) return;
    this.play = null;
    const r = this.run;
    // Chaque ennemi abattu lâche un objet, même en cas de défaite.
    const killedAt = P.enemies.filter((a) => a.hp <= 0).map((a) => ({ x: a.x, y: a.feet - 90 }));
    const loot = killedAt.length && !(P.result.win && this.node === 'boss' && this.finalZone)
      ? addDrops(r, rollDrops(r, killedAt.length, this.node === 'elite' || this.node === 'boss' ? 2 : 0, `combat-${r.attempts}`, this.family))
      : { taken: [] as ItemInst[], credits: 0 };
    loot.taken.forEach((it) => this.hidden.add(it.uid));
    if (P.result.win) {
      const gain = rewardCredits(this.node === 'boss' ? 'elite' : this.node, level(r));
      r.credits += gain;
      vibrate(40);
      if (this.node === 'boss' && completeZone(r)) {
        r.over = 'win';
        this.phase = 'over';
        this.resultText = 'Cdt Kesh neutralisé.\nL\'hélico est en approche : extraction !';
        banner(this, 'EXTRACTION', C.goodStr, 236);
      } else if (this.node === 'boss') {
        this.phase = 'post';
        this.resultText = `Lieutenant neutralisé, +${gain} crédits.\nExfiltration réussie : direction\nla zone suivante.`;
        banner(this, 'ZONE TERMINÉE', C.goodStr, 236);
        toast(this, `+${gain} crédits`, C.accentStr, 330);
      } else {
        this.phase = 'post';
        this.resultText = `Victoire en ${Math.round(P.result.duration)} s.\n+${gain} crédits.\nRange ton butin puis continue.`;
        banner(this, 'VICTOIRE', C.goodStr, 236);
        toast(this, `+${gain} crédits`, C.accentStr, 330);

      }
    } else {
      r.sursis--;
      r.credits += 3;
      vibrate(120);
      if (r.sursis <= 0) {
        r.over = 'lose';
        this.phase = 'over';
        this.resultText = 'Plus aucun sursis.\nLa run est terminée.';
        banner(this, 'DÉFAITE', C.dangerStr, 236);
      } else if (this.node === 'boss') {
        this.phase = 'prep';
        this.resultText = `${P.result.timeout ? 'Temps écoulé' : 'Défaite'} : −1 sursis.\n${this.finalZone ? 'Le Cdt Kesh' : 'Le lieutenant'} t'attend toujours.\nRéorganise ton gilet et retente.`;
        banner(this, 'DÉFAITE', C.dangerStr, 236);
        toast(this, '−1 sursis', C.dangerStr, 330);
      } else {
        this.phase = 'post';
        this.resultText = `${P.result.timeout ? 'Temps écoulé' : 'Défaite'} : −1 sursis, +3 cr.\nTu continues malgré tout.`;
        banner(this, 'DÉFAITE', C.dangerStr, 236);
        toast(this, '−1 sursis', C.dangerStr, 330);
      }
    }
    this.refresh();
    if (loot.taken.length || loot.credits) {
      this.time.delayedCall(900, () => {
        this.flyToReserve(loot.taken, killedAt);
        this.announceLoot(loot.taken.length, loot.credits);
      });
    }
  }
}
