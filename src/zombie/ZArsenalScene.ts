// Mode Zombie : arsenal. Niveau de chaque arme (XP gagnée partie après partie) et accessoires débloqués
// à équiper dans les emplacements de l'arme (bouche, optique, sous-canon, chargeur, munitions).
import Phaser from 'phaser';
import { C, TITLE_FONT, W } from '../config';
import { P, hex } from '../ui/palette';
import { button, fadeIn, panel, plate, toast, txt } from '../ui/widgets';
import { iconButton } from '../ui/hud';
import { ACCESSORIES, AccId, GOALS, SLOTS, SLOT_NAMES, WEAPONS, WEAPON_IDS, WEAPON_MAX_LEVEL, WeaponId } from './data';
import { ZSave, accessoryAtLevel, equippedAccessories, loadSave, storeSave, toggleAccessory, unlockedAccessories, weaponLevel, weaponProgress, weaponUnlocked } from './progress';
import { weaponSummary } from './stats';
import { makeZombieTextures, preloadZombieArt } from './assets';
import { drawBar, fitImage } from './ui';
import { zBackdrop } from './ZHubScene';

export default class ZArsenalScene extends Phaser.Scene {
  private save!: ZSave;
  private weapon: WeaponId = 'pistolet';
  private layer!: Phaser.GameObjects.Container;
  private info = '';

  constructor() {
    super('zarsenal');
  }

  init(data: { weapon?: WeaponId }) {
    this.save = loadSave();
    this.weapon = data.weapon && weaponUnlocked(this.save, data.weapon) ? data.weapon : 'pistolet';
    this.info = '';
  }

  preload() {
    preloadZombieArt(this.load);
  }

  create() {
    makeZombieTextures(this);
    zBackdrop(this, 110);
    iconButton(this, 52, 52, 'ic-close', () => this.scene.start('zhub'), 28);
    plate(this, W / 2, 52, 'Arsenal', P.orange, 26);
    this.layer = this.add.container(0, 0);
    this.draw();
    fadeIn(this);
  }

  private draw() {
    this.layer.removeAll(true);
    const L = this.layer;
    const wid = this.weapon;
    const wdef = WEAPONS[wid];

    // Onglets d'armes
    const n = WEAPON_IDS.length;
    const tw = (W - 80 - (n - 1) * 8) / n;
    WEAPON_IDS.forEach((id, i) => L.add(this.tab(id, 40 + i * (tw + 8), 104, tw, 76)));

    // Arme et niveau
    L.add(panel(this, 40, 196, W - 80, 290, P.trait2));
    const rack = this.add.graphics();
    rack.fillStyle(P.muet, 1);
    rack.fillRoundedRect(64, 250, W - 128, 132, 10);
    rack.fillStyle(P.blanc, 0.08);
    rack.fillRoundedRect(68, 254, W - 136, 40, 8);
    L.add(rack);
    L.add(fitImage(this, `it-${wid}`, W / 2, 316, 460, undefined, 116));
    L.add(txt(this, 64, 212, wdef.name.toUpperCase(), 28, C.text, { fontFamily: TITLE_FONT }));
    const xp = weaponProgress(this.save, wid).xp;
    const wl = weaponLevel(xp);
    L.add(txt(this, W - 64, 214, `NIV. ${wl.level}`, 28, hex(P.or), { fontFamily: TITLE_FONT }).setOrigin(1, 0));
    const g = this.add.graphics();
    L.add(g);
    drawBar(g, 64, 394, W - 128, 14, wl.need ? wl.into / wl.need : 1, P.or);
    L.add(txt(this, 64, 414, wl.need ? `${wl.into} / ${wl.need} XP` : 'Maîtrise atteinte', 18, C.quiet));
    const next = accessoryAtLevel(wid, wl.level + 1);
    const nextT = wl.level >= WEAPON_MAX_LEVEL ? `Niveau max : +${Math.round((wl.level - 1) * 3)} % dégâts` : next ? `Niv. ${wl.level + 1} : ${ACCESSORIES[next].name}` : `Niv. ${wl.level + 1} : +3 % dégâts`;
    L.add(txt(this, W - 64, 414, nextT, 18, C.accentStr).setOrigin(1, 0));
    L.add(txt(this, 64, 446, 'Chaque zombie abattu avec cette arme lui donne de l’XP. Chaque niveau : +3 % dégâts.', 16, hex(P.muet)));

    // Emplacements
    L.add(plate(this, W / 2, 516, 'Emplacements', P.orange, 18));
    const sw = (W - 80 - 4 * 10) / 5;
    const eq = weaponProgress(this.save, wid).equipped;
    SLOTS.forEach((s, i) => {
      const x = 40 + i * (sw + 10);
      const y = 546;
      const c = this.add.container(x, y);
      const gg = this.add.graphics();
      const a = eq[s];
      gg.fillStyle(a ? P.trait2 : P.nuit, 1);
      gg.fillRect(0, 0, sw, 112);
      gg.lineStyle(2, a ? P.orange : P.trait, 1);
      gg.strokeRect(0, 0, sw, 112);
      c.add(gg);
      c.add(txt(this, sw / 2, 10, SLOT_NAMES[s].toUpperCase(), 14, C.quiet, { fontFamily: TITLE_FONT }).setOrigin(0.5, 0));
      if (a) {
        c.add(fitImage(this, `it-${a}`, sw / 2, 62, sw - 30));
        const t = txt(this, sw / 2, 98, ACCESSORIES[a].name, 14, C.text).setOrigin(0.5);
        if (t.width > sw - 6) t.setScale((sw - 6) / t.width);
        c.add(t);
      } else c.add(txt(this, sw / 2, 62, '—', 26, hex(P.muet)).setOrigin(0.5));
      L.add(c);
    });

    // Accessoires
    L.add(plate(this, W / 2, 694, 'Accessoires', P.orange, 18));
    const unlocked = unlockedAccessories(wid, wl.level);
    const cols = 4;
    const aw = (W - 80 - (cols - 1) * 8) / cols;
    wdef.unlocks.forEach((acc, i) => {
      L.add(this.accTile(acc, i + 2, unlocked.includes(acc), Object.values(eq).includes(acc), 40 + (i % cols) * (aw + 8), 722 + Math.floor(i / cols) * 94, aw, 88));
    });

    // Stats de l'arme équipée
    const sum = weaponSummary(wid, wl.level, equippedAccessories(this.save, wid));
    const stats = `Dégâts/s ${Math.round(sum.dps)} · coup ${Math.round(sum.dmg)}${sum.pellets > 1 ? `×${sum.pellets}` : ''} · ${sum.rate.toFixed(1)} tirs/s · portée ${Math.round(sum.range)}\nchargeur ${sum.mag} · recharge ${sum.reload.toFixed(1)} s · critique ${Math.round(sum.crit * 100)} % · perforation ${sum.pierce}`;
    if (this.info) L.add(txt(this, W / 2, 1016, this.info, 18, C.accentStr, { align: 'center', wordWrap: { width: W - 60 } }).setOrigin(0.5, 0.5));
    L.add(txt(this, W / 2, 1048, stats, 19, C.quiet, { align: 'center', lineSpacing: 6 }).setOrigin(0.5, 0));
    L.add(button(this, 40, 1130, W - 80, 92, 'Retour au QG', () => this.scene.start('zhub'), { icon: 'ic-check', size: 28 }).root);
  }

