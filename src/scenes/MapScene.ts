// Carte battle royale : zones de tailles différentes, cercle de gaz qui se resserre à chaque manche.
// Le joueur choisit une zone dans le cercle et s'y largue.
import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { C, H, W, TITLE_FONT } from '../config';
import { rngFor } from '../logic/rng';
import { RunState, dropInZone, finalDuelParams, saveRun, selectableZones } from '../logic/run';
import { CARDS_BY_SIZE, CARD_WEIGHTS, CardType, Circle, EPIC_CRATE_CHANCE, MAP_SIZE, MapZone, ROUNDS, ZONE_RADIUS, circle, dist, isGassed } from '../logic/zone';
import { CARD_INFO, EPIC_GOLD, SIZE_INFO, THEME_INFO, iconButton, roundTrack, statusPills } from '../ui/hud';
import { Button, banner, button, fadeIn, panel, pop, toast, txt, vibrate } from '../ui/widgets';

const MAP = { x: 20, y: 150, w: 680, h: 680 };
const K = MAP.w / MAP_SIZE;
const PANEL = { x: 20, y: 846, w: 680, h: 414 };
const GAS = 0xb5d65a;

const HEAT_DESC: Record<MapZone['size'], string> = {
  petite: 'Zone calme : peu d’Élites, des bots sans bonus. Plus de caisses et de boutiques.',
  moyenne: 'Zone disputée : un peu de tout. Bots un peu plus forts à partir du 2e cercle.',
  grande: 'Zone chaude : beaucoup d’Élites, bots plus forts à partir du 2e cercle. Parfois une caisse épique !',
};

interface ZoneView {
  zone: MapZone;
  root: Phaser.GameObjects.Container;
}

export default class MapScene extends Phaser.Scene {
  private run!: RunState;
  private gasG!: Phaser.GameObjects.Graphics;
  private selG!: Phaser.GameObjects.Graphics;
  private info!: Phaser.GameObjects.Container;
  private goBtn!: Button;
  private views: ZoneView[] = [];
  private selected: MapZone | null = null;
  private busy = false;

  constructor() {
    super('map');
  }

  init() {
    this.run = this.registry.get('run');
    this.selected = null;
    this.busy = false;
    this.views = [];
  }

  private sx(x: number) {
    return MAP.x + x * K;
  }
  private sy(y: number) {
    return MAP.y + y * K;
  }

  create() {
    const run = this.run;
    if (!run) {
      this.scene.start('menu');
      return;
    }
    // Aiguillage : la carte ne s'affiche que si le joueur doit choisir une zone.
    if (run.over) {
      this.scene.start('end');
      return;
    }
    if (run.fight || run.pendingGoulag || run.pendingLoot) {
      this.scene.start('loadout', { mode: 'duel' });
      return;
    }
    if (run.resupply) {
      // Le cercle s'est resserré : ravitaillement d'abord.
      this.scene.start('loadout', { mode: 'shop' });
      return;
    }
    if (run.zoneId !== null) {
      this.scene.start('zone');
      return;
    }
    const seen = this.registry.get('mapSeen') as { seed: number; round: number } | undefined;
    const shrink = !!seen && seen.seed === run.seed && seen.round < run.round;
    this.registry.set('mapSeen', { seed: run.seed, round: run.round });
    const final = run.round >= ROUNDS;
    if (final && !shrink) {
      this.startFinal();
      return;
    }

    fadeIn(this);
    this.drawTerrain();
    const from = shrink ? circle(run.map, run.round - 1) : circle(run.map, run.round);
    const to = circle(run.map, run.round);
    this.gasG = this.add.graphics();
    this.drawGas(from);
    if (!final && run.round + 1 < ROUNDS) this.dashedCircle(circle(run.map, run.round + 1));
    this.selG = this.add.graphics().setDepth(5);
    this.drawZones(shrink ? run.round - 1 : run.round);
    this.drawHud();

    this.info = this.add.container(0, 0).setDepth(31);
    this.goBtn = button(this, PANEL.x + 196, PANEL.y + PANEL.h - 112, PANEL.w - 196 - 24, 92, 'Larguer ▸', () => this.drop(), { primary: true });
    this.goBtn.root.setDepth(31);
    button(this, PANEL.x + 24, PANEL.y + PANEL.h - 112, 156, 92, 'Sac', () => this.scene.start('loadout', { mode: 'manage' }), { size: 26 }).root.setDepth(31);
    this.showInfo();

    if (shrink) {
      this.busy = true;
      this.time.delayedCall(350, () => this.animateShrink(from, to, final));
    }
  }

