import Phaser from 'phaser';
import { C, H, W } from '../config';
import { BIOMES, BiomeId } from '../data/biomes';
import { FAMILY_INFO } from '../data/items';
import { THREAT_INFO } from '../data/threats';
import { RunState, enterZone, remainingBiomes, saveRun } from '../logic/run';
import { STAGES, guardianThreats } from '../logic/zone';
import { Button, button, fadeIn, txt, vibrate } from '../ui/widgets';

const CARD = { x: 20, w: 680, h: 268, gap: 22, y0: 236 };

/** Briefing : on voit les zones restantes et on choisit la prochaine. */
export default class BriefingScene extends Phaser.Scene {
  private run!: RunState;
  private choice: BiomeId | null = null;
  private cards = new Map<BiomeId, Phaser.GameObjects.Graphics>();
  private goBtn!: Button;

  constructor() {
    super('briefing');
  }

  init() {
    this.run = this.registry.get('run');
    this.cards = new Map();
    const left = remainingBiomes(this.run);
    this.choice = left.length === 1 ? left[0] : null;
  }

  create() {
    if (this.run.zone) {
      this.scene.start('map');
      return;
    }
    fadeIn(this);
    const r = this.run;
    const left = remainingBiomes(r);
    const last = r.stage === STAGES - 1;

    txt(this, 24, 34, 'BRIEFING', 30, C.text, { fontStyle: 'bold' }).setOrigin(0, 0.5);
    txt(this, W - 24, 34, `ZONE ${r.stage + 1}/${STAGES}`, 24, C.accentStr, { fontStyle: 'bold' }).setOrigin(1, 0.5);
    this.drawProgress(96);
    const title = r.stage === 0
      ? 'Choisis ta zone de largage'
      : last
        ? 'Dernière zone : le Cdt Kesh t\'attend'
        : 'Choisis ta prochaine zone';
    txt(this, 24, 148, title, 30, C.text, { fontStyle: 'bold' });
    txt(this, 24, 192, last
      ? 'Bats-le à l\'exfiltration pour terminer la run.'
      : 'Plus tu avances, plus les ennemis sont durs et le butin rare.', 20, C.quiet);

    left.forEach((b, i) => this.card(b, CARD.y0 + i * (CARD.h + CARD.gap), last));

    this.goBtn = button(this, 20, H - 116, W - 40, 92, '', () => this.go(), { primary: true });
    this.refresh();
  }

  /** Trois pastilles : zones faites, en cours, à venir. */
  private drawProgress(y: number) {
    const r = this.run;
    const g = this.add.graphics();
    const w = 200;
    const x0 = W / 2 - (STAGES * w + (STAGES - 1) * 16) / 2;
    for (let i = 0; i < STAGES; i++) {
      const x = x0 + i * (w + 16);
      const done = i < r.done.length;
      const now = i === r.stage;
      g.fillStyle(done ? C.good : now ? C.accent : C.cell, done || now ? 0.9 : 1);
      g.fillRoundedRect(x, y - 16, w, 32, 8);
      const label = done ? `✓ ${BIOMES[r.done[i]].name}` : now ? 'En cours' : i === STAGES - 1 ? 'Cdt Kesh' : 'À venir';
      txt(this, x + w / 2, y, label, 16, done || now ? '#111410' : C.quiet, { fontStyle: 'bold' }).setOrigin(0.5);
    }
  }

  private card(id: BiomeId, y: number, last: boolean) {
    const b = BIOMES[id];
    const x = CARD.x;
    const g = this.add.graphics();
    this.cards.set(id, g);
    // Vignette : le décor de combat du biome, recadré en portrait
    const sw = 168;
    const vh = CARD.h - 32;
    const tex = this.textures.get(`bg-${id}`).getSourceImage() as HTMLImageElement;
    const cropW = (tex.height * sw) / vh;
    const img = this.add.image(x + 16, y + 16, `bg-${id}`).setOrigin(0).setScale(vh / tex.height);
    img.setCrop((tex.width - cropW) / 2, 0, cropW, tex.height);
    img.x -= ((tex.width - cropW) / 2) * img.scaleX;
    const frame = this.add.graphics();
    frame.lineStyle(3, 0x000000, 0.6);
    frame.strokeRoundedRect(x + 16, y + 16, sw, vh, 6);
    void b.ground;

    const tx = x + sw + 36;
    txt(this, tx, y + 22, b.name.toUpperCase(), 28, C.text, { fontStyle: 'bold' });

    let ly = y + 72;
    txt(this, tx, ly, 'Menaces', 18, C.quiet);
    b.threats.forEach((t, i) => txt(this, tx + 130 + i * 160, ly, THREAT_INFO[t].name, 18, THREAT_INFO[t].hex, { fontStyle: 'bold' }));
    ly += 40;
    txt(this, tx, ly, 'Butin', 18, C.quiet);
    b.families.forEach((f, i) => txt(this, tx + 130 + i * 160, ly, FAMILY_INFO[f].name, 18, FAMILY_INFO[f].hex, { fontStyle: 'bold' }));
    ly += 40;
    txt(this, tx, ly, 'Exfil', 18, C.quiet);
    const guard = last ? 'Cdt Kesh' : 'Lieutenant';
    const gt = guardianThreats(id, this.run.stage).map((t) => THREAT_INFO[t].name).join(' + ');
    txt(this, tx + 130, ly, `${guard}${gt ? ` · ${gt}` : ''}`, 18, C.accentStr, { fontStyle: 'bold', wordWrap: { width: CARD.w - sw - 190 } });

    const zone = this.add.zone(x, y, CARD.w, CARD.h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => {
      this.choice = id;
      vibrate(8);
      this.refresh();
    });
  }

  private refresh() {
    this.remainingIds().forEach((id, i) => {
      const g = this.cards.get(id)!;
      const y = CARD.y0 + i * (CARD.h + CARD.gap);
      const on = this.choice === id;
      g.clear();
      g.fillStyle(C.panel, 1);
      g.fillRoundedRect(CARD.x, y, CARD.w, CARD.h, 18);
      g.lineStyle(on ? 5 : 3, on ? C.accent : C.panelLine, 1);
      g.strokeRoundedRect(CARD.x, y, CARD.w, CARD.h, 18);
    });
    const c = this.choice;
    this.goBtn.setLabel(c ? `Larguer · ${BIOMES[c].name} ▸` : 'Touche une zone');
    this.goBtn.setEnabled(!!c);
  }

  private remainingIds() {
    return remainingBiomes(this.run);
  }

  private go() {
    if (!this.choice) return;
    enterZone(this.run, this.choice);
    saveRun(this.run);
    vibrate(15);
    this.cameras.main.fadeOut(220, 20, 22, 15);
    this.time.delayedCall(240, () => this.scene.start('map'));
  }
}