  private tab(id: WeaponId, x: number, y: number, w: number, h: number) {
    const c = this.add.container(x, y);
    const ok = weaponUnlocked(this.save, id);
    const sel = this.weapon === id;
    const g = this.add.graphics();
    g.fillStyle(ok ? (sel ? P.gris : P.muet) : P.nuit, 1);
    g.fillRect(0, 0, w, h);
    g.lineStyle(sel ? 3 : 2, sel ? P.orange : P.trait, 1);
    g.strokeRect(0, 0, w, h);
    c.add(g);
    const img = fitImage(this, `it-${id}`, w / 2, h / 2 - 8, w - 12);
    if (!ok) img.setTint(0x2b2632);
    c.add(img);
    c.add(txt(this, w / 2, h - 14, ok ? `niv. ${weaponLevel(weaponProgress(this.save, id).xp).level}` : '???', 14, C.quiet).setOrigin(0.5));
    const z = this.add.zone(w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
    z.on('pointerup', () => {
      if (!ok) {
        const g2 = GOALS.find((g) => g.reward.weapon === id);
        toast(this, `Verrouillée · objectif : ${g2?.name ?? '?'}`, C.accentStr, 640);
        return;
      }
      this.weapon = id;
      this.info = '';
      this.draw();
    });
    c.add(z);
    return c;
  }

  private accTile(acc: AccId, level: number, ok: boolean, on: boolean, x: number, y: number, w: number, h: number) {
    const a = ACCESSORIES[acc];
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(on ? P.traitClair : ok ? P.trait : P.nuit, 1);
    g.fillRect(0, 0, w, h);
    g.lineStyle(on ? 3 : 2, on ? P.orange : ok ? P.trait2 : P.trait, 1);
    g.strokeRect(0, 0, w, h);
    c.add(g);
    const img = fitImage(this, `it-${acc}`, w / 2, 36, 52);
    if (!ok) img.setAlpha(0.18);
    c.add(img);
    if (!ok) {
      c.add(txt(this, w / 2, 36, `NIV. ${level}`, 18, hex(P.muet), { fontFamily: TITLE_FONT }).setOrigin(0.5));
    }
    const t = txt(this, w / 2, h - 14, a.name, 16, on ? C.accentStr : ok ? C.text : hex(P.muet), { fontStyle: 'bold' }).setOrigin(0.5);
    if (t.width > w - 8) t.setScale((w - 8) / t.width);
    c.add(t);
    if (on) c.add(txt(this, w - 6, 4, '✓', 18, C.accentStr).setOrigin(1, 0));
    const z = this.add.zone(w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
    z.on('pointerup', () => {
      if (!ok) {
        this.info = `${a.name} (${SLOT_NAMES[a.slot].toLowerCase()}) : ${a.desc}. Se débloque au niveau ${level} de l'arme.`;
        this.draw();
        return;
      }
      toggleAccessory(this.save, this.weapon, acc);
      storeSave(this.save);
      this.info = `${a.name} ${on ? 'retiré' : 'équipé'} : ${a.desc}`;
      this.draw();
    });
    c.add(z);
    return c;
  }
}
