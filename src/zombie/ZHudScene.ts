// Mode Zombie : HUD de la partie, lancé par-dessus ZGameScene (caméra fixe). Joystick virtuel, clavier,
// barres, minuterie, power-ups possédés, et les fenêtres : passage de niveau, pause, extraction.
import Phaser from 'phaser';
import { C, FONT, H, TITLE_FONT, W } from '../config';
import { P, hex } from '../ui/palette';
import { banner, button, fadeIn, modalBase, panel, plate, toast, txt, vibrate } from '../ui/widgets';
import { sfx } from '../audio/sfx';
import { EVOLUTIONS, POWERS, POWER_IDS, RUN_TIME, WEAPONS, xpToNext } from './data';
import { choiceInfo } from './world';
import { Choice } from './powerups';
import { drawBar, fitImage, fmtTime, pips } from './ui';
import type ZGameScene from './ZGameScene';

type Img = Phaser.GameObjects.Image;
const STICK_R = 80;

export default class ZHudScene extends Phaser.Scene {
  ready = false;
  private game_!: ZGameScene;
  private hud!: Phaser.GameObjects.Graphics;
  private timerT!: Phaser.GameObjects.Text;
  private killsT!: Phaser.GameObjects.Text;
  private levelT!: Phaser.GameObjects.Text;
  private hpT!: Phaser.GameObjects.Text;
  private ammoT!: Phaser.GameObjects.Text;
  private bossT!: Phaser.GameObjects.Text;
  private powerRow!: Phaser.GameObjects.Container;
  private vignette!: Phaser.GameObjects.Graphics;
  private whiteFlash!: Phaser.GameObjects.Rectangle;
  private stickBase!: Img;
  private stickKnob!: Img;
  private stickId = -1;
  private stickX = 0;
  private stickY = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private modal: Phaser.GameObjects.Container | null = null;
  private paused = false;
  private ownedKey = '';

  constructor() {
    super('zhud');
  }