  // ---------------------------------------------------------------- dessin

  private drawTerrain() {
    const rng = rngFor(this.run.seed, 'terrain');
    const g = this.add.graphics();
    g.fillStyle(0x342e3c, 1);
    g.fillRect(MAP.x, MAP.y, MAP.w, MAP.h);
    const tones = [0x3e3746, 0x2b2632, 0x3e3746, 0x342e3c];
    for (let i = 0; i < 30; i++) {
      g.fillStyle(tones[i % tones.length], 0.9);
      g.fillEllipse(MAP.x + rng() * MAP.w, MAP.y + rng() * MAP.h, 60 + rng() * 200, 40 + rng() * 140);
    }
    // Forêts : amas de petits cercles sombres
    for (let i = 0; i < 9; i++) {
      const fx = MAP.x + rng() * MAP.w;
      const fy = MAP.y + rng() * MAP.h;
      g.fillStyle(0x2b2632, 0.9);
      for (let j = 0; j < 14; j++) g.fillCircle(fx + (rng() - 0.5) * 90, fy + (rng() - 0.5) * 70, 7 + rng() * 9);
    }
    // Rivière
    const pts: Phaser.Math.Vector2[] = [];
    const x0 = MAP.x + MAP.w * (0.25 + rng() * 0.5);
    const ph = rng() * 6;
    for (let i = 0; i <= 14; i++) pts.push(new Phaser.Math.Vector2(x0 + Math.sin(i * 0.7 + ph) * 60, MAP.y + (i / 14) * MAP.h));
    g.lineStyle(22, 0x22465a, 1);
    g.strokePoints(pts, false);
    g.lineStyle(10, 0x22465a, 1);
    g.strokePoints(pts, false);
    // Quadrillage tactique
    g.lineStyle(1, 0x000000, 0.2);
    for (let i = 1; i < 10; i++) {
      g.lineBetween(MAP.x + i * 100 * K, MAP.y, MAP.x + i * 100 * K, MAP.y + MAP.h);
      g.lineBetween(MAP.x, MAP.y + i * 100 * K, MAP.x + MAP.w, MAP.y + i * 100 * K);
    }
    // Routes : chaque zone reliée à ses 2 voisines les plus proches
    const zones = this.run.map.zones;
    const done = new Set<string>();
    for (const a of zones) {
      const near = zones.filter((b) => b !== a).sort((p, q) => dist(a, p) - dist(a, q)).slice(0, 2);
      for (const b of near) {
        const key = [a.id, b.id].sort().join('/');
        if (done.has(key)) continue;
        done.add(key);
        g.lineStyle(9, 0x1c1822, 1);
        g.lineBetween(this.sx(a.x), this.sy(a.y), this.sx(b.x), this.sy(b.y));
        g.lineStyle(5, 0x4b4354, 1);
        g.lineBetween(this.sx(a.x), this.sy(a.y), this.sx(b.x), this.sy(b.y));
      }
    }
  }

  private drawGas(c: Circle) {
    const g = this.gasG;
    g.clear();
    const cx = this.sx(c.x);
    const cy = this.sy(c.y);
    const R = c.r * K;
    const R2 = R + 1600;
    // Anneau plein du bord de la zone sûre jusqu'au-delà de la carte.
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
    g.lineStyle(10, GAS, 0.25);
    g.strokeCircle(cx, cy, R + 5);
    g.lineStyle(4, 0xb5d65a, 0.95);
    g.strokeCircle(cx, cy, R);
  }

  private dashedCircle(c: Circle) {
    const g = this.add.graphics();
    const cx = this.sx(c.x);
    const cy = this.sy(c.y);
    const r = c.r * K;
    g.lineStyle(3, 0xffffff, 0.6);
    const n = Math.max(24, Math.round(r / 7));
    for (let i = 0; i < n; i += 2) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      g.lineBetween(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
    }
    return g;
  }

