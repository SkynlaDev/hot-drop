import Phaser from 'phaser';
import { C, H, W } from '../config';
import { BOSS_THREATS, THREAT_INFO, Threat } from '../data/threats';
import { rngFor } from '../logic/rng';
import { NODE_INFO, NodeType, RunState, START_SURSIS, saveRun } from '../logic/run';
import { EARLY_EXFIL_TURN, EXFIL_ID, MAP_SIZE, MOVE_RANGE, Poi, TURNS, dist, gasRadius, inSafeZone, options, posOf } from '../logic/zone';
import { Button, button, fadeIn, panel, txt, vibrate } from '../ui/widgets';

const MAP = { x: 20, y: 128, w: 680, h: 680 };
const K = MAP.w / MAP_SIZE;
const PANEL = { x: 20, y: 824, w: 680, h: 440 };

const NODE_COLORS: Record<NodeType, number> = {
  contrat: 0xd8d0b0,
  elite: 0xe5484d,
  marchand: 0xf2c94c,
  caisse: 0x5fbf6a,
  planque: 0x4f9bff,
  boss: 0xff8c1a,
};
const GAS = 0x9bbf3a;

type Target = { kind: 'poi'; poi: Poi } | { kind: 'exfil' };

export default class MapScene extends Phaser.Scene {
  private run!: RunState;
  private gasG!: Phaser.GameObjects.Graphics;
  private marker!: Phaser.GameObjects.Container;
  private selG!: Phaser.GameObjects.Graphics;
  private info!: Phaser.GameObjects.Container;
  private goBtn!: Button;
  private selected: Target | null = null;
  private reachable = new Set<number>();
  private exfilOk = false;
  private busy = false;

  constructor() {
    super('map');
  }

  init() {
    this.run = this.registry.get('run');
    this.selected = null;
    this.busy = false;
  }

  private sx(x: number) {
    return MAP.x + x * K;
  }
  private sy(y: number) {
    return MAP.y + y * K;
  }

  create() {
    fadeIn(this);
    const z = this.run.zone;
    const turn = this.run.floor;
    const opts = options(z, turn);
    this.reachable = new Set(opts.pois.map((p) => p.id));
    this.exfilOk = opts.exfil;

    this.drawTerrain();

    // Gaz actuel et prochaine zone sûre (pointillés)
    this.gasG = this.add.graphics();
    this.drawGas(gasRadius(Math.max(0, turn - 1)));
    this.tweens.add({ targets: this.gasG, alpha: 0.82, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.InOut' });
    const next = this.add.graphics();
    this.dashedCircle(next, this.sx(z.exfil.x), this.sy(z.exfil.y), gasRadius(turn) * K, 0xffffff, 0.75);

    // Portée de déplacement
    const here = posOf(z);
    if (here && !opts.forced) {
      const rg = this.add.graphics();
      rg.fillStyle(C.accent, 0.06);
      rg.fillCircle(this.sx(here.x), this.sy(here.y), MOVE_RANGE * K);
      rg.lineStyle(2, C.accent, 0.3);
      rg.strokeCircle(this.sx(here.x), this.sy(here.y), MOVE_RANGE * K);
    }

    this.selG = this.add.graphics();
    this.drawPois(turn);
    this.drawExfil();

    // Marqueur du joueur
    this.marker = this.add.container(here ? this.sx(here.x) : -100, here ? this.sy(here.y) : -100).setDepth(20);
    const mg = this.add.graphics();
    mg.fillStyle(C.accent, 1);
    mg.fillCircle(0, 0, 11);
    mg.lineStyle(3, 0xffffff, 1);
    mg.strokeCircle(0, 0, 11);
    const ring = this.add.graphics();
    ring.lineStyle(3, C.accent, 1);
    ring.strokeCircle(0, 0, 14);
    this.marker.add([ring, mg]);
    this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, repeat: -1, duration: 1100, ease: 'Quad.Out' });
    this.marker.setVisible(!!here);

    this.drawFrameAndHud(turn);
    this.info = this.add.container(0, 0).setDepth(31);
    this.goBtn = button(this, PANEL.x + 220, PANEL.y + PANEL.h - 104, PANEL.w - 220, 92, '', () => this.go(), { primary: true });
    this.goBtn.root.setDepth(31);
    button(this, PANEL.x, PANEL.y + PANEL.h - 104, 204, 92, 'Menu', () => this.scene.start('menu'), { size: 24 }).root.setDepth(31);

    if (opts.forced) this.select({ kind: 'exfil' });
    else this.showInfo();
  }