  create() {
    this.game_ = this.scene.get('zgame') as ZGameScene;
    this.modal = null;
    this.paused = false;
    this.stickId = -1;
    this.ownedKey = '';
    this.buildHud();
    this.buildInput();
    fadeIn(this);
    this.ready = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (this.ready = false));
    this.time.delayedCall(450, () => this.banner('TENEZ 10 MINUTES', C.accentStr, H * 0.36));
  }

  /** Une fenêtre (niveau, pause, extraction) arrête la simulation. */
  blocking(): boolean {
    return !!this.modal || this.paused;
  }

  banner(s: string, color: string, y: number) {
    banner(this, s, color, y);
  }

  toast(s: string, color: string, y: number) {
    toast(this, s, color, y);
  }

  hurtFlash() {
    this.tweens.killTweensOf(this.vignette);
    this.vignette.setAlpha(1);
    this.tweens.add({ targets: this.vignette, alpha: 0, duration: 380 });
  }

  screenFlash(color: number, alpha: number, ms: number) {
    this.tweens.killTweensOf(this.whiteFlash);
    this.whiteFlash.setFillStyle(color).setAlpha(alpha);
    this.tweens.add({ targets: this.whiteFlash, alpha: 0, duration: ms });
  }

  /** Ferme les fenêtres et relâche le joystick (mort, fin de partie). */
  closeAll() {
    this.modal?.destroy();
    this.modal = null;
    this.paused = false;
    this.releaseStick();
  }

  /* -------------------------------------------------------------- */
  /* Entrées                                                         */
  /* -------------------------------------------------------------- */

  private buildInput() {
    this.stickBase = this.add.image(0, 0, 'zb-stick-base').setDepth(50).setVisible(false);
    this.stickKnob = this.add.image(0, 0, 'zb-stick-knob').setDepth(51).setVisible(false);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.modal || this.stickId !== -1) return;
      // Le bouton pause garde son coin.
      if (p.y < 140 && p.x > W - 120) return;
      this.stickId = p.id;
      this.stickX = p.x;
      this.stickY = p.y;
      this.stickBase.setPosition(p.x, p.y).setVisible(true);
      this.stickKnob.setPosition(p.x, p.y).setVisible(true);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.stickId) return;
      const dx = p.x - this.stickX;
      const dy = p.y - this.stickY;
      const d = Math.hypot(dx, dy);
      // Le socle suit le doigt quand on dépasse (pas besoin de revenir au centre pour changer de cap).
      if (d > STICK_R * 1.4) {
        this.stickX = p.x - (dx / d) * STICK_R * 1.4;
        this.stickY = p.y - (dy / d) * STICK_R * 1.4;
        this.stickBase.setPosition(this.stickX, this.stickY);
      }
      const k = Math.min(d, STICK_R) / (d || 1);
      this.stickKnob.setPosition(this.stickX + dx * k, this.stickY + dy * k);
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id === this.stickId) this.releaseStick();
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    const kb = this.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys('Z,Q,S,D,W,A,UP,DOWN,LEFT,RIGHT', false) as Record<string, Phaser.Input.Keyboard.Key>;
      kb.on('keydown-ESC', () => this.togglePause());
      kb.on('keydown-P', () => this.togglePause());
    }
  }

  private releaseStick() {
    this.stickId = -1;
    this.stickBase?.setVisible(false);
    this.stickKnob?.setVisible(false);
  }

  /** Déplacement demandé : clavier en priorité, sinon joystick. */
  readMove(): [number, number] {
    const k = this.keys;
    if (k) {
      const x = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.Q.isDown || k.A.isDown || k.LEFT.isDown ? 1 : 0);
      const y = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.Z.isDown || k.W.isDown || k.UP.isDown ? 1 : 0);
      if (x || y) {
        const n = Math.hypot(x, y);
        return [x / n, y / n];
      }
    }
    if (this.stickId !== -1) {
      const x = (this.stickKnob.x - this.stickX) / STICK_R;
      const y = (this.stickKnob.y - this.stickY) / STICK_R;
      if (Math.hypot(x, y) < 0.15) return [0, 0];
      return [x, y];
    }
    return [0, 0];
  }

  /* -------------------------------------------------------------- */
  /* HUD                                                             */
  /* -------------------------------------------------------------- */

  private buildHud() {
    // Vignette rouge des coups reçus : bords de l'écran.
    this.vignette = this.add.graphics().setDepth(-2).setAlpha(0);
    for (let i = 0; i < 10; i++) {
      this.vignette.lineStyle(14, P.danger, 0.09 * (10 - i) / 10);
      this.vignette.strokeRect(i * 12, i * 12, W - i * 24, H - i * 24);
    }
    this.whiteFlash = this.add.rectangle(0, 0, W, H, P.blanc, 1).setOrigin(0).setDepth(-1).setAlpha(0);
    this.hud = this.add.graphics();
    const stroke = { stroke: '#000000', strokeThickness: 5 };
    this.timerT = txt(this, W / 2, 66, '0:00', 46, C.text, { fontFamily: TITLE_FONT, ...stroke }).setOrigin(0.5);
    this.levelT = txt(this, 24, 30, 'NIV. 1', 22, hex(P.or), { fontFamily: TITLE_FONT, ...stroke });
    this.hpT = txt(this, 136, 72, '', 17, C.text, { fontFamily: FONT, fontStyle: 'bold', ...stroke }).setOrigin(0.5);
    this.killsT = txt(this, 24, 92, '0', 20, C.text, { fontFamily: TITLE_FONT, ...stroke });
    this.ammoT = txt(this, 24, H - 58, '', 20, C.text, { fontFamily: FONT, fontStyle: 'bold', ...stroke }).setOrigin(0, 0.5);
    this.bossT = txt(this, W / 2, 140, '', 20, C.dangerStr, { fontFamily: TITLE_FONT, ...stroke }).setOrigin(0.5).setVisible(false);
    // Arme (bas gauche)
    const wi = fitImage(this, `it-${this.game_.cls.weapon}`, 0, 0, 120).setOrigin(0, 0.5);
    wi.setPosition(24, H - 100);
    // Pause
    const pg = this.add.graphics();
    pg.fillStyle(P.nuit, 0.7);
    pg.fillRect(W - 92, 26, 70, 70);
    pg.lineStyle(2, P.trait2, 1);
    pg.strokeRect(W - 92, 26, 70, 70);
    const pi = this.add.image(W - 57, 61, 'ic-menu').setTint(P.texte);
    pi.setScale(34 / Math.max(pi.width, pi.height));
    const pz = this.add.zone(W - 57, 61, 110, 110).setInteractive({ useHandCursor: true });
    pz.on('pointerup', () => this.togglePause());
    this.powerRow = this.add.container(0, 0);
  }

  /** Rangée des power-ups possédés (bas droite), reconstruite quand elle change. */
  private refreshPowerRow() {
    const w = this.game_.world;
    const owned = POWER_IDS.filter((p) => w.powerLevel(p) > 0);
    const key = [...w.evos].join() + '|' + owned.map((p) => `${p}${w.powerLevel(p)}`).join();
    if (key === this.ownedKey) return;
    this.ownedKey = key;
    this.powerRow.removeAll(true);
    const S = 46;
    const g = this.add.graphics();
    this.powerRow.add(g);
    const all = [
      ...[...w.evos].map((e) => ({ icon: EVOLUTIONS[e].icon, lvl: -1, max: 0 })),
      ...owned.map((p) => ({ icon: POWERS[p].icon, lvl: w.powerLevel(p), max: POWERS[p].max })),
    ];
    const perRow = 9;
    all.forEach((it, i) => {
      const row = Math.floor(i / perRow);
      const cx = W - 24 - S / 2 - (i % perRow) * (S + 6);
      const cy = H - 50 - row * (S + 10);
      g.fillStyle(P.nuit, 0.8);
      g.fillRect(cx - S / 2, cy - S / 2, S, S);
      g.lineStyle(2, it.lvl === -1 ? P.or : it.lvl >= it.max ? P.orange : P.trait2, 1);
      g.strokeRect(cx - S / 2, cy - S / 2, S, S);
      this.powerRow.add(fitImage(this, it.icon, cx, cy - 3, S - 12));
      if (it.lvl > 0) {
        const seg = (S - 8) / it.max;
        for (let k = 0; k < it.max; k++) {
          g.fillStyle(k < it.lvl ? P.or : P.trait, 1);
          g.fillRect(cx - S / 2 + 4 + k * seg, cy + S / 2 - 7, seg - 2, 4);
        }
      }
    });
  }

  update() {
    const gs = this.game_;
    if (!gs?.world) return;
    const w = gs.world;
    const g = this.hud;
    this.refreshPowerRow();
    g.clear();
    // Barre d'XP tout en haut
    drawBar(g, 0, 0, W, 14, w.xp / Math.max(1, xpToNext(w.level)), P.precision, P.nuit);
    // Plaque gauche : niveau, PV, kills
    g.fillStyle(P.nuit, 0.72);
    g.fillRect(14, 24, 246, 100);
    g.lineStyle(2, P.trait2, 1);
    g.strokeRect(14, 24, 246, 100);
    const hpf = w.hp / w.stats.maxHp;
    drawBar(g, 24, 62, 226, 22, hpf, hpf < 0.3 ? P.danger : P.soin, P.dangerSombre);
    this.hpT.setText(`${Math.ceil(w.hp)} / ${w.stats.maxHp}`);
    this.levelT.setText(`NIV. ${w.level}`);
    this.killsT.setText(`${w.killCount} ABATTUS`);
    // Minuterie
    this.timerT.setText(w.endless ? `+${fmtTime(w.time - RUN_TIME)}` : fmtTime(w.time));
    this.timerT.setColor(w.endless ? C.dangerStr : RUN_TIME - w.time < 30 ? C.accentStr : C.text);
    // Boss
    if (w.boss) {
      this.bossT.setVisible(true).setText(`LE COLOSSE · RANG ${w.boss.tier}`);
      drawBar(g, 110, 160, W - 220, 16, w.boss.hp / w.boss.maxHp, P.danger, P.dangerSombre);
    } else this.bossT.setVisible(false);
    // Munitions / rechargement (bas gauche)
    const s = w.stats;
    if (w.reloadT > 0) {
      this.ammoT.setText('RECHARGE…').setColor(C.accentStr);
      drawBar(g, 24, H - 38, 150, 8, 1 - w.reloadT / s.reload, P.orange);
    } else {
      this.ammoT.setText(`${w.ammo} / ${s.mag}`).setColor(C.text);
      drawBar(g, 24, H - 38, 150, 8, w.ammo / s.mag, P.acierClair);
    }
  }

  /* -------------------------------------------------------------- */
  /* Fenêtres                                                        */
  /* -------------------------------------------------------------- */

  openLevelUp() {
    if (this.modal) return;
    const w = this.game_.world;
    sfx('craft');
    vibrate(30);
    this.releaseStick();
    const root = modalBase(this);
    this.modal = root;
    const title = plate(this, W / 2, 200, `Niveau ${w.level}`, P.or, 34);
    const sub = txt(this, W / 2, 262, 'Choisis une amélioration', 24, C.quiet).setOrigin(0.5);
    root.add([title, sub]);
    const cards = this.add.container(0, 0);
    root.add(cards);
    let locked = false;
    const pick = (c: Choice) => {
      if (locked) return;
      locked = true;
      w.choose(c);
      sfx('place');
      root.destroy();
      this.modal = null;
      if (c.kind === 'evo') {
        banner(this, `ÉVOLUTION : ${EVOLUTIONS[c.id].name.toUpperCase()}`, hex(P.or), H * 0.36);
        this.game_.cameras.main.shake(300, 0.01);
      }
    };
    const fill = () => {
      cards.removeAll(true);
      const choices = w.drawChoices();
      const n = choices.length;
      const CH = n > 3 ? 172 : 200;
      const gap = 18;
      const top = 310;
      choices.forEach((c, i) => cards.add(this.choiceCard(c, 36, top + i * (CH + gap), W - 72, CH, i, () => pick(c))));
      const by = top + n * (CH + gap) + 12;
      if (w.rerolls > 0) {
        const rb = button(this, W / 2 - 170, by, 340, 80, `Relancer (${w.rerolls})`, () => {
          w.rerolls--;
          fill();
        }, { size: 24, icon: 'ic-reroll' });
        cards.add(rb.root);
      }
    };
    fill();
  }

  private choiceCard(c: Choice, x: number, y: number, w: number, h: number, i: number, onPick: () => void) {
    const info = choiceInfo(c, this.game_.world.levels);
    const root = this.add.container(x, y);
    const col = info.evo ? P.or : c.kind === 'soin' ? P.soin : info.level === 1 ? P.precision : P.orange;
    root.add(panel(this, 0, 0, w, h, col));
    if (info.evo) {
      const glow = this.add.graphics();
      glow.lineStyle(6, P.or, 0.6);
      glow.strokeRect(-6, -6, w + 12, h + 12);
      root.add(glow);
      this.tweens.add({ targets: glow, alpha: 0.2, yoyo: true, repeat: -1, duration: 600 });
    }
    const g = this.add.graphics();
    const box = Math.min(124, h - 44);
    g.fillStyle(P.nuit, 1);
    g.fillRect(22, h / 2 - box / 2, box, box);
    g.lineStyle(2, col, 1);
    g.strokeRect(22, h / 2 - box / 2, box, box);
    root.add(g);
    root.add(fitImage(this, info.icon, 22 + box / 2, h / 2, box - 24));
    const tx = 22 + box + 22;
    const tag = info.evo ? 'ÉVOLUTION' : c.kind === 'soin' ? 'SOIN' : info.level === 1 ? 'NOUVEAU' : `NIVEAU ${info.level}`;
    root.add(txt(this, tx, 22, tag, 18, hex(col), { fontFamily: TITLE_FONT }));
    root.add(txt(this, tx, 46, info.name.toUpperCase(), 30, C.text, { fontFamily: TITLE_FONT }));
    root.add(txt(this, tx, 92, info.desc, 21, C.quiet, { wordWrap: { width: w - tx - 22 }, lineSpacing: 2 }));
    if (info.max > 0) pips(g, w - 26 - info.max * 16, 28, info.level, info.max, P.or, 12, 4);
    const zone = this.add.zone(w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerup', onPick);
    root.add(zone);
    root.setAlpha(0).setX(x + 60);
    this.tweens.add({ targets: root, alpha: 1, x, duration: 260, delay: 60 + i * 80, ease: 'Back.Out' });
    return root;
  }

  togglePause() {
    const gs = this.game_;
    if (gs.ended) return;
    if (this.paused) {
      this.modal?.destroy();
      this.modal = null;
      this.paused = false;
      return;
    }
    if (this.modal) return;
    this.paused = true;
    this.releaseStick();
    const root = modalBase(this);
    this.modal = root;
    const w = gs.world;
    root.add(plate(this, W / 2, 300, 'Pause', P.orange, 40));
    const s = w.stats;
    const lines = [
      `${gs.cls.name} · ${WEAPONS[gs.cls.weapon].name}`,
      `Dégâts ${Math.round(s.dmg)}${s.pellets > 1 ? ` ×${s.pellets}` : ''} · ${s.rate.toFixed(1)} tirs/s · chargeur ${s.mag}`,
      `PV ${Math.ceil(w.hp)}/${s.maxHp} · critique ${Math.round(s.crit * 100)} % · perforation ${s.pierce}`,
      `Déplacement : glisser le doigt n'importe où, ou ZQSD / WASD / flèches`,
    ];
    root.add(txt(this, W / 2, 380, lines.join('\n'), 22, C.quiet, { align: 'center', lineSpacing: 10 }).setOrigin(0.5, 0));
    root.add(button(this, W / 2 - 220, 580, 440, 96, 'Reprendre', () => this.togglePause(), { primary: true, icon: 'ic-play' }).root);
    root.add(button(this, W / 2 - 220, 700, 440, 84, 'Abandonner', () => gs.finish(false), { size: 26, icon: 'ic-close' }).root);
  }

  openExtraction() {
    if (this.modal) return;
    this.releaseStick();
    sfx('win', { vary: 0 });
    const root = modalBase(this);
    this.modal = root;
    const gs = this.game_;
    root.add(plate(this, W / 2, 330, 'Extraction', P.soin, 44));
    root.add(txt(this, W / 2, 410, 'Dix minutes tenues. L’hélico est là.\nTu peux partir… ou rester pour le mode sans fin.', 24, C.text, { align: 'center', lineSpacing: 8 }).setOrigin(0.5, 0));
    root.add(button(this, W / 2 - 230, 560, 460, 100, 'Monter à bord', () => gs.finish(true), { primary: true, icon: 'ic-check' }).root);
    root.add(button(this, W / 2 - 230, 690, 460, 88, 'Continuer (sans fin)', () => {
      gs.world.endless = true;
      root.destroy();
      this.modal = null;
      banner(this, 'SANS FIN', C.dangerStr, H * 0.36);
    }, { size: 26, icon: 'ic-skip' }).root);
  }
}