  /** Zones vues à la manche `round` (avant le resserrement s'il est animé). */
  private drawZones(round: number) {
    for (const z of this.run.map.zones) {
      const x = this.sx(z.x);
      const y = this.sy(z.y);
      const r = ZONE_RADIUS[z.size] * K;
      const si = SIZE_INFO[z.size];
      const root = this.add.container(x, y).setDepth(4);
      root.setData('r', r);
      const g = this.add.graphics();
      // Lueur chaude des grandes zones
      if (z.size === 'grande') {
        const glow = this.add.graphics();
        glow.fillStyle(si.color, 0.18);
        glow.fillCircle(0, 0, r + 10);
        root.add(glow);
        this.tweens.add({ targets: glow, scale: 1.12, alpha: 0.4, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.InOut' });
      }
      g.fillStyle(0x17141c, 0.85);
      g.fillCircle(0, 0, r);
      g.fillStyle(si.color, 0.16);
      g.fillCircle(0, 0, r);
      // Pâté de bâtiments
      const rng = rngFor(this.run.seed, 'blocks', z.id);
      const n = z.size === 'petite' ? 4 : z.size === 'moyenne' ? 7 : 11;
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * r * 0.62;
        const bw = 7 + rng() * 11;
        const bh = 6 + rng() * 9;
        g.fillStyle(0x0f0d13, 0.8);
        g.fillRect(Math.cos(a) * d - bw / 2 + 2, Math.sin(a) * d - bh / 2 + 2, bw, bh);
        g.fillStyle(0x6b6370, 1);
        g.fillRect(Math.cos(a) * d - bw / 2, Math.sin(a) * d - bh / 2, bw, bh);
      }
      g.lineStyle(3, si.color, 1);
      g.strokeCircle(0, 0, r);
      root.add(g);
      // Nom et nombre de cartes
      // Le nom est sur un calque au-dessus de toutes les zones, pour ne pas être masqué par une voisine.
      const name = txt(this, x, y + r + 6, z.name.toUpperCase(), 17, C.text, { fontStyle: 'bold', stroke: '#0f0d13', strokeThickness: 5 }).setOrigin(0.5, 0).setDepth(7);
      name.x = Phaser.Math.Clamp(x, MAP.x + name.width / 2 + 6, MAP.x + MAP.w - name.width / 2 - 6);
      if (y + r + 28 > MAP.y + MAP.h) name.setY(y - r - 30);
      root.setData('label', name);
      if (z.theme) {
        const ti = THEME_INFO[z.theme];
        const th = txt(this, name.x, name.y + (name.originY === 0 ? 22 : -16), ti.name.toUpperCase(), 14, ti.hex, { fontStyle: 'bold', stroke: '#0f0d13', strokeThickness: 4 }).setOrigin(0.5, 0).setDepth(7);
        if (name.y < y) th.setY(name.y - 18);
        root.setData('theme', th);
      }
      const chip = this.add.graphics();
      chip.fillStyle(0x0f0d13, 1);
      chip.fillRoundedRect(-22, -14, 44, 28, 14);
      chip.lineStyle(2, si.color, 1);
      chip.strokeRoundedRect(-22, -14, 44, 28, 14);
      root.add(chip);
      root.add(this.add.image(-8, 0, 'ic-tag').setDisplaySize(16, 16).setTint(si.color));
      root.add(txt(this, 8, 0, `${CARDS_BY_SIZE[z.size]}`, 18, si.hex, { fontStyle: 'bold' }).setOrigin(0.5));
      if (isGassed(this.run.map, z, round)) this.gassedLook(root, false);

      const hit = this.add.zone(x, y, Math.max(2 * r, 80), Math.max(2 * r, 80) + 20).setInteractive({ useHandCursor: true }).setDepth(6);
      hit.on('pointerup', () => this.tapZone(z));
      this.views.push({ zone: z, root });
    }
  }

  private gassedLook(root: Phaser.GameObjects.Container, animate: boolean) {
    if (root.getData('gassed')) return;
    root.setData('gassed', true);
    const veil = this.add.graphics();
    veil.fillStyle(0x0f0d13, 0.55);
    veil.fillCircle(0, 0, root.getData('r') as number);
    root.add(veil);
    if (animate) {
      veil.setAlpha(0);
      this.tweens.add({ targets: veil, alpha: 1, duration: 400 });
      this.tweens.add({ targets: [root, root.getData('label'), root.getData('theme')].filter(Boolean), alpha: 0.5, duration: 400 });
    } else {
      root.setAlpha(0.5);
      (root.getData('label') as Phaser.GameObjects.Text).setAlpha(0.5);
      (root.getData('theme') as Phaser.GameObjects.Text | undefined)?.setAlpha(0.5);
    }
  }

  private drawHud() {
    const run = this.run;
    // Caches opaques autour de la carte : le gaz est dessiné plus grand que la carte.
    const g = this.add.graphics().setDepth(30);
    g.fillStyle(C.bg, 1);
    g.fillRect(0, 0, W, MAP.y);
    g.fillRect(0, MAP.y + MAP.h, W, H - MAP.y - MAP.h);
    g.fillRect(0, 0, MAP.x, H);
    g.fillRect(MAP.x + MAP.w, 0, W - MAP.x - MAP.w, H);
    g.lineStyle(3, C.panelLine, 1);
    g.strokeRoundedRect(MAP.x - 2, MAP.y - 2, MAP.w + 4, MAP.h + 4, 8);
    panel(this, PANEL.x, PANEL.y, PANEL.w, PANEL.h).setDepth(30);

    iconButton(this, 50, 50, 'ic-menu', () => this.scene.start('menu')).setDepth(31);
    const title = run.round >= ROUNDS ? 'DUEL FINAL' : `CERCLE ${run.round + 1}/${ROUNDS}`;
    txt(this, 96, 50, title, 32, C.text, { fontFamily: TITLE_FONT }).setOrigin(0, 0.5).setDepth(31);
    statusPills(this, run, 50).setDepth(31);
    roundTrack(this, 42, 112, run.round).setDepth(31);
    const lg = this.add.graphics().setDepth(31);
    lg.lineStyle(3, 0xffffff, 0.6);
    for (let i = 0; i < 3; i++) lg.lineBetween(W - 236 + i * 12, 112, W - 229 + i * 12, 112);
    txt(this, W - 194, 112, 'PROCHAIN CERCLE', 15, C.quiet, { fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(31);
    lg.fillStyle(GAS, 0.5);
    lg.fillRoundedRect(W - 236, 130, 30, 12, 3);
    txt(this, W - 194, 136, 'GAZ', 15, '#b5d65a', { fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(31);
  }

  // ---------------------------------------------------------------- animation du cercle

  private animateShrink(from: Circle, to: Circle, final: boolean) {
    toast(this, final ? 'Dernier cercle !' : 'Le cercle se resserre !', '#b5d65a', MAP.y + 70);
    sfx('smoke', { pitch: 0.5, vol: 0.8, vary: 0 });
    vibrate([20, 40, 20]);
    const st = { t: 0 };
    let marked = false;
    this.tweens.add({
      targets: st,
      t: 1,
      duration: 1500,
      ease: 'Cubic.InOut',
      onUpdate: () => {
        const c = { x: from.x + (to.x - from.x) * st.t, y: from.y + (to.y - from.y) * st.t, r: from.r + (to.r - from.r) * st.t };
        this.drawGas(c);
        if (!marked && st.t > 0.6) {
          marked = true;
          for (const v of this.views) if (isGassed(this.run.map, v.zone, this.run.round)) this.gassedLook(v.root, true);
        }
      },
      onComplete: () => {
        this.drawGas(to);
        this.cameras.main.shake(140, 0.003);
        if (final) {
          banner(this, 'DUEL FINAL', C.accentStr, MAP.y + MAP.h / 2);
          this.time.delayedCall(1300, () => this.startFinal());
          return;
        }
        this.busy = false;
        // Les zones jouables rebondissent
        for (const v of this.views) if (!v.root.getData('gassed')) this.tweens.add({ targets: v.root, scale: 1.12, yoyo: true, duration: 160, ease: 'Quad.Out' });
      },
    });
  }

  private startFinal() {
    finalDuelParams(this.run);
    saveRun(this.run);
    this.cameras.main.fadeOut(220, 20, 22, 15);
    this.time.delayedCall(240, () => this.scene.start('loadout', { mode: 'duel' }));
  }

  // ---------------------------------------------------------------- sélection

  private tapZone(z: MapZone) {
    if (this.busy) return;
    if (!selectableZones(this.run).includes(z)) {
      vibrate(20);
      this.cameras.main.shake(100, 0.003);
      toast(this, 'Zone dans le gaz', '#b5d65a', MAP.y + MAP.h - 60);
      return;
    }
    if (this.selected === z) {
      this.drop();
      return;
    }
    this.selected = z;
    vibrate(8);
    this.selG.clear();
    const r = ZONE_RADIUS[z.size] * K;
    this.selG.lineStyle(4, 0xffffff, 1);
    this.selG.strokeCircle(this.sx(z.x), this.sy(z.y), r + 7);
    this.selG.setAlpha(1);
    this.tweens.killTweensOf(this.selG);
    this.tweens.add({ targets: this.selG, alpha: 0.35, yoyo: true, repeat: -1, duration: 500 });
    const v = this.views.find((w) => w.zone === z);
    if (v) this.tweens.add({ targets: v.root, scale: 1.1, yoyo: true, duration: 120 });
    this.showInfo();
  }

  private showInfo() {
    const I = this.info;
    I.removeAll(true);
    const x0 = PANEL.x + 28;
    const y0 = PANEL.y + 24;
    const z = this.selected;
    if (!z) {
      I.add(txt(this, x0, y0, 'Choisis ta zone de largage', 32, C.text, { fontStyle: 'bold' }));
      I.add(txt(this, x0, y0 + 50, 'Tu y joueras 3 cartes parmi celles tirées. Plus la zone\nest grande, plus il y a de cartes… et de danger.', 21, C.quiet, { lineSpacing: 6 }));
      let x = x0;
      for (const s of ['petite', 'moyenne', 'grande'] as const) {
        const si = SIZE_INFO[s];
        const g = this.add.graphics();
        const r = 9 + (s === 'petite' ? 0 : s === 'moyenne' ? 4 : 8);
        g.fillStyle(si.color, 0.25);
        g.fillCircle(x + 17, y0 + 152, r);
        g.lineStyle(3, si.color, 1);
        g.strokeCircle(x + 17, y0 + 152, r);
        const t = txt(this, x + 42, y0 + 152, `${si.name} · ${CARDS_BY_SIZE[s]} cartes`, 20, si.hex, { fontStyle: 'bold' }).setOrigin(0, 0.5);
        I.add([g, t]);
        x += 42 + t.width + 24;
      }
      I.add(txt(this, x0, y0 + 196, 'Zones assombries : dans le gaz, inaccessibles.', 18, '#b5d65a'));
      this.goBtn.setLabel('Larguer ▸');
      this.goBtn.setEnabled(false);
      return;
    }
    const si = SIZE_INFO[z.size];
    I.add(txt(this, x0, y0 - 4, z.name, 30, C.text, { fontFamily: TITLE_FONT }));
    const chipT = txt(this, 0, 0, `${si.name.toUpperCase()} · ${si.heat.toUpperCase()}`, 18, '#0f0d13', { fontStyle: 'bold' }).setOrigin(1, 0.5);
    const cw = chipT.width + 26;
    const chip = this.add.graphics();
    chip.fillStyle(si.color, 1);
    chip.fillRoundedRect(PANEL.x + PANEL.w - 24 - cw, y0 + 4, cw, 32, 16);
    chipT.setPosition(PANEL.x + PANEL.w - 24 - 13, y0 + 20);
    I.add([chip, chipT]);
    const ti = z.theme ? THEME_INFO[z.theme] : null;
    I.add(txt(this, x0, y0 + 50, ti ? `${ti.name.toUpperCase()} · ${ti.loot}` : `${CARDS_BY_SIZE[z.size]} cartes tirées · 3 à jouer`, 22, ti ? ti.hex : si.hex, { fontStyle: 'bold' }));
    I.add(txt(this, x0, y0 + 84, HEAT_DESC[z.size], 20, C.quiet, { wordWrap: { width: PANEL.w - 56 }, lineSpacing: 4 }));
    // Répartition des cartes : barre empilée
    const by = y0 + 158;
    const bw = PANEL.w - 56;
    const w = CARD_WEIGHTS[z.size];
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    // Part de chaque type parmi les cartes tirées ; la caisse épique (au plus une par largage) prend sa part.
    const epic = EPIC_CRATE_CHANCE[z.size] / CARDS_BY_SIZE[z.size];
    const share = (t: CardType) => (t === 'caisse_epique' ? epic : (w[t] / total) * (1 - epic));
    const types = [...(Object.keys(w) as CardType[]), ...(epic > 0 ? ['caisse_epique' as const] : [])];
    const g = this.add.graphics();
    let x = x0;
    let lx = x0;
    let ly = by + 36;
    for (const t of types) {
      const seg = share(t) * bw;
      g.fillStyle(CARD_INFO[t].color, 1);
      g.fillRect(x, by, Math.max(2, seg - 2), 14);
      x += seg;
      const label = t === 'caisse_epique' ? `★ ${CARD_INFO[t].name} : ${Math.round(EPIC_CRATE_CHANCE[z.size] * 100)} % des largages` : `${CARD_INFO[t].name} ${Math.round(share(t) * 100)} %`;
      const lt = txt(this, 0, 0, label, 17, CARD_INFO[t].hex, { fontStyle: 'bold' }).setOrigin(0, 0.5);
      if (lx + 18 + lt.width > x0 + bw) {
        lx = x0;
        ly += 30;
      }
      lt.setPosition(lx + 18, ly);
      g.fillStyle(CARD_INFO[t].color, 1);
      g.fillCircle(lx + 7, ly, 6);
      if (t === 'caisse_epique') {
        g.lineStyle(2, EPIC_GOLD, 1);
        g.strokeCircle(lx + 7, ly, 7);
      }
      I.add(lt);
      lx += 18 + lt.width + 22;
    }
    I.addAt(g, 0);
    this.goBtn.setLabel(`Larguer · ${z.name.length > 16 ? 'Go' : z.name} ▸`);
    this.goBtn.setEnabled(true);
    pop(this, this.goBtn.root, 1.04, 180);
  }

  // ---------------------------------------------------------------- largage

  private drop() {
    const z = this.selected;
    if (!z || this.busy) return;
    if (!dropInZone(this.run, z.id)) {
      toast(this, 'Impossible de se larguer ici', C.dangerStr);
      return;
    }
    this.busy = true;
    saveRun(this.run);
    this.goBtn.setEnabled(false);
    sfx('drop');
    vibrate(15);
    const tx = this.sx(z.x);
    const ty = this.sy(z.y);
    // Marqueur qui tombe sur la zone, puis la caméra plonge dessus.
    const m = this.add.container(tx, ty - 260).setDepth(20).setAlpha(0);
    const mg = this.add.graphics();
    mg.fillStyle(0x000000, 0.4);
    mg.fillCircle(2, 4, 14);
    mg.fillStyle(C.accent, 1);
    mg.fillCircle(0, 0, 14);
    mg.lineStyle(4, 0xffffff, 1);
    mg.strokeCircle(0, 0, 14);
    const ring = this.add.graphics();
    ring.lineStyle(4, C.accent, 1);
    ring.strokeCircle(0, 0, 16);
    m.add([ring, mg]);
    this.tweens.add({ targets: m, y: ty, alpha: 1, duration: 600, ease: 'Bounce.Out' });
    this.tweens.add({ targets: ring, scale: 3, alpha: 0, delay: 450, duration: 500, ease: 'Quad.Out' });
    this.time.delayedCall(700, () => {
      const cam = this.cameras.main;
      cam.pan(tx, ty, 450, Phaser.Math.Easing.Cubic.In);
      cam.zoomTo(2.2, 450, Phaser.Math.Easing.Cubic.In);
      cam.fadeOut(420, 20, 22, 15);
    });
    this.time.delayedCall(1150, () => this.scene.start('zone'));
  }
}