  // ---------------------------------------------------------------- dessin

  private drawTerrain() {
    const rng = rngFor(this.run.seed, 'terrain');
    const g = this.add.graphics();
    g.fillStyle(0x1c2217, 1);
    g.fillRect(MAP.x, MAP.y, MAP.w, MAP.h);
    const tones = [0x232b1c, 0x2a291d, 0x1e2924, 0x262f1f];
    for (let i = 0; i < 26; i++) {
      g.fillStyle(tones[i % tones.length], 0.9);
      g.fillEllipse(MAP.x + rng() * MAP.w, MAP.y + rng() * MAP.h, 60 + rng() * 180, 40 + rng() * 120);
    }
    // Rivière
    g.lineStyle(14, 0x22343a, 1);
    const pts: Phaser.Math.Vector2[] = [];
    const y0 = MAP.y + MAP.h * (0.2 + rng() * 0.6);
    for (let i = 0; i <= 12; i++) pts.push(new Phaser.Math.Vector2(MAP.x + (i / 12) * MAP.w, y0 + Math.sin(i * 0.9 + rng()) * 50));
    g.strokePoints(pts, false);
    // Quadrillage tactique
    g.lineStyle(1, 0x000000, 0.18);
    for (let i = 1; i < 10; i++) {
      g.lineBetween(MAP.x + i * 100 * K, MAP.y, MAP.x + i * 100 * K, MAP.y + MAP.h);
      g.lineBetween(MAP.x, MAP.y + i * 100 * K, MAP.x + MAP.w, MAP.y + i * 100 * K);
    }
    // Routes : chaque lieu relié à ses 2 voisins les plus proches
    const z = this.run.zone;
    const nodes = [...z.pois, { id: EXFIL_ID, ...z.exfil }];
    const done = new Set<string>();
    g.lineStyle(5, 0x3e4334, 1);
    for (const a of nodes) {
      const near = nodes.filter((b) => b !== a).sort((p, q) => dist(a, p) - dist(a, q)).slice(0, 2);
      for (const b of near) {
        const key = [a.id, b.id].sort().join('/');
        if (done.has(key)) continue;
        done.add(key);
        g.lineBetween(this.sx(a.x), this.sy(a.y), this.sx(b.x), this.sy(b.y));
      }
    }
  }

