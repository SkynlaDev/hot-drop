// Mode Zombie : créateur de classe. Nom de code, apparence, arme de départ, atout passif.
import Phaser from 'phaser';
import { C, TITLE_FONT, W } from '../config';
import { P, hex } from '../ui/palette';
import { button, fadeIn, panel, plate, toast, txt } from '../ui/widgets';
import { iconButton } from '../ui/hud';
import { pxFigure } from '../art';
import { FIGS, FIG_NAMES, GOALS, PERKS, PERK_IDS, WEAPONS, WEAPON_IDS, WeaponId, PerkId } from './data';
import { CALLSIGNS, ZClass, ZSave, equippedAccessories, loadSave, perkUnlocked, storeSave, weaponLevel, weaponProgress, weaponUnlocked } from './progress';
import { weaponSummary } from './stats';
import { makeZombieTextures, preloadZombieArt } from './assets';
import { drawBar, fitImage } from './ui';
import { zBackdrop } from './ZHubScene';

export default class ZClassScene extends Phaser.Scene {
  private slot = 0;
  private save!: ZSave;
  private draft!: ZClass;
  private isNew = false;
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super('zclass');
  }

  init(data: { slot?: number; draft?: ZClass }) {
    this.slot = data.slot ?? 0;
    this.save = loadSave();
    const existing = this.save.classes[this.slot];
    this.isNew = !existing;
    this.draft = data.draft ?? (existing ? { ...existing } : {
      name: CALLSIGNS[(this.slot * 7 + Date.now()) % CALLSIGNS.length],
      fig: FIGS[(this.slot + 1) % FIGS.length],
      weapon: 'pistolet',
      perk: 'medecin',
    });
  }

  preload() {
    preloadZombieArt(this.load);
  }

  create() {
    makeZombieTextures(this);
    zBackdrop(this, 120);
    iconButton(this, 52, 52, 'ic-close', () => this.scene.start('zhub'), 28);
    plate(this, W / 2, 52, this.isNew ? 'Nouvelle classe' : `Classe ${this.slot + 1}`, P.orange, 24);
    this.layer = this.add.container(0, 0);
    this.draw();
    fadeIn(this);
  }

  private draw() {
    this.layer.removeAll(true);
    const L = this.layer;
    const d = this.draft;

    // Apparence
    L.add(panel(this, 40, 110, 250, 330, P.trait2));
    const g = this.add.graphics();
    g.fillStyle(P.nuit, 1);
    g.fillRect(56, 126, 218, 240);
    L.add(g);
    L.add(pxFigure(this, 165, 362, d.fig, 3.6));
    L.add(txt(this, 165, 404, FIG_NAMES[d.fig].toUpperCase(), 22, C.text, { fontFamily: TITLE_FONT }).setOrigin(0.5));
    const cycle = (k: number) => {
      d.fig = FIGS[(FIGS.indexOf(d.fig) + k + FIGS.length) % FIGS.length];
      this.draw();
    };
    L.add(this.arrow(76, 404, -1, () => cycle(-1)));
    L.add(this.arrow(254, 404, 1, () => cycle(1)));

    // Nom de code
    L.add(txt(this, 316, 118, 'NOM DE CODE', 18, C.quiet, { fontFamily: TITLE_FONT }));
    const nameT = txt(this, 316, 146, d.name.toUpperCase(), 44, C.accentStr, { fontFamily: TITLE_FONT });
    if (nameT.width > 370) nameT.setScale(370 / nameT.width);
    L.add(nameT);
    L.add(button(this, 316, 214, 176, 70, 'Au hasard', () => {
      let n = d.name;
      while (n === d.name) n = CALLSIGNS[Math.floor(Math.random() * CALLSIGNS.length)];
      d.name = n;
      this.draw();
    }, { size: 20, icon: 'ic-reroll' }).root);
    L.add(button(this, 504, 214, 176, 70, 'Écrire', () => {
      // Pas de champ texte dans le canevas : la boîte de saisie du navigateur suffit (et ouvre le clavier sur mobile).
      const v = globalThis.prompt?.('Nom de code (16 lettres max.)', d.name);
      if (v && v.trim()) {
        d.name = v.trim().slice(0, 16);
        this.draw();
      }
    }, { size: 20, icon: 'ic-tag' }).root);
    // Résumé de l'atout choisi
    const perk = PERKS[d.perk];
    L.add(txt(this, 316, 306, 'ATOUT', 18, C.quiet, { fontFamily: TITLE_FONT }));
    L.add(txt(this, 316, 330, perk.name, 26, C.text, { fontStyle: 'bold' }));
    L.add(txt(this, 316, 366, perk.desc, 19, C.quiet, { wordWrap: { width: 364 } }));

    // Arme de départ
    L.add(plate(this, W / 2, 476, 'Arme de départ', P.orange, 18));
    const n = WEAPON_IDS.length;
    const tw = (W - 80 - (n - 1) * 8) / n;
    WEAPON_IDS.forEach((id, i) => L.add(this.weaponTile(id, 40 + i * (tw + 8), 506, tw, 84)));
    const wdef = WEAPONS[d.weapon];
    const wl = weaponLevel(weaponProgress(this.save, d.weapon).xp).level;
    const sum = weaponSummary(d.weapon, wl, equippedAccessories(this.save, d.weapon));
    L.add(txt(this, 40, 604, `${wdef.name}`, 26, C.text, { fontStyle: 'bold' }));
    L.add(txt(this, W - 40, 608, `${wdef.wclass} · niv. ${wl}`, 20, hex(P.or)).setOrigin(1, 0));
    L.add(txt(this, 40, 640, wdef.desc, 19, C.quiet, { wordWrap: { width: W - 80 } }));
    const bars = this.add.graphics();
    L.add(bars);
    const stat = (k: number, label: string, v: number, max: number, show: string) => {
      const x = 40 + (k % 2) * 330;
      const y = 690 + Math.floor(k / 2) * 34;
      L.add(txt(this, x, y, label, 18, C.quiet));
      drawBar(bars, x + 100, y + 6, 150, 10, v / max, P.orange);
      L.add(txt(this, x + 262, y, show, 18, C.text));
    };
    stat(0, 'Dégâts/s', sum.dps, 120, `${Math.round(sum.dps)}`);
    stat(1, 'Coup', sum.dmg * sum.pellets, 80, sum.pellets > 1 ? `${Math.round(sum.dmg)}×${sum.pellets}` : `${Math.round(sum.dmg)}`);
    stat(2, 'Portée', sum.range, 1000, `${Math.round(sum.range)}`);
    stat(3, 'Chargeur', sum.mag, 100, `${sum.mag}`);

    // Atouts
    L.add(plate(this, W / 2, 790, 'Atout passif', P.orange, 18));
    const cols = 4;
    const pw = (W - 80 - (cols - 1) * 8) / cols;
    PERK_IDS.forEach((id, i) => L.add(this.perkTile(id, 40 + (i % cols) * (pw + 8), 820 + Math.floor(i / cols) * 112, pw, 104)));

    // Actions
    const save = button(this, 40, 1074, W - 80 - (this.isNew ? 0 : 196), 96, this.isNew ? 'Créer la classe' : 'Enregistrer', () => {
      this.save.classes[this.slot] = { ...d };
      this.save.selected = this.slot;
      storeSave(this.save);
      this.scene.start('zhub');
    }, { primary: true, icon: 'ic-check', size: 30 });
    L.add(save.root);
    if (!this.isNew) {
      let armed = false;
      const del = button(this, W - 40 - 180, 1074, 180, 96, 'Effacer', () => {
        if (!armed) {
          armed = true;
          del.setLabel('Sûr ?');
          return;
        }
        this.save.classes[this.slot] = null;
        if (this.save.selected === this.slot) this.save.selected = Math.max(0, this.save.classes.findIndex((c) => c));
        storeSave(this.save);
        this.scene.start('zhub');
      }, { size: 22, icon: 'ic-close' });
      L.add(del.root);
    }
    L.add(txt(this, W / 2, 1200, 'Les accessoires d’arme se gèrent à l’Arsenal (communs à toutes les classes).', 18, hex(P.muet)).setOrigin(0.5));
  }

  private arrow(x: number, y: number, dir: number, onClick: () => void) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(P.relief, 1);
    g.fillCircle(0, 0, 22);
    g.lineStyle(2, P.traitClair, 1);
    g.strokeCircle(0, 0, 22);
    g.fillStyle(P.texte, 1);
    g.fillTriangle(dir * 9, 0, -dir * 6, -10, -dir * 6, 10);
    const z = this.add.zone(0, 0, 64, 64).setInteractive({ useHandCursor: true });
    z.on('pointerup', onClick);
    c.add([g, z]);
    return c;
  }

  private weaponTile(id: WeaponId, x: number, y: number, w: number, h: number) {
    const c = this.add.container(x, y);
    const ok = weaponUnlocked(this.save, id);
    const sel = this.draft.weapon === id;
    const g = this.add.graphics();
    g.fillStyle(ok ? (sel ? P.gris : P.muet) : P.nuit, 1);
    g.fillRect(0, 0, w, h);
    g.lineStyle(sel ? 3 : 2, sel ? P.orange : P.trait, 1);
    g.strokeRect(0, 0, w, h);
    c.add(g);
    const img = fitImage(this, `it-${id}`, w / 2, h / 2 - 6, w - 12);
    if (!ok) img.setTint(0x2b2632);
    c.add(img);
    if (!ok) {
      const lock = this.add.image(w / 2, h / 2 - 4, 'ic-lock').setTint(P.muet);
      lock.setScale(26 / Math.max(lock.width, lock.height));
      c.add(lock);
    }
    const lvl = weaponLevel(weaponProgress(this.save, id).xp).level;
    c.add(txt(this, w / 2, h - 16, ok ? `niv. ${lvl}` : '???', 15, ok ? C.quiet : hex(P.muet)).setOrigin(0.5));
    const z = this.add.zone(w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
    z.on('pointerup', () => {
      if (!ok) {
        const g2 = GOALS.find((g) => g.reward.weapon === id);
        toast(this, `Verrouillée · objectif : ${g2?.name ?? '?'}`, C.accentStr, 600);
        return;
      }
      this.draft.weapon = id;
      this.draw();
    });
    c.add(z);
    return c;
  }

  private perkTile(id: PerkId, x: number, y: number, w: number, h: number) {
    const c = this.add.container(x, y);
    const ok = perkUnlocked(this.save, id);
    const sel = this.draft.perk === id;
    const g = this.add.graphics();
    g.fillStyle(sel ? P.relief : P.nuit, 1);
    g.fillRect(0, 0, w, h);
    g.lineStyle(sel ? 3 : 2, sel ? P.orange : P.trait, 1);
    g.strokeRect(0, 0, w, h);
    c.add(g);
    const img = fitImage(this, `it-${PERKS[id].icon}`, w / 2, 40, 56);
    if (!ok) img.setTint(0x2b2632);
    c.add(img);
    if (!ok) {
      const lock = this.add.image(w / 2, 40, 'ic-lock').setTint(P.muet);
      lock.setScale(26 / Math.max(lock.width, lock.height));
      c.add(lock);
    }
    const t = txt(this, w / 2, h - 18, PERKS[id].name, 18, sel ? C.accentStr : ok ? C.text : hex(P.muet), { fontStyle: 'bold' }).setOrigin(0.5);
    if (t.width > w - 8) t.setScale((w - 8) / t.width);
    c.add(t);
    const z = this.add.zone(w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
    z.on('pointerup', () => {
      if (!ok) {
        const g2 = GOALS.find((g) => g.reward.perk === id);
        toast(this, `Verrouillé · objectif : ${g2?.name ?? '?'}`, C.accentStr, 1000);
        return;
      }
      this.draft.perk = id;
      this.draw();
    });
    c.add(z);
    return c;
  }
}

