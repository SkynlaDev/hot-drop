// Zone où le joueur s'est largué : les cartes tirées sont face visible, il en joue 3, dans l'ordre qu'il veut.
import Phaser from 'phaser';
import { ART, zoneBg } from '../art';
import { C, H, W } from '../config';
import { RunState, currentZone, playCard, saveRun } from '../logic/run';
import { ACTIONS_PER_ZONE, Card, DANGER_BY_SIZE, MapZone, ROUNDS, isFight } from '../logic/zone';
import { DANGER_RAMP } from '../logic/bots';
import { CRATES } from '../logic/run';
import { CARD_INFO, EPIC_GOLD, SIZE_INFO, statusPills } from '../ui/hud';
import { Button, button, fadeIn, pop, toast, txt, vibrate } from '../ui/widgets';

const GRID = { x: 20, y: 344, w: 680, h: 690, gap: 14 };
const RISK_PIPS = 5;

interface CardView {
  index: number;
  root: Phaser.GameObjects.Container;
  sel: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
}

/** Description d'une carte, affichée quand elle est sélectionnée. */
function cardDesc(card: Card): string {
  switch (card.type) {
    case 'squad':
      return `Escouade : ${card.duels} duels d'affilée, tu récupères la moitié des PV perdus entre deux. Tu fouilles chaque sac, gros bonus de crédits, souvent une sacoche.`;
    case 'duo':
      return `Duo : ${card.duels} duels d'affilée, tu récupères la moitié des PV perdus entre les deux. Tu fouilles chaque sac, bonus de crédits, parfois une sacoche.`;
    case 'solo':
      return 'Un duel, sac contre sac. Tu fouilles le sac adverse et tu gagnes des crédits.';
    case 'caisse':
      return `Pas de combat : du cash, et ${CRATES.caisse.picks} objet à choisir parmi ${CRATES.caisse.offers} (toujours une arme). Parfois une sacoche.`;
    case 'caisse_renforcee':
      return `Caisse renforcée, sans combat : ${CRATES.caisse_renforcee.picks} objets à choisir parmi ${CRATES.caisse_renforcee.offers}, dont une arme et de quoi compléter une recette de ton sac. Plus de cash, souvent une sacoche.`;
    case 'caisse_epique':
      return `Caisse épique, sans combat : ${CRATES.caisse_epique.picks} objets à choisir parmi ${CRATES.caisse_epique.offers}, dont une arme et un objet assemblé (recette). Gros cash.`;
    case 'shop':
      return 'Boutique : 5 offres de ton opérateur, relance possible contre des crédits.';
  }
}

/** Bonus de niveau des bots de la zone : aucun au 1er cercle (tout le monde vient d'atterrir), puis il monte. */
function botBonus(zone: MapZone, round: number): number {
  return DANGER_BY_SIZE[zone.size] * DANGER_RAMP[Math.min(round, DANGER_RAMP.length - 1)];
}

/** Risque d'une carte de combat, sur RISK_PIPS : nombre de duels + chaleur de la zone. */
function riskOf(card: Card, zone: MapZone, round: number): number {
  return Math.min(RISK_PIPS, card.duels + Math.round(botBonus(zone, round) * 2));
}

export default class ZoneScene extends Phaser.Scene {
  private run!: RunState;
  private zone!: MapZone;
  private views: CardView[] = [];
  private selected = -1;
  private busy = false;
  private desc!: Phaser.GameObjects.Text;
  private playBtn!: Button;
  private pips!: Phaser.GameObjects.Container;

  constructor() {
    super('zone');
  }

  init() {
    this.run = this.registry.get('run');
    this.views = [];
    this.selected = -1;
    this.busy = false;
  }