  private drawGas(r: number) {
    const z = this.run.zone;
    const g = this.gasG;
    g.clear();
    const cx = this.sx(z.exfil.x);
    const cy = this.sy(z.exfil.y);
    const R = r * K;
    const R2 = R + 1400;
    // Anneau plein (triangles) : du bord de la zone sûre jusqu'au-delà de la carte.
    g.fillStyle(GAS, 0.3);
    const n = 96;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      g.fillPoints([
        new Phaser.Math.Vector2(cx + c0 * R, cy + s0 * R),
        new Phaser.Math.Vector2(cx + c0 * R2, cy + s0 * R2),
        new Phaser.Math.Vector2(cx + c1 * R2, cy + s1 * R2),
        new Phaser.Math.Vector2(cx + c1 * R, cy + s1 * R),
      ], true);
    }
    g.lineStyle(4, 0xd4ec6a, 0.95);
    g.strokeCircle(cx, cy, R);
  }

  private dashedCircle(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, color: number, alpha: number) {
    g.lineStyle(2, color, alpha);
    const n = Math.max(24, Math.round(r / 6));
    for (let i = 0; i < n; i += 2) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      g.lineBetween(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
    }
  }

  private drawPois(turn: number) {
    const z = this.run.zone;
    for (const p of z.pois) {
      const x = this.sx(p.x);
      const y = this.sy(p.y);
      const visited = z.visited.includes(p.id);
      const reach = this.reachable.has(p.id);
      const gassed = !visited && !inSafeZone(z, p, turn);
      const col = NODE_COLORS[p.type];
      if (reach) {
        const halo = this.add.graphics();
        halo.lineStyle(3, col, 1);
        halo.strokeCircle(x, y, 26);
        this.tweens.add({ targets: halo, alpha: 0.2, yoyo: true, repeat: -1, duration: 700 });
      }
      const g = this.add.graphics();
      g.fillStyle(0x111410, 1);
      g.fillCircle(x, y, 20);
      g.fillStyle(col, visited ? 0.25 : reach ? 0.9 : 0.55);
      g.fillCircle(x, y, 17);
      const alpha = visited ? 0.45 : gassed ? 0.3 : reach ? 1 : 0.65;
      g.setAlpha(alpha);
      txt(this, x, y, visited ? '✓' : NODE_INFO[p.type].letter, 18, '#111410', { fontStyle: 'bold' }).setOrigin(0.5).setAlpha(alpha);
      txt(this, x, y + 30, p.name, 15, reach ? C.text : C.quiet, { fontStyle: reach ? 'bold' : 'normal', stroke: '#0d0f0a', strokeThickness: 4 })
        .setOrigin(0.5)
        .setAlpha(alpha);
      p.threats.forEach((th, i) => this.threatBadge(x + 20 + i * 22, y - 18, th, alpha));
      const zone = this.add.zone(x, y + 8, 76, 70).setInteractive({ useHandCursor: reach });
      zone.on('pointerup', () => {
        if (this.busy) return;
        if (reach) this.select({ kind: 'poi', poi: p });
        else this.reject(visited ? 'Déjà visité' : gassed ? 'Pris dans le gaz' : 'Hors de portée');
      });
    }
  }

  private threatBadge(x: number, y: number, th: Threat, alpha = 1) {
    const ti = THREAT_INFO[th];
    const g = this.add.graphics().setAlpha(alpha);
    g.fillStyle(0x0d0f0a, 1);
    g.fillRoundedRect(x - 12, y - 9, 24, 18, 6);
    g.lineStyle(2, ti.color, 1);
    g.strokeRoundedRect(x - 12, y - 9, 24, 18, 6);
    txt(this, x, y, ti.short, 11, ti.hex, { fontStyle: 'bold' }).setOrigin(0.5).setAlpha(alpha);
  }

  private drawExfil() {
    const z = this.run.zone;
    const x = this.sx(z.exfil.x);
    const y = this.sy(z.exfil.y);
    if (this.exfilOk) {
      const halo = this.add.graphics();
      halo.lineStyle(3, NODE_COLORS.boss, 1);
      halo.strokeCircle(x, y, 32);
      this.tweens.add({ targets: halo, alpha: 0.2, yoyo: true, repeat: -1, duration: 600 });
    }
    const g = this.add.graphics();
    g.fillStyle(0x111410, 1);
    g.fillCircle(x, y, 26);
    g.fillStyle(NODE_COLORS.boss, this.exfilOk ? 1 : 0.6);
    g.fillCircle(x, y, 22);
    // Drapeau
    g.fillStyle(0x111410, 1);
    g.fillRect(x - 7, y - 12, 3, 24);
    g.fillTriangle(x - 4, y - 12, x + 11, y - 6, x - 4, y);
    BOSS_THREATS.forEach((th, i) => this.threatBadge(x + 26 + i * 22, y - 22, th));
    txt(this, x, y + 38, 'EXFIL', 16, C.accentStr, { fontStyle: 'bold', stroke: '#0d0f0a', strokeThickness: 4 }).setOrigin(0.5);
    const zone = this.add.zone(x, y + 8, 84, 80).setInteractive({ useHandCursor: this.exfilOk });
    zone.on('pointerup', () => {
      if (this.busy) return;
      if (this.exfilOk) this.select({ kind: 'exfil' });
      else this.reject(this.run.floor < EARLY_EXFIL_TURN ? `Exfiltration possible dès le tour ${EARLY_EXFIL_TURN + 1}` : 'Hors de portée');
    });
  }

  private drawFrameAndHud(turn: number) {
    // Caches opaques autour de la carte : le gaz est dessiné plus grand que la carte.
    const g = this.add.graphics().setDepth(30);
    g.fillStyle(C.bg, 1);
    g.fillRect(0, 0, W, MAP.y);
    g.fillRect(0, MAP.y + MAP.h, W, H - MAP.y - MAP.h);
    g.fillRect(0, 0, MAP.x, H);
    g.fillRect(MAP.x + MAP.w, 0, W - MAP.x - MAP.w, H);
    g.lineStyle(3, C.panelLine, 1);
    g.strokeRoundedRect(MAP.x - 2, MAP.y - 2, MAP.w + 4, MAP.h + 4, 6);
    panel(this, PANEL.x, PANEL.y, PANEL.w, PANEL.h).setDepth(30);

    const r = this.run;
    txt(this, 24, 34, 'ZONE DE VESTRA', 30, C.text, { fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(31);
    txt(this, W - 24, 34, `GAZ · TOUR ${Math.min(turn + 1, TURNS)}/${TURNS}`, 24, '#d4ec6a', { fontStyle: 'bold' }).setOrigin(1, 0.5).setDepth(31);
    txt(this, 24, 84, `Sursis ${'●'.repeat(r.sursis)}${'○'.repeat(Math.max(0, START_SURSIS - r.sursis))}   ${r.credits} cr`, 24, C.quiet).setOrigin(0, 0.5).setDepth(31);
    txt(this, W - 24, 84, '- - -  prochaine zone sûre', 18, C.quiet).setOrigin(1, 0.5).setDepth(31);
  }

  // ---------------------------------------------------------------- sélection

  private reject(msg: string) {
    vibrate(20);
    this.cameras.main.shake(100, 0.003);
    this.showInfo(msg);
  }

  private select(t: Target) {
    this.selected = t;
    vibrate(8);
    const z = this.run.zone;
    const here = posOf(z);
    const to = t.kind === 'poi' ? t.poi : z.exfil;
    this.selG.clear();
    if (here) {
      this.selG.lineStyle(4, C.accent, 0.9);
      const x0 = this.sx(here.x);
      const y0 = this.sy(here.y);
      const x1 = this.sx(to.x);
      const y1 = this.sy(to.y);
      const n = Math.max(2, Math.round(Phaser.Math.Distance.Between(x0, y0, x1, y1) / 14));
      for (let i = 0; i < n; i += 2) {
        this.selG.lineBetween(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, x0 + ((x1 - x0) * (i + 1)) / n, y0 + ((y1 - y0) * (i + 1)) / n);
      }
    }
    this.selG.lineStyle(4, 0xffffff, 1);
    this.selG.strokeCircle(this.sx(to.x), this.sy(to.y), t.kind === 'exfil' ? 34 : 28);
    this.showInfo();
  }

  private threat(type: NodeType): number {
    if (type === 'boss') return 5;
    if (type === 'elite') return Math.min(5, 2 + Math.floor(this.run.floor / 2));
    if (type === 'contrat') return Math.min(4, 1 + Math.floor(this.run.floor / 2));
    return 0;
  }

  private showInfo(warning?: string) {
    const I = this.info;
    I.removeAll(true);
    const x0 = PANEL.x + 28;
    let y = PANEL.y + 26;
    const t = this.selected;
    const landing = this.run.zone.pos === -1;
    if (!t) {
      I.add(txt(this, x0, y, landing ? 'Choisis ton point de largage' : 'Choisis ta destination', 30, C.text, { fontStyle: 'bold' }));
      I.add(txt(this, x0, y + 52, landing
        ? 'Tu peux atterrir n\'importe où dans la zone.\nLe gaz se resserrera ensuite vers l\'exfiltration.'
        : 'Les lieux à portée clignotent. Le gaz avance\nà chaque tour : ne reste pas à la traîne.', 21, C.quiet, { lineSpacing: 8 }));
      if (warning) I.add(txt(this, x0, y + 150, warning, 22, C.dangerStr, { fontStyle: 'bold' }));
      this.goBtn.setLabel(landing ? 'Larguer ▸' : 'Y aller ▸');
      this.goBtn.setEnabled(false);
      return;
    }
    const type: NodeType = t.kind === 'poi' ? t.poi.type : 'boss';
    const name = t.kind === 'poi' ? t.poi.name : 'Point d\'exfiltration';
    const col = Phaser.Display.Color.IntegerToColor(NODE_COLORS[type]).rgba;
    I.add(txt(this, x0, y, name, 34, C.text, { fontStyle: 'bold' }));
    I.add(txt(this, PANEL.x + PANEL.w - 28, y + 8, NODE_INFO[type].name.toUpperCase(), 22, col, { fontStyle: 'bold' }).setOrigin(1, 0));
    y += 56;
    const early = t.kind === 'exfil' && this.run.floor < TURNS - 1;
    const desc = t.kind === 'exfil'
      ? early
        ? 'Extraction anticipée : le Cdt Kesh garde le point.\nGagne et la run est finie, plus tôt que prévu.'
        : 'Le gaz s\'est refermé. Le Cdt Kesh garde le\npoint d\'exfiltration : bats-le pour t\'extraire.'
      : NODE_INFO[type].desc;
    I.add(txt(this, x0, y, desc, 21, C.quiet, { wordWrap: { width: PANEL.w - 56 }, lineSpacing: 6 }));
    y += 64;
    const th = this.threat(type);
    if (th > 0) {
      I.add(txt(this, x0, y, 'Menace', 21, C.quiet));
      const g = this.add.graphics();
      for (let i = 0; i < 5; i++) {
        g.fillStyle(i < th ? C.danger : C.cellLine, 1);
        g.fillRoundedRect(x0 + 110 + i * 34, y + 2, 28, 20, 4);
      }
      I.add(g);
    }
    const threats = t.kind === 'poi' ? t.poi.threats : BOSS_THREATS;
    let ty = y + 38;
    for (const th of threats) {
      const ti = THREAT_INFO[th];
      I.add(txt(this, x0, ty, ti.name.toUpperCase(), 19, ti.hex, { fontStyle: 'bold' }));
      I.add(txt(this, x0 + 190, ty + 1, ti.effect, 17, C.text, { wordWrap: { width: PANEL.w - 250 } }));
      I.add(txt(this, x0 + 190, ty + 24, `Contre : ${ti.counters}`, 15, C.quiet, { wordWrap: { width: PANEL.w - 250 } }));
      ty += 56;
    }
    if (warning) I.add(txt(this, x0, ty + 4, warning, 22, C.dangerStr, { fontStyle: 'bold' }));
    this.goBtn.setLabel(t.kind === 'exfil' ? 'Exfiltration ▸' : landing ? `Larguer · ${name} ▸` : `Aller · ${name} ▸`);
    this.goBtn.setEnabled(true);
  }

  // ---------------------------------------------------------------- déplacement

  private go() {
    const t = this.selected;
    if (!t || this.busy) return;
    this.busy = true;
    this.goBtn.setEnabled(false);
    const run = this.run;
    const z = run.zone;
    const landing = z.pos === -1;
    const to = t.kind === 'poi' ? t.poi : z.exfil;
    const node: NodeType = t.kind === 'poi' ? t.poi.type : 'boss';
    const place = t.kind === 'poi' ? t.poi.name : 'Exfiltration';
    z.pos = t.kind === 'poi' ? t.poi.id : EXFIL_ID;
    if (t.kind === 'poi') z.visited.push(t.poi.id);
    saveRun(run);
    vibrate(15);

    const tx = this.sx(to.x);
    const ty = this.sy(to.y);
    if (landing) {
      this.marker.setPosition(tx, ty - 220).setVisible(true).setAlpha(0);
      this.tweens.add({ targets: this.marker, y: ty, alpha: 1, duration: 650, ease: 'Bounce.Out' });
    } else {
      this.tweens.add({ targets: this.marker, x: tx, y: ty, duration: 700, ease: 'Cubic.InOut' });
    }
    // Le gaz avance jusqu'à la prochaine zone sûre.
    const state = { r: gasRadius(Math.max(0, run.floor - 1)) };
    this.tweens.add({
      targets: state,
      r: gasRadius(run.floor),
      delay: 500,
      duration: 700,
      ease: 'Quad.InOut',
      onUpdate: () => this.drawGas(state.r),
      onComplete: () => {
        this.cameras.main.fadeOut(220, 20, 22, 15);
        this.time.delayedCall(240, () => this.scene.start('loadout', { node, place, threats: t.kind === 'poi' ? t.poi.threats : BOSS_THREATS }));
      },
    });
  }
}