  create() {
    const run = this.run;
    if (!run) {
      this.scene.start('menu');
      return;
    }
    if (run.over) {
      this.scene.start('end');
      return;
    }
    if (run.fight || run.pendingGoulag || run.pendingLoot) {
      this.scene.start('loadout', { mode: 'duel' });
      return;
    }
    const zone = currentZone(run);
    if (!zone) {
      this.scene.start('map');
      return;
    }
    this.zone = zone;
    fadeIn(this);

    // Ce que le joueur a déjà vu de cette zone : distribue les cartes à l'arrivée, tamponne la dernière jouée au retour.
    const key = `${run.seed}:${run.round}:${zone.id}`;
    const seen = this.registry.get('zoneSeen') as { key: string; played: number } | undefined;
    const fresh = !seen || seen.key !== key;
    const justPlayed = !fresh && seen.played < run.played.length ? run.played.slice(seen.played) : [];
    this.registry.set('zoneSeen', { key, played: run.played.length });

    this.drawHeader(zone, fresh);
    this.drawCards(zone, fresh, justPlayed);

    this.desc = txt(this, W / 2, 1072, 'Touche une carte pour la jouer', 21, C.quiet, { align: 'center', wordWrap: { width: W - 60 }, lineSpacing: 4 }).setOrigin(0.5);
    button(this, 20, H - 128, 200, 100, 'Sac', () => this.openBag(), { size: 28 });
    this.playBtn = button(this, 236, H - 128, W - 256, 100, 'Jouer ▸', () => this.play(), { primary: true, size: 30 });
    this.playBtn.setEnabled(false);
  }

  // ---------------------------------------------------------------- en-tête

  private drawHeader(zone: MapZone, fresh: boolean) {
    const run = this.run;
    const si = SIZE_INFO[zone.size];
    const hero = this.add.image(W / 2, 0, `bg-${zoneBg(zone.name)}`).setOrigin(0.5, 0);
    hero.setScale(330 / hero.height).setTint(0xb0b0a0);
    const fade = this.add.graphics();
    fade.fillStyle(C.bg, 0.35);
    fade.fillRect(0, 0, W, 100);
    for (let i = 0; i < 20; i++) {
      fade.fillStyle(C.bg, i / 20);
      fade.fillRect(0, 130 + i * 10, W, 10);
    }
    fade.fillStyle(C.bg, 1);
    fade.fillRect(0, 330, W, H - 330);

    txt(this, 24, 50, `CERCLE ${run.round + 1}/${ROUNDS}`, 24, C.text, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 }).setOrigin(0, 0.5);
    statusPills(this, run, 50);

    const name = txt(this, 24, 178, zone.name.toUpperCase(), 54, C.text, { fontStyle: 'bold italic', stroke: '#000000', strokeThickness: 7, padding: { right: 12 } }).setOrigin(0, 0.5);
    if (name.width > W - 40) name.setScale((W - 40) / name.width);
    if (fresh) {
      // Arrivée dans la zone : le nom glisse depuis la gauche.
      name.x = -name.width;
      this.tweens.add({ targets: name, x: 24, duration: 420, delay: 80, ease: 'Back.Out' });
    }
    const chipT = txt(this, 0, 0, `ZONE ${si.name.toUpperCase()} · ${si.heat.toUpperCase()}`, 18, '#0d0f0a', { fontStyle: 'bold' }).setOrigin(0, 0.5);
    const cw = chipT.width + 26;
    const chip = this.add.graphics();
    chip.fillStyle(si.color, 1);
    chip.fillRoundedRect(26, 220, cw, 32, 16);
    chipT.setPosition(39, 236).setDepth(1);
    const lvl = botBonus(zone, run.round);
    const botLabel = run.round === 0 ? 'Bots fraîchement largués' : lvl > 0 ? `Bots +${String(Math.round(lvl * 100) / 100).replace('.', ',')} niveau` : 'Bots normaux';
    txt(this, 26 + cw + 14, 236, botLabel, 18, C.quiet, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0, 0.5);

    // Compteur d'actions restantes
    txt(this, 24, 296, `ACTIONS : ${run.actionsLeft}/${ACTIONS_PER_ZONE}`, 28, C.accentStr, { fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.pips = this.add.container(0, 0);
    for (let i = 0; i < ACTIONS_PER_ZONE; i++) {
      const on = i < run.actionsLeft;
      const g = this.add.graphics();
      const px = W - 44 - (ACTIONS_PER_ZONE - 1 - i) * 46;
      g.fillStyle(on ? C.accent : 0x0d0f0a, 1);
      g.fillRoundedRect(-17, -17, 34, 34, 8);
      g.lineStyle(3, on ? 0xffb15a : C.cellLine, 1);
      g.strokeRoundedRect(-17, -17, 34, 34, 8);
      g.setPosition(px, 296);
      this.pips.add(g);
    }
    txt(this, W - 44 - (ACTIONS_PER_ZONE - 1) * 46 - 30, 296, 'restantes', 18, C.quiet).setOrigin(1, 0.5);
  }

  // ---------------------------------------------------------------- cartes

  private drawCards(zone: MapZone, fresh: boolean, justPlayed: number[]) {
    const cards = this.run.cards;
    const cols = Math.ceil(cards.length / 2);
    const rows = Math.ceil(cards.length / cols);
    const cw = (GRID.w - GRID.gap * (cols - 1)) / cols;
    const ch = Math.min(GRID.h / rows - GRID.gap, cw * 1.9);
    const top = GRID.y + (GRID.h - rows * ch - (rows - 1) * GRID.gap) / 2;
    cards.forEach((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = GRID.x + col * (cw + GRID.gap) + cw / 2;
      const y = top + row * (ch + GRID.gap) + ch / 2;
      const played = this.run.played.includes(i) && !justPlayed.includes(i);
      const v = this.cardView(card, zone, i, x, y, cw, ch, played);
      this.views.push(v);
      if (fresh) {
        // Distribution : les cartes volent depuis le bas, de dos, puis se retournent.
        v.root.setPosition(W / 2, H + 200).setScale(0.4, 0.4).setAngle(-20);
        this.tweens.add({
          targets: v.root, x, y, angle: 0, scaleY: 1, duration: 420, delay: 150 + i * 80, ease: 'Cubic.Out',
        });
        this.tweens.add({ targets: v.root, scaleX: 1, duration: 260, delay: 400 + i * 80, ease: 'Back.Out' });
      }
      if (justPlayed.includes(i)) this.time.delayedCall(300, () => this.stamp(v, true));
    });
  }

  private cardView(card: Card, zone: MapZone, index: number, x: number, y: number, w: number, h: number, played: boolean): CardView {
    const info = CARD_INFO[card.type];
    const root = this.add.container(x, y);
    const g = this.add.graphics();
    const l = -w / 2;
    const t = -h / 2;
    const small = w < 200;
    const epic = card.type === 'caisse_epique';
    if (epic && !played) {
      // Halo violet et or qui pulse derrière la carte.
      const glow = this.add.graphics();
      for (let k = 4; k >= 1; k--) {
        glow.fillStyle(k % 2 ? info.color : EPIC_GOLD, 0.1);
        glow.fillRoundedRect(l - k * 5, t - k * 5, w + k * 10, h + k * 10, 18 + k * 5);
      }
      root.add(glow);
      this.tweens.add({ targets: glow, alpha: { from: 0.35, to: 1 }, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    // Corps
    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(l, t + 6, w, h, 18);
    g.fillStyle(0x1b1f16, 1);
    g.fillRoundedRect(l, t, w, h, 18);
    g.fillStyle(info.color, 0.16);
    g.fillRoundedRect(l, t, w, h * 0.62, { tl: 18, tr: 18, bl: 0, br: 0 });
    g.fillStyle(info.color, 1);
    g.fillRoundedRect(l, t, w, 10, { tl: 18, tr: 18, bl: 0, br: 0 });
    g.lineStyle(3, info.color, 0.9);
    g.strokeRoundedRect(l, t, w, h, 18);
    if (epic) {
      // Liseré or, bandeau or en haut.
      g.fillStyle(EPIC_GOLD, 1);
      g.fillRoundedRect(l, t, w, 10, { tl: 18, tr: 18, bl: 0, br: 0 });
      g.lineStyle(3, EPIC_GOLD, 1);
      g.strokeRoundedRect(l + 5, t + 5, w - 10, h - 10, 14);
    }
    root.add(g);

    // Titre
    const title = txt(this, 0, t + 38, epic ? 'ÉPIQUE' : info.name.toUpperCase(), small ? 26 : 32, info.hex, { fontStyle: 'bold italic', padding: { left: 6, right: 6 } }).setOrigin(0.5);
    if (epic) title.setStroke('#3a1a5a', 4).setShadow(0, 0, '#f2c94c', 10, true, true);
    root.add(title);

    // Illustration
    const iy = t + h * 0.38;
    const disc = this.add.graphics();
    const dr = Math.min(w * 0.36, h * 0.2);
    disc.fillStyle(0x0d0f0a, 0.7);
    disc.fillCircle(0, iy, dr);
    disc.lineStyle(2, info.color, 0.5);
    disc.strokeCircle(0, iy, dr);
    root.add(disc);
    if (isFight(card)) {
      const fi = ART.figures['mil-stand'];
      const n = card.duels;
      const sc = (dr * 2.2) / (fi.h * 3);
      for (let k = 0; k < n; k++) {
        const off = n === 1 ? 0 : (k - (n - 1) / 2) * dr * 0.62;
        const f = this.add.image(off, iy + dr * 0.92, 'fig-mil-stand').setOrigin(fi.ax, fi.ay).setScale(sc * (k === Math.floor(n / 2) ? 1 : 0.88)).setFlipX(true);
        f.setTint(k === Math.floor(n / 2) ? 0xffffff : 0xb0a8a0);
        root.add(f);
      }
    } else if (epic) {
      // Caisse dorée et étoiles qui scintillent.
      const ic = this.add.image(0, iy, info.icon).setDisplaySize(dr * 1.25, dr * 1.25).setTint(EPIC_GOLD);
      root.add(ic);
      if (!played) this.tweens.add({ targets: ic, angle: { from: -6, to: 6 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + (k - 1) * 1.1;
        const star = txt(this, Math.cos(a) * dr * 1.05, iy + Math.sin(a) * dr * 1.05, '★', small ? 20 : 26, k === 1 ? '#f2c94c' : '#c08cff').setOrigin(0.5);
        root.add(star);
        if (!played) this.tweens.add({ targets: star, scale: { from: 0.6, to: 1.25 }, alpha: { from: 0.5, to: 1 }, duration: 520, delay: k * 240, yoyo: true, repeat: -1 });
      }
    } else {
      root.add(this.add.image(0, iy, info.icon).setDisplaySize(dr * 1.15, dr * 1.15).setTint(info.color));
    }

    // Détails
    let dy = t + h * 0.66;
    const fs = small ? 18 : 22;
    if (isFight(card)) {
      root.add(txt(this, 0, dy, card.duels > 1 ? `${card.duels} COMBATS` : '1 COMBAT', fs + 2, C.text, { fontStyle: 'bold' }).setOrigin(0.5));
      dy += fs + 14;
      root.add(txt(this, 0, dy, card.type === 'squad' ? 'Gros butin' : card.type === 'duo' ? 'Bon butin' : 'Butin normal', fs - 2, C.quiet).setOrigin(0.5));
      dy += fs + 10;
      const risk = riskOf(card, zone, this.run.round);
      const pw = small ? 18 : 24;
      const gap = 5;
      const total = RISK_PIPS * pw + (RISK_PIPS - 1) * gap;
      const rg = this.add.graphics();
      for (let k = 0; k < RISK_PIPS; k++) {
        rg.fillStyle(k < risk ? (risk >= 4 ? C.danger : risk >= 2 ? 0xff8c1a : 0xf2c94c) : 0x2b3024, 1);
        rg.fillRoundedRect(-total / 2 + k * (pw + gap), dy + 12, pw, 10, 3);
      }
      root.add(rg);
      root.add(txt(this, 0, dy, 'RISQUE', 13, C.quiet, { fontStyle: 'bold' }).setOrigin(0.5));
    } else if (card.type === 'caisse' || card.type === 'caisse_renforcee') {
      const cr = CRATES[card.type];
      root.add(txt(this, 0, dy, 'SANS COMBAT', fs + 2, C.text, { fontStyle: 'bold' }).setOrigin(0.5));
      dy += fs + 14;
      root.add(txt(this, 0, dy, `${cr.picks} objet${cr.picks > 1 ? 's' : ''}\nsur ${cr.offers}`, fs - 2, card.type === 'caisse' ? C.quiet : '#6fb0ff', { align: 'center', fontStyle: card.type === 'caisse' ? 'normal' : 'bold' }).setOrigin(0.5, 0));
    } else if (epic) {
      root.add(txt(this, 0, dy, 'SANS COMBAT', fs + 2, C.text, { fontStyle: 'bold' }).setOrigin(0.5));
      dy += fs + 14;
      root.add(txt(this, 0, dy - 4, '1 objet\nassemblé', fs, '#f2c94c', { fontStyle: 'bold', align: 'center', lineSpacing: -2 }).setOrigin(0.5, 0));
      dy += 2 * fs + 6;
      root.add(txt(this, 0, dy, `${CRATES.caisse_epique.picks} sur ${CRATES.caisse_epique.offers}`, fs - 5, C.quiet).setOrigin(0.5, 0));
    } else {
      root.add(txt(this, 0, dy, '5 OFFRES', fs + 2, C.text, { fontStyle: 'bold' }).setOrigin(0.5));
      dy += fs + 14;
      root.add(txt(this, 0, dy, small ? 'Achète,\nrelance' : 'Achète et\nrelance', fs - 2, C.quiet, { align: 'center' }).setOrigin(0.5, 0));
    }

    // Contour de sélection
    const sel = this.add.graphics();
    sel.lineStyle(5, 0xffffff, 1);
    sel.strokeRoundedRect(l - 4, t - 4, w + 8, h + 8, 21);
    sel.setVisible(false);
    root.add(sel);
    root.setSize(w, h);

    const hit = this.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.tapCard(index));
    root.add(hit);
    const v: CardView = { index, root, sel, x, y };
    if (played) this.stamp(v, false);
    return v;
  }

  /** Carte jouée : grisée, tampon « JOUÉE ». */
  private stamp(v: CardView, animate: boolean) {
    const w = v.root.width;
    const h = v.root.height;
    const veil = this.add.graphics();
    veil.fillStyle(0x0d0f0a, 0.62);
    veil.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    const st = this.add.container(0, -h * 0.05).setAngle(-14);
    const label = txt(this, 0, 0, 'JOUÉE', w < 200 ? 30 : 40, '#ece8d8', { fontStyle: 'bold' }).setOrigin(0.5);
    const bw = label.width + 30;
    const bg = this.add.graphics();
    bg.lineStyle(4, 0xece8d8, 0.9);
    bg.strokeRoundedRect(-bw / 2, -label.height / 2 - 6, bw, label.height + 12, 8);
    st.add([bg, label]);
    v.root.add([veil, st]);
    if (!animate) {
      st.setAlpha(0.8);
      return;
    }
    veil.setAlpha(0);
    st.setScale(2.4).setAlpha(0);
    this.tweens.add({ targets: veil, alpha: 1, duration: 250 });
    this.tweens.add({ targets: st, scale: 1, alpha: 0.8, duration: 260, ease: 'Back.Out', onComplete: () => this.cameras.main.shake(90, 0.003) });
  }

  private tapCard(i: number) {
    if (this.busy) return;
    if (this.run.played.includes(i)) {
      vibrate(20);
      toast(this, 'Carte déjà jouée', C.quiet, 1000);
      return;
    }
    if (this.selected === i) {
      this.play();
      return;
    }
    vibrate(8);
    const prev = this.views.find((v) => v.index === this.selected);
    if (prev) {
      prev.sel.setVisible(false);
      this.tweens.add({ targets: prev.root, y: prev.y, scale: 1, duration: 150, ease: 'Quad.Out' });
    }
    this.selected = i;
    const v = this.views.find((w) => w.index === i)!;
    v.sel.setVisible(true);
    v.root.setDepth(5);
    this.views.forEach((w) => w !== v && w.root.setDepth(0));
    this.tweens.add({ targets: v.root, y: v.y - 12, scale: 1.05, duration: 180, ease: 'Back.Out' });
    const card = this.run.cards[i];
    this.desc.setText(cardDesc(card)).setColor(C.text);
    this.playBtn.setLabel(`Jouer · ${CARD_INFO[card.type].name} ▸`);
    this.playBtn.setEnabled(true);
    pop(this, this.playBtn.root, 1.05, 180);
  }

  private play() {
    if (this.busy || this.selected < 0) return;
    const i = this.selected;
    const res = playCard(this.run, i);
    if (!res) {
      toast(this, 'Impossible de jouer cette carte', C.dangerStr, 1000);
      return;
    }
    saveRun(this.run);
    this.busy = true;
    vibrate(15);
    const v = this.views.find((w) => w.index === i)!;
    // La carte jouée vient au centre et grossit avant la transition.
    v.root.setDepth(10);
    this.tweens.add({ targets: v.root, x: W / 2, y: H / 2, scale: 1.5, duration: 320, ease: 'Cubic.Out' });
    this.views.forEach((w) => w !== v && this.tweens.add({ targets: w.root, alpha: 0.2, duration: 200 }));
    const data = res.kind === 'shop' ? { mode: 'shop' } : res.kind === 'caisse' ? { mode: 'caisse', loot: res.loot, crate: res.crate } : { mode: 'duel' };
    this.time.delayedCall(380, () => this.cameras.main.fadeOut(200, 20, 22, 15));
    this.time.delayedCall(600, () => this.scene.start('loadout', data));
  }

  private openBag() {
    if (this.busy) return;
    this.scene.start('loadout', { mode: 'manage' });
  }
}
