// Sac à dos : rangement (objets et sacoches), boutique, caisse, et duels 1v1 sac contre sac.
import Phaser from 'phaser';
import { PX_FIGS, PxFigId, foeFig, opFig, pxFigure, pxKey } from '../art';
import { ARENA, BAG_RESERVE, BUTTON, C, CELL, COMBAT, ENEMY, FONT, GRID_X, GRID_Y, H, MONO, RESERVE, SELL, STATUS, TITLE_FONT, TRAY, W } from '../config';
import { BAGS, BagId } from '../data/bags';
import { FAMILY_INFO, ITEMS } from '../data/items';
import { OPERATORS } from '../data/operators';
import { RECIPES } from '../data/recipes';
import { ARCHETYPES } from '../data/archetypes';
import { BotBuild, botLoadout, generateBot } from '../logic/bots';
import { DuelEvent, DuelResult, Side, simulateDuel } from '../logic/combat';
import { DuelReport, ItemReport, duelReport, itemWeight } from '../logic/report';
import { SfxId, sfx, warmSfx } from '../audio/sfx';
import { P, hex } from '../ui/palette';
import {
  BASE_X0, BASE_X1, BASE_Y0, BASE_Y1, BagInst, COLS, ItemInst, ROWS, Rot, bagAt, canMoveBag, canPlace, canPlaceBag, cellCount, cellsAt,
  cellsOf, dims, itemAt, maskOf, nextRot, overlapping, rotationIsNoop,
} from '../logic/grid';
import { bagStars, completesRecipe, starAffinity, starSpecs, starsLitBy } from '../logic/stars';
import { getSettings, nextSpeed, setSettings } from '../logic/settings';
import { TIER_COLORS, TIER_HEX, TIER_NAMES, tierOf } from '../logic/tier';
import { Craftable, autoCraft } from '../logic/recipes';
import {
  BAG_RESERVE_MAX, CrateKind, DuelParams, FINAL_ROUND, Loot, RESERVE_MAX, RunState, bagSellValue, buyOffer, currentDuel, endAction,
  finalDuelParams, goulagParams, placeBag, playerMaxHp, rerollCost, rerollShop, toggleLock, reserve, reserveBags, resolveDuel, resolveGoulag, saveRun, sellBag,
  closeResupply, finishLoot, itemSellValue, lootItem, sellItem, shopOffers, swapLoot, unplaceBag, usable,
} from '../logic/run';
import { ENDURANCE_MAX, PlayerLoadout, SynergyLink, computeLoadout, describe, estimateDps } from '../logic/stats';
import { ACTIONS_PER_ZONE, ROUNDS } from '../logic/zone';
import { Button, bagView, banner, button, chamferPoints, fadeIn, fillMask, flashItem, itemView, modalBase, panel, pop, toast, txt, vibrate, FADE_RGB } from '../ui/widgets';

export type LoadoutMode = 'manage' | 'shop' | 'caisse' | 'duel';
/** edit : rangement libre · prep : avant le duel · combat : lecture · result : après le duel · over : run finie. */
type Phase = 'edit' | 'prep' | 'combat' | 'result' | 'over';
type Container = Phaser.GameObjects.Container;
/** Pixels d'écran par pixel de sprite des personnages du duel. */
const FIG_PX = 2.5;

interface DragState {
  item?: ItemInst;
  bag?: BagInst;
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

/** Couleurs du Feu continu (Viper), du plus froid au plafond. */
const HEAT_COLORS = ['#e9c46a', '#e8894a', '#c94a4a'];
/** Or des étoiles. */
const GOLD_HEX = 0xe9c46a;
/** Son de tir de chaque classe d'arme. */
const SHOT_SFX: Record<string, SfxId> = {
  Pistolet: 'shot_pistol', SMG: 'shot_smg', "Fusil d'assaut": 'shot_rifle', 'Fusil de précision': 'shot_sniper', 'Fusil à pompe': 'shot_shotgun', Drone: 'shot_smg',
};
const DUEL_SFX: SfxId[] = ['shot_pistol', 'shot_smg', 'shot_rifle', 'shot_sniper', 'shot_shotgun', 'miss', 'hit', 'hit_armor', 'crit', 'melee', 'reload', 'frag', 'death'];
const ARMOR_STR = '#a9bccb';
/** Case n° i de la réserve (2 rangées de RESERVE.cols, sous l'intitulé). */
function reserveSlot(i: number): { x: number; y: number; w: number; h: number } {
  const w = RESERVE.w / RESERVE.cols;
  const h = (RESERVE.h - 30) / RESERVE.rows;
  return { x: RESERVE.x + (i % RESERVE.cols) * w, y: RESERVE.y + 26 + Math.floor(i / RESERVE.cols) * h, w, h };
}

/** Icône du type d'objet qu'attend une étoile (sous l'étoile vide de l'objet sélectionné). */
const TAG_ICON: Record<string, string> = {
  arme: 'ic-rifle', arme_longue: 'ic-sniper', melee: 'ic-hand', munition: 'ic-mag', accessoire: 'ic-scope',
  protection: 'ic-plate', explosif: 'ic-frag', medical: 'ic-medkit', composant: 'ic-bolt',
};

/** Petit cadenas centré en (x, y) : ouvert ou fermé. */
function drawPadlock(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, closed: boolean) {
  g.lineStyle(3, color, 1);
  g.beginPath();
  if (closed) g.arc(x, y - 4, 7, Math.PI, 0);
  else g.arc(x + 7, y - 7, 7, Math.PI, -0.3);
  g.strokePath();
  g.fillStyle(color, 1);
  g.fillRoundedRect(x - 10, y - 3, 20, 15, 3);
}
const fmt1 = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');

/** Étoile à 5 branches centrée en (x, y), pleine ou creuse. */
function drawStar(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, filled: boolean, color: number, alpha: number) {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * rr, y + Math.sin(a) * rr));
  }
  if (filled) {
    g.fillStyle(color, alpha);
    g.fillPoints(pts, true);
    g.lineStyle(2, 0x000000, 0.6 * alpha);
    g.strokePoints(pts, true);
  } else {
    g.lineStyle(3, color, alpha);
    g.strokePoints(pts, true);
  }
}

/** Saignement : dégâts lents qui ignorent l'armure. */
const BLEED_COLOR = '#c94a4a';
/** Couleur de la Marque (Sentinelle) : celle de la famille Précision. */
const MARK_COLOR = FAMILY_INFO.precision.hex;
const MARK_HEX = FAMILY_INFO.precision.color;

interface Actor {
  side: Side;
  x: number;
  feet: number;
  muzzle: { x: number; y: number };
  chest: { x: number; y: number };
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  fig: Container;
  bars: Phaser.GameObjects.Graphics;
  hpText: Phaser.GameObjects.Text;
  barW: number;
  barX: number;
  barY: number;
  /** Combat v2 : Endurance (Infinity = pas de jauge), cumuls de Brûlure et de Choc, dernier « essoufflé » affiché. */
  end: number;
  endMax: number;
  endRegen: number;
  burn: number;
  shock: number;
  shockMax: number;
  lastTired: number;
  /** Dernier « PERCE L'ARMURE » affiché (temps du duel), pour ne pas en couvrir l'écran. */
  lastPierce: number;
  chips: Phaser.GameObjects.Text[];
}

interface DuelPlay {
  result: DuelResult;
  idx: number;
  t: number;
}

const LONG_PRESS_MS = 450;
const DRAG_THRESHOLD = 12;
const QUALITY: Record<BotBuild['quality'], { label: string; color: number; hex: string }> = {
  faible: { label: 'FAIBLE', color: 0x86a95a, hex: '#a8c97a' },
  normal: { label: 'NORMAL', color: 0xe9c46a, hex: '#e9c46a' },
  fort: { label: 'FORT', color: 0xc94a4a, hex: '#ef7b72' },
};
const GOLD = '#e9c46a';
const CRATE_TITLE: Record<CrateKind, string> = { caisse: 'CAISSE DE RAVITAILLEMENT', caisse_renforcee: 'CAISSE RENFORCÉE', caisse_epique: 'CAISSE ÉPIQUE', largage: 'LARGAGE : TON ARME' };
/** Violet de la caisse épique (ancienne couleur Épique). */
const EPIC_HEX = '#8f6bb8';
const EPIC_COLOR = 0x8f6bb8;

const inRect = (px: number, py: number, r: { x: number; y: number; w: number; h: number }) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

export default class LoadoutScene extends Phaser.Scene {
  private run!: RunState;
  private mode: LoadoutMode = 'manage';
  private loot?: Loot;
  /** Caisse ouverte (mode caisse) ; la caisse épique a une présentation violet et or. */
  private crate: CrateKind = 'caisse';
  private epic = false;
  private phase: Phase = 'edit';
  private params: DuelParams | null = null;
  private bot: BotBuild | null = null;
  private botL: PlayerLoadout | null = null;
  /** Ce que fait le bouton principal après un duel. */
  private post: { label: string; go: () => void } | null = null;

  private views = new Map<number, Container>();
  private bagViews = new Map<number, Container>();
  private trayViews = new Map<number, Container>();
  private trayBagViews = new Map<number, Container>();
  private enemyViews = new Map<number, Container>();
  private trayItems: ItemInst[] = [];
  private trayBags: BagInst[] = [];
  /** Uids d'objets / de sacoches cachés le temps d'une animation (butin en vol, recette). */
  private hidden = new Set<number>();
  private hiddenBags = new Set<number>();
  private drag: DragState | null = null;
  private modal: Container | null = null;
  private play: DuelPlay | null = null;
  /** Marque (Sentinelle) : viseur posé sur le combattant marqué, par camp. */
  private markers: Partial<Record<Side, Container>> = {};
  /** Munitions de chaque arme pendant le duel (clé `côté:uid`) : balles dans le chargeur, capacité. */
  private ammo = new Map<string, { ammo: number; mag: number }>();
  /** Sacs des deux camps pendant le duel (bonus de Marque affiché). */
  private fightL: Record<Side, PlayerLoadout> | null = null;
  /** Rapport du dernier duel : ce que chaque objet a apporté, et de quoi le relire (objets et liens figés au combat). */
  private report: { rep: DuelReport; duration: number; win: boolean; defs: Record<Side, Map<number, string>>; links: Record<Side, SynergyLink[]> } | null = null;
  private reportLayer!: Container;
  private me: Actor | null = null;
  private foe: Actor | null = null;
  private popUid: number | null = null;
  private popBag: number | null = null;
  private linkKeys: Set<string> | null = null;
  private famTiers: Map<string, number> | null = null;
  private lastCredits = -1;
  private freeze = 0;
  /** Animation en cours (recette) : pas de rangement jusqu'à cet instant. */
  private lockUntil = 0;
  private shopAnimated = false;

  private gridG!: Phaser.GameObjects.Graphics;
  private bagLayer!: Container;
  private itemLayer!: Container;
  private linkG!: Phaser.GameObjects.Graphics;
  private unfedLayer!: Container;
  /** Pastilles « ★ n » des objets posés (étoiles remplies). */
  private starLayer!: Container;
  private previewG!: Phaser.GameObjects.Graphics;
  /** Étoiles affichées pendant qu'on tient un objet. */
  private starG!: Phaser.GameObjects.Graphics;
  /** Objet sélectionné (1er toucher) : ses fils de liens et de recettes sont affichés ; 2e toucher = rotation. */
  private selUid: number | null = null;
  private wireG!: Phaser.GameObjects.Graphics;
  /** Étoiles de l'objet sélectionné (graphique fixe, au-dessus des objets) et icônes des types attendus. */
  private selStarG!: Phaser.GameObjects.Graphics;
  private selStarIcons: Phaser.GameObjects.Image[] = [];
  private sellG!: Phaser.GameObjects.Graphics;
  private trayLayer!: Container;
  private stripLayer!: Container;
  private arenaLayer!: Container;
  private enemyLayer!: Container;
  private myStats!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private statusRight!: Phaser.GameObjects.Text;
  private reserveLabel!: Phaser.GameObjects.Text;
  private bagLabel!: Phaser.GameObjects.Text;
  private mainBtn!: Button;
  private altBtn!: Button;
  private speedBtn!: Button;
  private skipBtn!: Button;

  constructor() {
    super('loadout');
  }

  init(data: { mode?: LoadoutMode; loot?: Loot; crate?: CrateKind }) {
    this.run = this.registry.get('run');
    this.mode = data?.mode ?? 'manage';
    this.loot = data?.loot;
    this.crate = data?.crate ?? this.run?.pendingLoot?.crate ?? 'caisse';
    this.epic = this.crate === 'caisse_epique' && this.mode === 'caisse';
    this.phase = 'edit';
    this.params = null;
    this.bot = null;
    this.botL = null;
    this.post = null;
    this.views = new Map();
    this.bagViews = new Map();
    this.trayViews = new Map();
    this.trayBagViews = new Map();
    this.enemyViews = new Map();
    this.trayItems = [];
    this.trayBags = [];
    this.hidden = new Set();
    this.hiddenBags = new Set();
    this.drag = null;
    this.modal = null;
    this.play = null;
    this.markers = {};
    this.fightL = null;
    this.report = null;
    this.me = null;
    this.foe = null;
    this.popUid = null;
    this.popBag = null;
    this.selUid = null;
    this.linkKeys = null;
    this.famTiers = null;
    this.lastCredits = -1;
    this.freeze = 0;
    this.lockUntil = 0;
  }

  create() {
    fadeIn(this);
    this.drawStatic();
    this.gridG = this.add.graphics().setDepth(1);
    this.bagLayer = this.add.container(0, 0).setDepth(1.5);
    this.itemLayer = this.add.container(0, 0).setDepth(2);
    this.linkG = this.add.graphics().setDepth(5);
    this.unfedLayer = this.add.container(0, 0).setDepth(6);
    this.starLayer = this.add.container(0, 0).setDepth(6);
    this.reportLayer = this.add.container(0, 0).setDepth(6.5);
    this.previewG = this.add.graphics().setDepth(40);
    this.starG = this.add.graphics().setDepth(45);
    this.wireG = this.add.graphics().setDepth(44);
    this.selStarG = this.add.graphics().setDepth(44.5);
    this.sellG = this.add.graphics().setDepth(1.2);
    this.trayLayer = this.add.container(0, 0).setDepth(2);
    this.stripLayer = this.add.container(0, 0).setDepth(3);
    this.arenaLayer = this.add.container(0, 0).setDepth(3);
    this.enemyLayer = this.add.container(0, 0).setDepth(3);

    this.statusText = txt(this, 24, STATUS.h / 2, '', 26, C.accentStr, { fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.statusRight = txt(this, W - 24, STATUS.h / 2, '', 22, C.text, { fontStyle: 'bold' }).setOrigin(1, 0.5);
    this.reserveLabel = txt(this, RESERVE.x + 6, RESERVE.y + 6, '', 15, C.quiet, { fontStyle: 'bold' });
    this.bagLabel = txt(this, BAG_RESERVE.x + 6, BAG_RESERVE.y + 6, '', 15, C.quiet, { fontStyle: 'bold' });

    this.mainBtn = button(this, BUTTON.x + 240, BUTTON.y, BUTTON.w - 240, BUTTON.h, '', () => this.onMain(), { primary: true });
    this.altBtn = button(this, BUTTON.x, BUTTON.y, 224, BUTTON.h, '', () => this.onAlt(), { size: 24 });
    this.speedBtn = button(this, BUTTON.x, BUTTON.y, 224, BUTTON.h, '×1', () => this.cycleSpeed(), { size: 28 });
    this.skipBtn = button(this, BUTTON.x + 240, BUTTON.y, BUTTON.w - 240, BUTTON.h, 'Passer ▸▸', () => this.skipFight(), { size: 26 });
    for (const b of [this.mainBtn, this.altBtn, this.speedBtn, this.skipBtn]) b.root.setDepth(20);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.input.keyboard?.on('keydown-R', () => this.rotateDragged());

    if (this.mode === 'duel') this.enterDuel();
    else {
      this.refresh();
      // Un rangement laissé prêt à assembler (ancienne sauvegarde) s'assemble tout de suite.
      this.time.delayedCall(250, () => this.craftNow());
      if (this.mode === 'shop') this.time.delayedCall(120, () => this.openShop());
      if (this.mode === 'caisse' && this.loot && this.run.pendingLoot?.crate) {
        this.loot.bags.forEach((b) => this.hiddenBags.add(b.uid));
        this.refresh();
        this.time.delayedCall(200, () => this.openCrate(this.loot!));
      }
    }
  }

  // ---------------------------------------------------------------- décor fixe

  private drawStatic() {
    const g = this.add.graphics();
    g.fillStyle(0x0f0d13, 1);
    g.fillRect(STATUS.x, STATUS.y, STATUS.w, STATUS.h);
    g.lineStyle(2, C.panelLine, 1);
    g.lineBetween(0, STATUS.h, W, STATUS.h);

    panel(this, TRAY.x, TRAY.y, TRAY.w, TRAY.h);
    const tg = this.add.graphics();
    tg.fillStyle(C.danger, 0.1);
    tg.fillRoundedRect(SELL.x + 6, SELL.y + 8, SELL.w - 10, SELL.h - 16, 12);
    tg.lineStyle(2, C.danger, 0.55);
    tg.strokeRoundedRect(SELL.x + 6, SELL.y + 8, SELL.w - 10, SELL.h - 16, 12);
    txt(this, SELL.x + SELL.w / 2 + 2, SELL.y + SELL.h / 2 - 12, 'VENDRE', 17, C.dangerStr, { fontStyle: 'bold' }).setOrigin(0.5);
    txt(this, SELL.x + SELL.w / 2 + 2, SELL.y + SELL.h / 2 + 12, '50 %', 15, C.quiet).setOrigin(0.5);
    for (let i = 0; i < RESERVE.slots; i++) {
      const r = reserveSlot(i);
      tg.fillStyle(0x000000, 0.18);
      tg.fillRoundedRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 8);
      tg.lineStyle(2, C.cellLine, 1);
      tg.strokeRoundedRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 8);
    }
    const bw = BAG_RESERVE.w / BAG_RESERVE.slots;
    for (let i = 0; i < BAG_RESERVE.slots; i++) {
      tg.fillStyle(C.leather, 0.12);
      tg.fillRoundedRect(BAG_RESERVE.x + i * bw + 3, BAG_RESERVE.y + 28, bw - 6, BAG_RESERVE.h - 36, 10);
      tg.lineStyle(2, C.leatherLine, 0.45);
      tg.strokeRoundedRect(BAG_RESERVE.x + i * bw + 3, BAG_RESERVE.y + 28, bw - 6, BAG_RESERVE.h - 36, 10);
    }
  }

  // ---------------------------------------------------------------- grille

  private drawGrid() {
    const g = this.gridG;
    g.clear();
    // Cadre de la zone de pose (9 × 8)
    g.fillStyle(0x0f0d13, 0.6);
    g.fillRoundedRect(GRID_X - 6, GRID_Y - 6, COLS * CELL + 12, ROWS * CELL + 12, 14);
    // Cases hors du sac : à peine visibles (les sacoches s'y posent)
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        g.lineStyle(1, C.cellLine, 0.35);
        g.strokeRoundedRect(GRID_X + x * CELL + 8, GRID_Y + y * CELL + 8, CELL - 16, CELL - 16, 8);
      }
    }
    // Sac de base : toile cousue, sangles en haut
    const bx = GRID_X + BASE_X0 * CELL;
    const by = GRID_Y + BASE_Y0 * CELL;
    const bw = (BASE_X1 - BASE_X0 + 1) * CELL;
    const bh = (BASE_Y1 - BASE_Y0 + 1) * CELL;
    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(bx + 2, by + 6, bw, bh, 16);
    g.fillStyle(C.canvasLine, 1);
    g.fillRoundedRect(bx, by, bw, bh, 16);
    g.fillStyle(C.canvas, 1);
    g.fillRoundedRect(bx + 4, by + 4, bw - 8, bh - 8, 13);
    g.fillStyle(C.canvasLine, 0.8);
    for (let t = 16; t < bw - 16; t += 12) {
      g.fillRect(bx + t, by + 9, 6, 2);
      g.fillRect(bx + t, by + bh - 11, 6, 2);
    }
    for (let t = 16; t < bh - 16; t += 12) {
      g.fillRect(bx + 9, by + t, 2, 6);
      g.fillRect(bx + bw - 11, by + t, 2, 6);
    }
    for (const sx of [bx + bw * 0.28, bx + bw * 0.72]) {
      g.fillStyle(0x342e3c, 1);
      g.fillRoundedRect(sx - 9, by - 4, 18, 22, 4);
      g.lineStyle(2, 0x969678, 1);
      g.strokeRoundedRect(sx - 6, by + 4, 12, 10, 2);
    }
    for (let y = BASE_Y0; y <= BASE_Y1; y++) {
      for (let x = BASE_X0; x <= BASE_X1; x++) {
        g.fillStyle(0x000000, 0.2);
        g.fillRoundedRect(GRID_X + x * CELL + 10, GRID_Y + y * CELL + 10, CELL - 20, CELL - 20, 7);
      }
    }
  }

  private loadout() {
    return computeLoadout(this.run.items, this.run.operator, this.params?.maxHp ?? playerMaxHp(this.run, Math.min(this.run.round, FINAL_ROUND)), { wins: this.run.wins });
  }

  private refresh() {
    const { loadout, links, stars } = this.loadout();
    this.drawGrid();

    // Sacoches posées (sous les objets)
    this.bagLayer.removeAll(true);
    this.bagViews.clear();
    for (const b of this.run.bags.filter((v) => v.placed)) {
      const v = bagView(this, b, CELL).setPosition(GRID_X + b.x * CELL, GRID_Y + b.y * CELL);
      this.bagLayer.add(v);
      this.bagViews.set(b.uid, v);
      if (this.drag?.bag?.uid === b.uid && this.drag.moved) v.setVisible(false);
    }
    if (this.popBag !== null) {
      const v = this.bagViews.get(this.popBag);
      if (v) pop(this, v, 1.12);
      this.popBag = null;
    }

    // Objets posés
    this.itemLayer.removeAll(true);
    this.views.clear();
    for (const it of this.run.items.filter((i) => i.placed)) {
      const v = itemView(this, it, CELL).setPosition(GRID_X + it.x * CELL, GRID_Y + it.y * CELL);
      this.itemLayer.add(v);
      this.views.set(it.uid, v);
      if (this.hidden.has(it.uid)) v.setVisible(false);
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
      toast(this, `Synergie : ${fresh[0].label}`, C.accentStr, 600);
      sfx('link');
      vibrate([12, 40, 12]);
    }
    const tiers = new Map(loadout.families.map((f) => [f.family, f.tier] as [string, number]));
    if (this.famTiers) {
      for (const f of loadout.families) {
        if (f.tier > (this.famTiers.get(f.family) ?? 0)) {
          const fi = FAMILY_INFO[f.family];
          this.time.delayedCall(fresh.length ? 700 : 0, () => toast(this, `${fi.name} palier ${f.tier === 2 ? 4 : 2} : ${f.tier === 2 ? fi.tier4 : fi.tier2}`, fi.hex, 660));
          this.cameras.main.flash(160, 255, 210, 140);
          sfx('craft', { pitch: 1.25 });
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
      this.linkG.fillStyle(0x000000, 0.5);
      if (dx !== 0) this.linkG.fillRoundedRect(ex - 6, ey - 21, 12, 42, 5);
      else this.linkG.fillRoundedRect(ex - 21, ey - 6, 42, 12, 5);
      this.linkG.fillStyle(GOLD_HEX, 1);
      if (dx !== 0) this.linkG.fillRoundedRect(ex - 4, ey - 19, 8, 38, 4);
      else this.linkG.fillRoundedRect(ex - 19, ey - 4, 38, 8, 4);
    }
    // Armes sans chargeur de leur calibre : pastille « recharge ×2 ».
    this.unfedLayer.removeAll(true);
    for (const w of loadout.weapons) {
      if (w.fed) continue;
      const inst = this.run.items.find((i) => i.uid === w.uid);
      if (!inst || this.drag?.item?.uid === inst.uid || this.hidden.has(inst.uid)) continue;
      const [cx, cy] = cellsAt(inst, inst.x, inst.y)[0];
      const bx = GRID_X + cx * CELL + 5;
      const by = GRID_Y + cy * CELL + CELL - 26;
      const g = this.add.graphics();
      g.fillStyle(C.danger, 1);
      g.fillRoundedRect(bx, by, 58, 20, 6);
      this.unfedLayer.add([g, txt(this, bx + 29, by + 10, 'RECH ×2', 12, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5)]);
    }

    // Étoiles remplies : pastille « ★ n » en haut à droite de l'objet porteur.
    this.starLayer.removeAll(true);
    const lit = new Map<number, number>();
    for (const f of stars) if (f.by.length) lit.set(f.uid, (lit.get(f.uid) ?? 0) + f.by.length);
    for (const [uid, n] of lit) {
      const inst = this.run.items.find((i) => i.uid === uid);
      if (!inst || this.drag?.item?.uid === uid || this.hidden.has(uid)) continue;
      const row = maskOf(inst.defId, inst.rot)[0];
      const rx = row.length - 1 - [...row].reverse().findIndex(Boolean);
      const bx = GRID_X + (inst.x + rx + 1) * CELL - 6;
      const by = GRID_Y + inst.y * CELL + 6;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.65);
      g.fillRoundedRect(bx - 40, by, 40, 22, 11);
      drawStar(g, bx - 28, by + 11, 8, true, GOLD_HEX, 1);
      this.starLayer.add([g, txt(this, bx - 8, by + 11, `${n}`, 15, GOLD, { fontStyle: 'bold' }).setOrigin(1, 0.5)]);
    }

    this.drawReportBadges();
    this.drawWires(links);

    this.drawTray();
    this.drawStatus();
    // En duel, les vues des objets viennent d'être recréées : on y remet les compteurs de munitions.
    for (const key of this.ammo.keys()) {
      const [side, uid] = key.split(':');
      this.showAmmo(side as Side, Number(uid));
    }

    if (this.phase === 'edit') this.drawStripInfo(loadout, links.length);
    else this.updateMyStats(loadout);
    this.updateButtons();
    saveRun(this.run);
  }

  private drawTray() {
    this.trayLayer.removeAll(true);
    this.trayViews.clear();
    this.trayBagViews.clear();
    this.trayItems = reserve(this.run);
    this.trayBags = reserveBags(this.run);
    const innerH = RESERVE.h - 58;
    this.trayItems.slice(0, RESERVE.slots).forEach((it, i) => {
      const { w, h } = dims(it);
      const r = reserveSlot(i);
      const s = Math.min((r.w - 10) / (w * CELL), (r.h - 8) / (h * CELL), 0.6);
      const v = itemView(this, it, CELL).setScale(s);
      v.setPosition(r.x + (r.w - w * CELL * s) / 2, r.y + (r.h - h * CELL * s) / 2);
      this.trayLayer.add(v);
      this.trayViews.set(it.uid, v);
      if (this.hidden.has(it.uid) || (this.drag?.item?.uid === it.uid && this.drag.moved)) v.setVisible(false);
    });
    const bw = BAG_RESERVE.w / BAG_RESERVE.slots;
    this.trayBags.slice(0, BAG_RESERVE.slots).forEach((b, i) => {
      const { w, h } = dims(b);
      const s = Math.min((bw - 14) / (w * CELL), innerH / (h * CELL), 0.6);
      const v = bagView(this, b, CELL).setScale(s);
      const sx = BAG_RESERVE.x + i * bw;
      v.setPosition(sx + (bw - w * CELL * s) / 2, BAG_RESERVE.y + 32 + (innerH - h * CELL * s) / 2);
      this.trayLayer.add(v);
      this.trayBagViews.set(b.uid, v);
      if (this.hiddenBags.has(b.uid) || (this.drag?.bag?.uid === b.uid && this.drag.moved)) v.setVisible(false);
      this.trayLayer.add(txt(this, sx + bw / 2, BAG_RESERVE.y + BAG_RESERVE.h - 16, BAGS[b.defId as BagId].short, 12, '#f8d9ab', { fontStyle: 'bold' }).setOrigin(0.5));
    });
    this.reserveLabel.setText(`RÉSERVE ${this.trayItems.length}/${RESERVE_MAX}`);
    this.bagLabel.setText(`SACOCHES ${this.trayBags.length}/${BAG_RESERVE_MAX}`);
  }

  private drawStatus() {
    const r = this.run;
    if (this.lastCredits >= 0 && r.credits !== this.lastCredits) {
      this.tweens.killTweensOf(this.statusText);
      this.statusText.setScale(1.25);
      this.tweens.add({ targets: this.statusText, scale: 1, duration: 320, ease: 'Back.Out' });
      const diff = r.credits - this.lastCredits;
      const f = txt(this, this.statusText.x + this.statusText.width + 14, STATUS.h / 2, `${diff > 0 ? '+' : ''}${diff}`, 22, diff > 0 ? C.goodStr : C.dangerStr, { fontStyle: 'bold' })
        .setOrigin(0, 0.5).setDepth(60);
      this.tweens.add({ targets: f, y: f.y + 22, alpha: 0, delay: 500, duration: 500, onComplete: () => f.destroy() });
    }
    this.lastCredits = r.credits;
    this.statusText.setText(`◆ ${r.credits} cr`);
    let right: string;
    const p = this.params;
    if (p?.type === 'final' || r.round >= FINAL_ROUND) right = 'DERNIER CERCLE · TOP 1';
    else if (p?.type === 'goulag') right = `GOULAG · CERCLE ${r.round + 1}/${ROUNDS}`;
    else if (r.zoneId !== null) {
      const n = Math.min(ACTIONS_PER_ZONE, ACTIONS_PER_ZONE - r.actionsLeft + (this.mode === 'manage' ? 0 : 1));
      right = `CERCLE ${r.round + 1}/${ROUNDS} · ACTION ${Math.max(1, n)}/${ACTIONS_PER_ZONE}`;
    } else right = `CERCLE ${r.round + 1}/${ROUNDS}`;
    this.statusRight.setText(right);
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

  /** Bandeau du haut hors duel : stats du sac et contexte. */
  private drawStripInfo(loadout: PlayerLoadout, nLinks: number) {
    const L = this.stripLayer;
    L.removeAll(true);
    L.add(panel(this, COMBAT.x, COMBAT.y, COMBAT.w, COMBAT.h));
    const x0 = COMBAT.x + 22;
    let y = COMBAT.y + 18;
    const op = OPERATORS[this.run.operator];
    L.add(txt(this, x0, y, op.name.toUpperCase(), 22, C.accentStr, { fontStyle: 'bold' }));
    L.add(txt(this, x0, y + 28, op.passive, 14, C.quiet, { wordWrap: { width: 290 } }));
    y += 62;
    const fed = loadout.weapons.filter((w) => w.fed).length;
    const rows: [string, string, string?][] = [
      ['PV', `${loadout.maxHp}`, C.goodStr],
      ['Armure', `${loadout.armor}`],
      ['DPS estimé', `${Math.round(estimateDps(loadout))}`, C.accentStr],
      ['Armes alimentées', `${fed}/${loadout.weapons.length}`, loadout.weapons.some((w) => !w.fed) ? C.dangerStr : C.goodStr],
      ['Synergies', `${nLinks}`, nLinks ? C.accentStr : undefined],
    ];
    for (const [k, v, col] of rows) {
      L.add(txt(this, x0, y, k, 18, C.quiet));
      L.add(txt(this, x0 + 290, y, v, 19, col ?? C.text, { fontFamily: MONO, fontStyle: 'bold' }).setOrigin(1, 0));
      y += 27;
    }
    y += 6;
    const fams = loadout.families.slice(0, 3);
    fams.forEach((f, i) => {
      const fi = FAMILY_INFO[f.family];
      const fx = x0 + i * 100;
      const pips = Array.from({ length: 4 }, (_, j) => (j < f.count ? '●' : '○')).join('');
      L.add(txt(this, fx, y, fi.name, 14, f.tier ? fi.hex : C.quiet, { fontStyle: 'bold' }));
      L.add(txt(this, fx, y + 17, pips, 14, fi.hex));
    });

    // Colonne de droite : contexte
    const x1 = COMBAT.x + 350;
    L.add(this.add.rectangle(x1 - 16, COMBAT.y + 18, 2, COMBAT.h - 36, C.panelLine).setOrigin(0));
    let y1 = COMBAT.y + 18;
    const title = this.mode === 'shop' ? (this.run.resupply ? 'RAVITAILLEMENT' : 'BOUTIQUE') : this.mode === 'caisse' ? CRATE_TITLE[this.crate] : 'SAC À DOS';
    L.add(txt(this, x1, y1, title, 22, C.text, { fontStyle: 'bold', wordWrap: { width: 310 } }));
    y1 += 40;
    const lines: [string, string][] = [];
    if (this.mode === 'shop') {
      lines.push([this.run.resupply ? 'Le cercle se resserre : achète et range avant la suite.' : 'Achète, range, puis termine l\'action.', C.text]);
      if (this.run.resupply && this.run.lastIncome) lines.push([`Intendance : +${this.run.lastIncome} cr`, C.accentStr]);
      lines.push([`Relance : ${rerollCost(this.run)} cr`, C.quiet]);
    } else if (this.mode === 'caisse') {
      const l = this.loot;
      if (l?.credits) lines.push([`Cash ramassé : +${l.credits} cr`, C.accentStr]);
      for (const b of l?.bags ?? []) lines.push([`${BAGS[b.defId as BagId].name} : +${cellCount(b.defId)} cases`, '#f8d9ab']);
      lines.push(['Range le butin puis termine.', C.quiet]);
    }
    lines.push(['Glisse objets et sacoches.', C.quiet]);
    lines.push(['Touche : tourner · appui long : infos.', C.quiet]);
    lines.push(['Ingrédients côte à côte : la recette s\'assemble seule.', GOLD]);
    for (const [s, col] of lines) {
      const t = txt(this, x1, y1, s, 16, col, { wordWrap: { width: 310 } });
      L.add(t);
      y1 += t.height + 6;
      if (y1 > COMBAT.y + COMBAT.h - 24) break;
    }
  }

  private updateButtons() {
    const p = this.phase;
    const fighting = p === 'combat';
    this.speedBtn.root.setVisible(fighting);
    this.skipBtn.root.setVisible(fighting);
    this.mainBtn.root.setVisible(!fighting);
    this.speedBtn.setLabel(`×${this.speed}`);
    let alt = '';
    if (p === 'prep') alt = 'Son sac';
    else if ((p === 'result' || p === 'over') && this.report) alt = 'Rapport';
    else if (p === 'edit' && this.mode === 'shop') alt = 'Boutique';
    this.altBtn.root.setVisible(!fighting && alt !== '');
    this.altBtn.setLabel(alt);
    let label = '';
    if (p === 'prep') label = this.params?.type === 'goulag' ? 'Au Goulag !' : this.params?.type === 'final' ? 'Top 1 : combat !' : 'Combat !';
    else if (p === 'result' || p === 'over') label = this.post?.label ?? 'Continuer';
    else if (this.mode === 'manage') label = this.run.zoneId !== null && this.run.actionsLeft > 0 ? 'Retour à la zone' : 'Retour à la carte';
    else label = 'Terminer';
    this.mainBtn.setLabel(label);
    this.mainBtn.setEnabled(!this.modal);
    // Sans bouton secondaire, le bouton principal prend toute la largeur.
    const full = !this.altBtn.root.visible;
    if (full !== this.mainBtn.root.getData('full')) {
      this.mainBtn.root.destroy();
      this.mainBtn = button(this, full ? BUTTON.x : BUTTON.x + 240, BUTTON.y, full ? BUTTON.w : BUTTON.w - 240, BUTTON.h, label, () => this.onMain(), { primary: true });
      this.mainBtn.root.setDepth(20).setData('full', full).setVisible(!fighting);
      this.mainBtn.setEnabled(!this.modal);
    }
  }

  // ---------------------------------------------------------------- entrées

  private editable() {
    return !this.modal && this.time.now >= this.lockUntil && (this.phase === 'edit' || this.phase === 'prep' || this.phase === 'result');
  }

  private gridCell(px: number, py: number): [number, number] | null {
    const cx = Math.floor((px - GRID_X) / CELL);
    const cy = Math.floor((py - GRID_Y) / CELL);
    return cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS ? [cx, cy] : null;
  }

  private traySlot(px: number, py: number): ItemInst | undefined {
    if (!inRect(px, py, RESERVE)) return undefined;
    for (let i = 0; i < this.trayItems.length; i++) {
      const r = reserveSlot(i);
      if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return this.trayItems[i];
    }
    return undefined;
  }

  private trayBagSlot(px: number, py: number): BagInst | undefined {
    if (!inRect(px, py, BAG_RESERVE)) return undefined;
    return this.trayBags[Math.floor((px - BAG_RESERVE.x) / (BAG_RESERVE.w / BAG_RESERVE.slots))];
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (!this.editable()) return;
    if ((this.phase === 'prep' || this.phase === 'result') && this.bot && inRect(p.x, p.y, ENEMY)) {
      this.openEnemy();
      return;
    }
    const cell = this.gridCell(p.x, p.y);
    let item: ItemInst | undefined;
    let bag: BagInst | undefined;
    let from: 'grid' | 'tray' = 'grid';
    if (cell) {
      item = itemAt(this.run.items, cell[0], cell[1]);
      if (!item) bag = bagAt(this.run.bags, cell[0], cell[1]);
    }
    if (!item && !bag) {
      from = 'tray';
      item = this.traySlot(p.x, p.y);
      if (!item) bag = this.trayBagSlot(p.x, p.y);
    }
    const inst = item ?? bag;
    if (!inst) {
      this.select(null);
      return;
    }
    const { w, h } = dims(inst);
    const d: DragState = {
      item, bag, from, downX: p.x, downY: p.y, moved: false, rot: inst.rot,
      grabX: from === 'grid' ? p.x - (GRID_X + inst.x * CELL) : (w * CELL) / 2,
      grabY: from === 'grid' ? p.y - (GRID_Y + inst.y * CELL) : (h * CELL) / 2,
      lift: p.wasTouch ? 70 : 0,
    };
    d.longPress = this.time.delayedCall(LONG_PRESS_MS, () => {
      if (this.drag === d && !d.moved) {
        this.drag = null;
        vibrate(15);
        if (d.item) this.showInfo(d.item);
        else if (d.bag) this.showBagInfo(d.bag);
      }
    });
    this.drag = d;
  }

  private onMove(p: Phaser.Input.Pointer) {
    const d = this.drag;
    if (!d || !p.isDown) return;
    if (!d.moved && Phaser.Math.Distance.Between(p.x, p.y, d.downX, d.downY) > DRAG_THRESHOLD) {
      d.longPress?.remove();
      // Une sacoche posée qui porte des objets ne bouge pas.
      if (d.bag && d.bag.placed && !canMoveBag(this.run.items, d.bag)) {
        this.drag = null;
        this.bagLocked(d.bag);
        return;
      }
      d.moved = true;
      this.select(null);
      this.makeGhost(d);
      if (d.item) (d.from === 'grid' ? this.views : this.trayViews).get(d.item.uid)?.setVisible(false);
      if (d.bag) (d.from === 'grid' ? this.bagViews : this.trayBagViews).get(d.bag.uid)?.setVisible(false);
      sfx('pickup');
      vibrate(6);
    }
    if (d.moved) this.updateGhost(p.x, p.y);
  }

  private bagLocked(b: BagInst) {
    const v = this.bagViews.get(b.uid);
    if (v) {
      const x0 = GRID_X + b.x * CELL;
      this.tweens.killTweensOf(v);
      this.tweens.add({ targets: v, x: { from: x0 - 8, to: x0 }, duration: 260, ease: 'Elastic.Out' });
    }
    // Les objets posés dessus tremblent aussi
    for (const it of this.run.items) {
      if (!it.placed || !cellsAt(it, it.x, it.y).some(([cx, cy]) => bagAt([b], cx, cy))) continue;
      const iv = this.views.get(it.uid);
      if (!iv) continue;
      const x0 = GRID_X + it.x * CELL;
      this.tweens.killTweensOf(iv);
      this.tweens.add({ targets: iv, x: { from: x0 - 8, to: x0 }, duration: 260, ease: 'Elastic.Out' });
    }
    vibrate([10, 30, 10]);
    toast(this, 'Vide la sacoche pour la déplacer', C.dangerStr, 880);
  }

  private makeGhost(d: DragState) {
    d.ghost?.destroy();
    const ghost = this.add.container(0, 0).setDepth(50);
    const inst = (d.item ?? d.bag)!;
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.45);
    fillMask(shadow, maskOf(inst.defId, d.rot), CELL, 4, 12, 10, 14);
    const view = d.item ? itemView(this, { ...d.item, rot: d.rot }, CELL) : bagView(this, { defId: d.bag!.defId, rot: d.rot }, CELL);
    ghost.add([shadow, view]);
    ghost.setSize(dims(inst, d.rot).w * CELL, dims(inst, d.rot).h * CELL);
    d.ghost = ghost;
  }

  private rotateDragged() {
    const d = this.drag;
    if (!d || !d.moved) return;
    d.rot = nextRot(d.rot);
    const { w, h } = dims((d.item ?? d.bag)!, d.rot);
    d.grabX = (w * CELL) / 2;
    d.grabY = (h * CELL) / 2;
    this.makeGhost(d);
    const p = this.input.activePointer;
    this.updateGhost(p.x, p.y);
  }

  /** Ancre (case haut-gauche) visée par le fantôme, et si son centre est au-dessus de la grille. */
  private dropAnchor(d: DragState, px: number, py: number) {
    const gx = px - d.grabX;
    const gy = py - d.grabY - d.lift;
    const { w, h } = dims((d.item ?? d.bag)!, d.rot);
    const ax = Math.round((gx - GRID_X) / CELL);
    const ay = Math.round((gy - GRID_Y) / CELL);
    const cxp = gx + (w * CELL) / 2;
    const cyp = gy + (h * CELL) / 2;
    const overGrid = cxp > GRID_X - CELL / 2 && cxp < GRID_X + COLS * CELL + CELL / 2 && cyp > GRID_Y - CELL / 2 && cyp < GRID_Y + ROWS * CELL + CELL / 2;
    return { gx, gy, ax, ay, overGrid };
  }

  private validDrop(d: DragState, ax: number, ay: number): boolean {
    if (d.item) return canPlace(this.run.items, d.item, ax, ay, d.rot, usable(this.run));
    return canPlaceBag(this.run.bags, this.run.items, d.bag!, ax, ay, d.rot);
  }

  private updateGhost(px: number, py: number) {
    const d = this.drag;
    if (!d?.ghost) return;
    const a = this.dropAnchor(d, px, py);
    d.ghost.setPosition(a.gx, a.gy);
    this.previewG.clear();
    // Zone de vente en surbrillance
    this.sellG.clear();
    if (inRect(px, py, SELL)) {
      this.sellG.fillStyle(C.danger, 0.35);
      this.sellG.fillRoundedRect(SELL.x + 6, SELL.y + 8, SELL.w - 10, SELL.h - 16, 12);
    }
    if (d.item) this.drawStarHints(d.item, d.rot, a.overGrid && this.validDrop(d, a.ax, a.ay) ? a : null);
    if (!a.overGrid) return;
    const valid = this.validDrop(d, a.ax, a.ay);
    const col = valid ? (d.bag ? 0xf4b06a : C.good) : C.danger;
    for (const [cx, cy] of cellsAt((d.item ?? d.bag)!, a.ax, a.ay, d.rot)) {
      if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) continue;
      this.previewG.fillStyle(col, 0.3);
      this.previewG.fillRoundedRect(GRID_X + cx * CELL + 3, GRID_Y + cy * CELL + 3, CELL - 6, CELL - 6, 8);
      this.previewG.lineStyle(2, col, 0.9);
      this.previewG.strokeRoundedRect(GRID_X + cx * CELL + 3, GRID_Y + cy * CELL + 3, CELL - 6, CELL - 6, 8);
    }
  }

  /** Sélectionne un objet (null = aucun) et redessine ses fils. */
  private select(uid: number | null) {
    if (this.selUid === uid) return;
    this.selUid = uid;
    if (uid !== null) {
      sfx('click', { pitch: 1.3, vol: 0.6 });
      vibrate(5);
    }
    this.drawWires(this.loadout().links);
  }

  /**
   * Fils de l'objet sélectionné :
   * - doré plein vers un objet qui lui est lié en ce moment (étoile ou accessoire allumé) ;
   * - doré en pointillé vers un objet compatible mais pas encore collé ;
   * - bleu en pointillé vers un objet (sac ou réserve) avec lequel il forme une recette.
   */
  private drawWires(links: { a: number; b: number }[]) {
    const g = this.wireG;
    g.clear();
    this.selStarG.clear();
    for (const ic of this.selStarIcons) ic.destroy();
    this.selStarIcons = [];
    this.tweens.killTweensOf(g);
    g.setAlpha(1);
    const uid = this.selUid;
    const sel = uid === null ? undefined : this.run.items.find((i) => i.uid === uid);
    const view = sel ? (sel.placed ? this.views.get(sel.uid) : this.trayViews.get(sel.uid)) : undefined;
    if (!sel || !view || !view.visible || this.phase === 'combat' || this.modal) {
      if (uid !== null && !sel) this.selUid = null;
      return;
    }
    const center = (it: ItemInst): Phaser.Math.Vector2 | null => {
      const v = it.placed ? this.views.get(it.uid) : this.trayViews.get(it.uid);
      if (!v || !v.visible) return null;
      const b = v.getBounds();
      return new Phaser.Math.Vector2(b.centerX, b.centerY);
    };
    const from = center(sel);
    if (!from) return;
    const sd = ITEMS[sel.defId];
    const others = this.run.items.filter((o) => o.uid !== sel.uid);
    const active = new Set(links.filter((l) => l.a === sel.uid || l.b === sel.uid).map((l) => (l.a === sel.uid ? l.b : l.a)));
    let n = 0;
    // Liens (étoiles et accessoires) avec les objets posés
    for (const o of others) {
      if (!o.placed) continue;
      const od = ITEMS[o.defId];
      const compatible = starSpecs(sel.defId).some((sp) => sp.wants(od)) || starSpecs(o.defId).some((sp) => sp.wants(sd));
      if (!compatible) continue;
      const to = center(o);
      if (!to) continue;
      this.wire(g, from, to, GOLD_HEX, !(sel.placed && active.has(o.uid)), 1);
      n++;
    }
    // Recettes : les autres ingrédients présents dans le sac ou la réserve
    const partners = new Set<number>();
    for (const r of RECIPES) {
      if (!r.inputs.includes(sel.defId)) continue;
      const rest = [...r.inputs];
      rest.splice(rest.indexOf(sel.defId), 1);
      for (const id of rest) for (const o of others) if (o.defId === id) partners.add(o.uid);
    }
    for (const pu of partners) {
      const o = others.find((x) => x.uid === pu)!;
      const to = center(o);
      if (!to) continue;
      this.wire(g, from, to, P.precision, true, -1);
      n++;
    }
    // Contour de l'objet sélectionné
    const b = view.getBounds();
    g.lineStyle(3, P.blanc, 0.9);
    g.strokeRoundedRect(b.x - 3, b.y - 3, b.width + 6, b.height + 6, 10);
    this.drawSelectedStars(sel);
    if (!n) return;
    this.tweens.add({ targets: g, alpha: 0.65, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /**
   * Étoiles de l'objet sélectionné, sur leurs cases exactes (elles tournent avec lui) :
   * dorée pleine = remplie ; creuse + icône du type attendu = vide. Plus, en petit, les cases libres où il
   * allumerait l'étoile d'un autre objet (utile pour un objet encore en réserve).
   */
  private drawSelectedStars(sel: ItemInst) {
    const g = this.selStarG;
    const placed = this.run.items.filter((i) => i.placed);
    const occupied = new Set(placed.flatMap((o) => cellsOf(o).map(([x, y]) => `${x},${y}`)));
    const use = usable(this.run);
    const inGrid = (x: number, y: number) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
    const cx = (x: number) => GRID_X + (x + 0.5) * CELL;
    const cy = (y: number) => GRID_Y + (y + 0.5) * CELL;
    const shown = new Set<string>();
    if (sel.placed) {
      for (const f of bagStars(placed)) {
        if (f.uid !== sel.uid) continue;
        const spec = starSpecs(sel.defId)[f.spec];
        if (!spec.at) continue; // étoile « tout autour » (accessoires) : les fils dorés la montrent déjà
        for (const c of f.cells) {
          if (!inGrid(c.x, c.y)) continue;
          const k = `${c.x},${c.y}`;
          shown.add(k);
          if (c.by !== null) {
            drawStar(g, cx(c.x), cy(c.y), CELL * 0.22, true, GOLD_HEX, 1);
          } else {
            const free = !occupied.has(k) && use.has(k);
            g.fillStyle(P.nuit, free ? 0.55 : 0.35);
            g.fillCircle(cx(c.x), cy(c.y), CELL * 0.3);
            drawStar(g, cx(c.x), cy(c.y) - CELL * 0.08, CELL * 0.2, false, GOLD_HEX, free ? 0.95 : 0.5);
            const key = spec.want?.[0] ? TAG_ICON[spec.want[0]] : undefined;
            if (key && this.textures.exists(key)) {
              this.selStarIcons.push(this.add.image(cx(c.x), cy(c.y) + CELL * 0.18, key).setDisplaySize(CELL * 0.22, CELL * 0.22).setTint(GOLD_HEX).setAlpha(free ? 0.9 : 0.45).setDepth(44.6));
            }
          }
        }
      }
    }
    // Cases libres où il allumerait l'étoile précise d'un autre objet
    const sd = ITEMS[sel.defId];
    for (const f of bagStars(placed)) {
      if (f.uid === sel.uid) continue;
      const holder = placed.find((o) => o.uid === f.uid)!;
      const spec = starSpecs(holder.defId)[f.spec];
      if (!spec.at || !spec.wants(sd)) continue;
      for (const c of f.cells) {
        const k = `${c.x},${c.y}`;
        if (shown.has(k) || occupied.has(k) || !use.has(k) || !inGrid(c.x, c.y)) continue;
        shown.add(k);
        drawStar(g, cx(c.x), cy(c.y), CELL * 0.16, false, GOLD_HEX, 0.7);
      }
    }
  }

  /** Un fil courbe de `a` vers `b` (plein ou en pointillé), avec une pastille à l'arrivée. `bend` = côté de la courbe. */
  private wire(g: Phaser.GameObjects.Graphics, a: Phaser.Math.Vector2, b: Phaser.Math.Vector2, color: number, dashed: boolean, bend: number) {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const k = Math.min(40, len * 0.25) * bend;
    const ctrl = new Phaser.Math.Vector2(mx - (dy / len) * k, my + (dx / len) * k);
    const pts = new Phaser.Curves.QuadraticBezier(a, ctrl, b).getPoints(Math.max(8, Math.round(len / 10)));
    g.lineStyle(dashed ? 3 : 5, P.nuit, 0.6);
    for (let i = 1; i < pts.length; i++) if (!dashed || i % 2) g.lineBetween(pts[i - 1].x, pts[i - 1].y + 2, pts[i].x, pts[i].y + 2);
    g.lineStyle(dashed ? 3 : 4, color, 1);
    for (let i = 1; i < pts.length; i++) if (!dashed || i % 2) g.lineBetween(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    g.fillStyle(color, 1);
    g.fillCircle(b.x, b.y, dashed ? 5 : 7);
    g.fillStyle(P.nuit, 1);
    g.fillCircle(b.x, b.y, dashed ? 2 : 3);
  }

  /**
   * Étoiles pendant qu'on tient un objet :
   * - étoile creuse dorée sur les cases libres où un objet posé attend ce type d'objet (« pose-moi ici ») ;
   * - contour vert autour des objets posés que ses propres étoiles attendent ;
   * - à l'endroit visé (si on peut y poser l'objet), étoiles pleines là où une étoile s'allumerait.
   */
  private drawStarHints(cand: ItemInst, rot: Rot, at: { ax: number; ay: number } | null) {
    const g = this.starG;
    g.clear();
    const cd = ITEMS[cand.defId];
    const others = this.run.items.filter((i) => i.placed && i.uid !== cand.uid);
    const occupied = new Set(others.flatMap((o) => cellsOf(o).map(([x, y]) => `${x},${y}`)));
    const use = usable(this.run);
    const cx = (x: number) => GRID_X + (x + 0.5) * CELL;
    const cy = (y: number) => GRID_Y + (y + 0.5) * CELL;
    const hinted = new Set<string>();
    for (const f of bagStars(others)) {
      const holder = others.find((o) => o.uid === f.uid)!;
      if (!starSpecs(holder.defId)[f.spec].wants(cd)) continue;
      for (const c of f.cells) {
        const k = `${c.x},${c.y}`;
        if (occupied.has(k) || !use.has(k) || hinted.has(k)) continue;
        hinted.add(k);
        drawStar(g, cx(c.x), cy(c.y), CELL * 0.2, false, GOLD_HEX, 0.75);
      }
    }
    const wanted = others.filter((o) => starSpecs(cand.defId).some((sp) => sp.wants(ITEMS[o.defId])));
    // Cases libres à côté des objets que ses étoiles attendent : c'est là qu'il faut le poser.
    for (const o of wanted) {
      for (const [x, y] of cellsOf(o)) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = `${x + dx},${y + dy}`;
          if (occupied.has(k) || !use.has(k) || hinted.has(k)) continue;
          hinted.add(k);
          drawStar(g, cx(x + dx), cy(y + dy), CELL * 0.2, false, GOLD_HEX, 0.75);
        }
      }
    }
    g.lineStyle(4, C.good, 0.85);
    for (const o of wanted) for (const [x, y] of cellsOf(o)) g.strokeRoundedRect(GRID_X + x * CELL + 4, GRID_Y + y * CELL + 4, CELL - 8, CELL - 8, 8);
    if (!at) return;
    for (const f of starsLitBy(this.run.items, cand, at.ax, at.ay, rot)) {
      for (const c of f.cells) {
        if (c.by === null || (f.uid !== cand.uid && c.by !== cand.uid)) continue;
        drawStar(g, cx(c.x), cy(c.y), CELL * 0.24, true, GOLD_HEX, 1);
      }
    }
  }

  private onUp(p: Phaser.Input.Pointer) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    d.longPress?.remove();
    this.previewG.clear();
    this.starG.clear();
    this.sellG.clear();
    if (!d.moved) {
      // Objet : 1er toucher = sélection (fils de liens), 2e toucher sur le même = rotation.
      if (d.item) {
        if (this.selUid === d.item.uid) this.rotateItemInPlace(d.item, d.from);
        else this.select(d.item.uid);
      } else if (d.bag) this.rotateBagInPlace(d.bag, d.from);
      return;
    }
    d.ghost?.destroy();
    if (d.item) this.dropItem(d, p);
    else this.dropBag(d, p);
  }

  private dropItem(d: DragState, p: Phaser.Input.Pointer) {
    const inst = d.item!;
    const a = this.dropAnchor(d, p.x, p.y);
    if (inRect(p.x, p.y, SELL)) {
      const v = sellItem(this.run, inst.uid);
      toast(this, `Vendu : +${v} cr`, C.accentStr, 880);
      this.coinBurst(p.x, p.y);
      sfx('sell');
      vibrate(10);
    } else if (a.overGrid) {
      if (canPlace(this.run.items, inst, a.ax, a.ay, d.rot, usable(this.run))) {
        Object.assign(inst, { x: a.ax, y: a.ay, rot: d.rot, placed: true });
        this.popUid = inst.uid;
        this.dust(inst);
        sfx('place');
        vibrate(8);
      } else {
        toast(this, this.outsideUsable(inst, a.ax, a.ay, d.rot) ? 'Hors du sac : pose une sacoche ici' : 'Pas la place ici', C.dangerStr, 880);
        this.cameras.main.shake(120, 0.004);
        vibrate([10, 30, 10]);
      }
    } else if (inst.placed) {
      if (reserve(this.run).length >= RESERVE_MAX) toast(this, 'Réserve pleine', C.dangerStr, 880);
      else Object.assign(inst, { placed: false, rot: d.rot });
    } else {
      inst.rot = d.rot;
    }
    this.afterDrop();
  }

  /** Vrai si l'empreinte tombe (en partie) hors des cases utilisables mais dans la grille. */
  private outsideUsable(inst: ItemInst, x: number, y: number, rot: Rot) {
    const u = usable(this.run);
    const cells = cellsAt(inst, x, y, rot);
    return cells.every(([cx, cy]) => cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS) && cells.some(([cx, cy]) => !u.has(`${cx},${cy}`));
  }

  private dropBag(d: DragState, p: Phaser.Input.Pointer) {
    const b = d.bag!;
    const a = this.dropAnchor(d, p.x, p.y);
    if (inRect(p.x, p.y, SELL)) {
      const v = sellBag(this.run, b.uid);
      if (v) {
        toast(this, `Sacoche vendue : +${v} cr`, C.accentStr, 880);
        this.coinBurst(p.x, p.y);
        sfx('sell');
        vibrate(10);
      } else toast(this, 'Les autres sacoches seraient détachées', C.dangerStr, 880);
    } else if (a.overGrid) {
      if (placeBag(this.run, b.uid, a.ax, a.ay, d.rot)) {
        this.popBag = b.uid;
        this.cameras.main.shake(90, 0.003);
        sfx('place', { pitch: 0.8 });
        vibrate(12);
      } else {
        toast(this, this.bagFailReason(b, a.ax, a.ay, d.rot), C.dangerStr, 880);
        this.cameras.main.shake(120, 0.004);
        vibrate([10, 30, 10]);
      }
    } else if (b.placed) {
      if (!unplaceBag(this.run, b.uid)) {
        toast(this, reserveBags(this.run).length >= BAG_RESERVE_MAX ? 'Réserve de sacoches pleine' : 'Les autres sacoches seraient détachées', C.dangerStr, 880);
      } else b.rot = d.rot;
    } else b.rot = d.rot;
    this.afterDrop();
  }

  private bagFailReason(b: BagInst, x: number, y: number, rot: Rot): string {
    const cells = cellsAt(b, x, y, rot);
    if (!cells.every(([cx, cy]) => cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS)) return 'Hors de la grille';
    if (cells.some(([cx, cy]) => cx >= BASE_X0 && cx <= BASE_X1 && cy >= BASE_Y0 && cy <= BASE_Y1)) return 'Pose-la à côté du sac, pas dessus';
    if (cells.some(([cx, cy]) => bagAt(this.run.bags.filter((o) => o.uid !== b.uid), cx, cy))) return 'Une sacoche est déjà là';
    return 'La sacoche doit toucher le sac';
  }

  /** Après chaque dépôt : recettes assemblées automatiquement (hors combat), puis rafraîchissement. */
  private afterDrop() {
    this.craftNow();
  }

  private craftNow() {
    if (this.phase === 'combat') return this.refresh();
    // Positions des objets avant l'assemblage, pour l'animation.
    const before = new Map(this.run.items.filter((i) => i.placed).map((i) => [i.uid, { x: i.x, y: i.y }]));
    const firstUid = this.run.nextUid;
    const done = autoCraft(this.run);
    if (!done.length) return this.refresh();
    const outputs = this.run.items.filter((i) => i.uid >= firstUid);
    outputs.forEach((o) => this.hidden.add(o.uid));
    this.linkKeys = null;
    this.refresh();
    this.lockUntil = this.time.now + 900 * done.length + 200;
    done.forEach((c, i) => this.time.delayedCall(i * 900, () => this.animateCraft(c, outputs[i], before)));
  }

  private animateCraft(c: Craftable, out: ItemInst | undefined, before: Map<number, { x: number; y: number }>) {
    const name = ITEMS[c.recipe.output].name;
    // Cible : l'objet posé dans le sac, sinon sa case de réserve.
    let tx: number;
    let ty: number;
    const ov = out && (out.placed ? this.views.get(out.uid) : this.trayViews.get(out.uid));
    if (ov) {
      tx = ov.x + (ov.width * ov.scaleX) / 2;
      ty = ov.y + (ov.height * ov.scaleY) / 2;
    } else {
      tx = W / 2;
      ty = GRID_Y + (ROWS * CELL) / 2;
    }
    const ghosts = c.parts.map((part) => {
      const pos = before.get(part.uid) ?? { x: part.x, y: part.y };
      const v = itemView(this, part, CELL).setPosition(GRID_X + pos.x * CELL, GRID_Y + pos.y * CELL).setDepth(55);
      return v;
    });
    vibrate([10, 30, 10]);
    ghosts.forEach((v) => {
      const cw = v.width / 2;
      const ch = v.height / 2;
      // Petit soulèvement, puis tout se rejoint au centre
      this.tweens.add({ targets: v, y: v.y - 10, duration: 160, ease: 'Quad.Out' });
      this.tweens.add({
        targets: v, x: tx - cw * 0.4, y: ty - ch * 0.4, scale: 0.4, alpha: 0.85, delay: 170, duration: 340, ease: 'Back.In',
        onComplete: () => v.destroy(),
      });
    });
    this.time.delayedCall(520, () => {
      // Éclair et onde de choc
      const g = this.add.graphics().setDepth(56).setPosition(tx, ty);
      g.fillStyle(0xf8d9ab, 0.95);
      g.fillCircle(0, 0, 46);
      g.lineStyle(6, 0xe9c46a, 1);
      g.strokeCircle(0, 0, 60);
      g.setScale(0.3);
      this.tweens.add({ targets: g, scale: 1.9, alpha: 0, duration: 420, ease: 'Quad.Out', onComplete: () => g.destroy() });
      for (let k = 0; k < 10; k++) {
        const s = this.add.rectangle(tx, ty, 6, 6, 0xe9c46a).setDepth(56);
        const ang = (k / 10) * Math.PI * 2;
        this.tweens.add({ targets: s, x: tx + Math.cos(ang) * 90, y: ty + Math.sin(ang) * 90, alpha: 0, angle: 180, duration: 480, ease: 'Quad.Out', onComplete: () => s.destroy() });
      }
      this.cameras.main.shake(180, 0.006);
      this.cameras.main.flash(140, 255, 230, 160);
      this.freezeFor(70);
      sfx('craft');
      vibrate([20, 40, 30]);
      if (out) {
        this.hidden.delete(out.uid);
        const v = out.placed ? this.views.get(out.uid) : this.trayViews.get(out.uid);
        if (v) {
          v.setVisible(true);
          pop(this, v, 1.5, 420);
        }
        this.refresh();
      }
      banner(this, 'RECETTE !', GOLD, GRID_Y + (ROWS * CELL) / 2 - 60);
      toast(this, `Recette : ${name}${out && !out.placed ? ' → réserve' : ''}`, GOLD, GRID_Y + (ROWS * CELL) / 2 + 20);
    });
  }

  /** Arrêt sur image court en dehors du combat (la boucle du combat a son propre arrêt). */
  private freezeFor(ms: number) {
    if (this.play) {
      this.freeze = Math.max(this.freeze, ms / 1000);
      return;
    }
    this.tweens.timeScale = 0.05;
    this.time.delayedCall(ms, () => (this.tweens.timeScale = 1));
  }

  private dust(inst: ItemInst) {
    for (const [cx, cy] of cellsAt(inst, inst.x, inst.y)) {
      const x = GRID_X + (cx + 0.5) * CELL;
      const y = GRID_Y + (cy + 1) * CELL - 8;
      for (const dir of [-1, 1]) {
        const s = this.add.circle(x + dir * 10, y, 4, 0xc8c5a5, 0.6).setDepth(44);
        this.tweens.add({ targets: s, x: x + dir * 34, y: y - 6, alpha: 0, scale: 0.3, duration: 280, ease: 'Quad.Out', onComplete: () => s.destroy() });
      }
    }
  }

  private coinBurst(x: number, y: number) {
    for (let i = 0; i < 7; i++) {
      const c = txt(this, x, y, '◆', 20, C.accentStr, { fontStyle: 'bold' }).setOrigin(0.5).setDepth(60);
      this.tweens.add({
        targets: c, x: 30 + i * 6, y: STATUS.h / 2, alpha: 0.4, scale: 0.6, delay: i * 40, duration: 520, ease: 'Cubic.In',
        onComplete: () => c.destroy(),
      });
    }
  }

  private rotateItemInPlace(inst: ItemInst, from: 'grid' | 'tray') {
    // Même une forme symétrique (1×1, 2×2…) tourne : ses étoiles et son sprite tournent avec elle.
    const nr = nextRot(inst.rot);
    if (from === 'tray') {
      inst.rot = nr;
      this.refresh();
      return;
    }
    const nd = dims(inst, nr);
    const u = usable(this.run);
    for (let dy = 0; dy < nd.h; dy++) {
      for (let dx = 0; dx < nd.w; dx++) {
        if (canPlace(this.run.items, inst, inst.x - dx, inst.y - dy, nr, u)) {
          Object.assign(inst, { x: inst.x - dx, y: inst.y - dy, rot: nr });
          this.popUid = inst.uid;
          sfx('rotate');
          vibrate(8);
          this.afterDrop();
          return;
        }
      }
    }
    toast(this, 'Pas la place de tourner', C.dangerStr, 880);
  }

  private rotateBagInPlace(b: BagInst, from: 'grid' | 'tray') {
    if (rotationIsNoop(b.defId, b.rot)) return;
    const nr = nextRot(b.rot);
    if (from === 'tray') {
      b.rot = nr;
      this.refresh();
      return;
    }
    if (!canMoveBag(this.run.items, b)) return this.bagLocked(b);
    const nd = dims(b, nr);
    for (let dy = 0; dy < nd.h; dy++) {
      for (let dx = 0; dx < nd.w; dx++) {
        if (placeBag(this.run, b.uid, b.x - dx, b.y - dy, nr)) {
          this.popBag = b.uid;
          sfx('rotate');
          vibrate(8);
          this.refresh();
          return;
        }
      }
    }
    toast(this, 'Pas la place de tourner', C.dangerStr, 880);
  }

  // ---------------------------------------------------------------- modales

  private closeModal() {
    this.modal?.destroy();
    this.modal = null;
    this.updateButtons();
  }

  private infoModal(title: string, subtitle: string, subColor: string, lines: string[], stroke: number) {
    let armed = !this.input.activePointer.isDown;
    const m = modalBase(this, () => {
      if (!armed) {
        armed = true;
        return;
      }
      this.closeModal();
    });
    const lineViews = lines.map((l) => txt(this, 76, 0, l, 21, C.text, { wordWrap: { width: W - 150 } }));
    const h = 150 + lineViews.reduce((s, t) => s + t.height + 12, 0);
    const y = 640 - h / 2;
    m.add(panel(this, 40, y, W - 80, h, stroke));
    m.add(txt(this, 76, y + 30, title, 32, C.text, { fontStyle: 'bold' }));
    m.add(txt(this, 76, y + 74, subtitle, 22, subColor));
    let ly = y + 124;
    for (const t of lineViews) {
      t.setY(ly);
      ly += t.height + 12;
      m.add(t);
    }
    m.add(txt(this, W / 2, y + h + 30, 'Touche pour fermer', 20, C.quiet).setOrigin(0.5));
    this.modal = m;
    this.updateButtons();
  }

  private showInfo(inst: ItemInst) {
    const info = describe(inst);
    this.infoModal(info.title, info.subtitle, TIER_HEX[tierOf(inst.defId)], info.lines, TIER_COLORS[tierOf(inst.defId)]);
  }

  private showBagInfo(b: BagInst) {
    const def = BAGS[b.defId as BagId];
    const n = cellCount(b.defId);
    this.infoModal(def.name, `Sacoche · ${n} cases`, '#f8d9ab', [
      `Agrandit le sac de ${n} cases.`,
      'Pose-la contre le sac ou contre une autre sacoche.',
      'Elle ne se déplace que vide.',
      `Revente ${bagSellValue(b.defId)} cr`,
    ], C.leatherLine);
  }

  /** Carte d'offre (boutique) : objet ou sacoche. */
  private offerCard(m: Container, x0: number, y0: number, w: number, h: number, o: { item?: ItemInst; bag?: BagId; price: number; sold: boolean; locked?: boolean }, onTap: () => void, delay: number, onLock?: () => void) {
    const cc = this.add.container(x0, y0);
    m.add(cc);
    if (delay >= 0) {
      cc.setAlpha(0).setY(y0 + 70);
      this.tweens.add({ targets: cc, y: y0, alpha: 1, delay, duration: 320, ease: 'Back.Out' });
    }
    const afford = this.run.credits >= o.price;
    const stroke = o.item ? TIER_COLORS[tierOf(o.item.defId)] : C.leatherLine;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35);
    g.fillPoints(chamferPoints(2, 4, w, h, 14), true);
    g.fillStyle(C.panel, 1);
    g.fillPoints(chamferPoints(0, 0, w, h, 14), true);
    g.fillStyle(stroke, 0.1);
    g.fillPoints(chamferPoints(0, 0, w, 112, 14), true);
    g.lineStyle(o.locked ? 5 : 3, o.locked ? 0x5fb3e0 : stroke, o.sold ? 0.3 : 1);
    g.strokePoints(chamferPoints(0, 0, w, h, 14), false, true);
    cc.add(g);
    const area = 104;
    const inst = o.item ?? { defId: o.bag!, rot: 0 as Rot };
    const d = dims(inst);
    const s = Math.min((w - 30) / (d.w * CELL), area / (d.h * CELL), 0.9);
    const v = o.item ? itemView(this, o.item, CELL) : bagView(this, { defId: o.bag!, rot: 0 }, CELL);
    v.setScale(s).setPosition((w - d.w * CELL * s) / 2, 14 + (area - d.h * CELL * s) / 2);
    cc.add(v);
    if (o.item) {
      const info = describe(o.item);
      cc.add(txt(this, w / 2, 118, info.title, 20, C.text, { fontStyle: 'bold', align: 'center' }).setOrigin(0.5, 0));
      cc.add(txt(this, w / 2, 144, TIER_NAMES[tierOf(o.item.defId)], 16, TIER_HEX[tierOf(o.item.defId)]).setOrigin(0.5, 0));
      const desc = txt(this, w / 2, 166, info.lines[0], 14, C.quiet).setOrigin(0.5, 0);
      if (desc.width > w - 20) desc.setScale((w - 20) / desc.width);
      cc.add(desc);
    } else {
      const def = BAGS[o.bag!];
      cc.add(txt(this, w / 2, 118, def.name, 20, '#f8d9ab', { fontStyle: 'bold' }).setOrigin(0.5, 0));
      cc.add(txt(this, w / 2, 144, `Sacoche · +${cellCount(o.bag!)} cases`, 16, C.text).setOrigin(0.5, 0));
      cc.add(txt(this, w / 2, 166, 'Agrandit ton sac', 14, C.quiet).setOrigin(0.5, 0));
    }
    const pill = this.add.graphics();
    const col = o.sold ? 0x3e3746 : afford ? C.accent : 0x6e2f27;
    pill.fillStyle(col, 1);
    pill.fillRoundedRect(w / 2 - 56, h - 42, 112, 32, 16);
    cc.add(pill);
    cc.add(txt(this, w / 2, h - 26, o.sold ? 'VENDU' : `◆ ${o.price} cr`, 18, o.sold ? C.quiet : afford ? '#17141c' : C.dangerStr, { fontStyle: 'bold' }).setOrigin(0.5));
    if (o.sold) v.setAlpha(0.3);
    if (o.item && !o.sold) this.affinityBadges(cc, 10, 10, w - 10, o.item.defId);
    const z = this.add.zone(w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
    z.on('pointerdown', () => cc.setScale(0.96).setPosition(x0 + w * 0.02, y0 + h * 0.02));
    z.on('pointerout', () => cc.setScale(1).setPosition(x0, y0));
    z.on('pointerup', () => {
      cc.setScale(1).setPosition(x0, y0);
      onTap();
    });
    cc.add(z);
    // Verrou : en bas à droite, au-dessus de la carte (il prend le toucher en premier).
    if (onLock && !o.sold) {
      const lx = w - 34;
      const ly = h - 26;
      const lg = this.add.graphics();
      lg.fillStyle(o.locked ? 0x5fb3e0 : 0x000000, o.locked ? 1 : 0.45);
      lg.fillRoundedRect(lx - 24, ly - 22, 48, 44, 10);
      drawPadlock(lg, lx, ly, o.locked ? 0xffffff : 0xa39a8c, !!o.locked);
      cc.add(lg);
      const lz = this.add.zone(lx, ly, 56, 52).setInteractive({ useHandCursor: true });
      lz.on('pointerup', () => onLock());
      cc.add(lz);
    }
  }

  private openShop() {
    if (this.modal) return;
    const offers = shopOffers(this.run);
    const m = modalBase(this);
    m.add(txt(this, W / 2, 130, this.run.resupply ? 'RAVITAILLEMENT' : 'BOUTIQUE', 44, C.text, { fontFamily: TITLE_FONT, stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5));
    m.add(txt(this, W / 2, 180, `◆ ${this.run.credits} cr`, 28, C.accentStr, { fontStyle: 'bold' }).setOrigin(0.5));
    const cw = 320;
    const ch = 236;
    offers.forEach((o, i) => {
      const x = 30 + (i % 2) * (cw + 20);
      const y = 220 + Math.floor(i / 2) * (ch + 16);
      this.offerCard(m, x, y, cw, ch, o, () => {
        if (o.sold) return;
        if (this.run.credits < o.price) return this.shopError('Pas assez de crédits');
        if (o.item && reserve(this.run).length >= RESERVE_MAX) return this.shopError('Réserve pleine : vends ou pose un objet');
        if (o.bag && reserveBags(this.run).length >= BAG_RESERVE_MAX) return this.shopError('Réserve de sacoches pleine');
        const got = buyOffer(this.run, i);
        if (!got) return this.shopError('Achat impossible');
        sfx('coin');
        vibrate([10, 30, 10]);
        this.coinBurst(x + cw / 2, y + ch - 30);
        this.reopenShop(true);
        toast(this, `Acheté : ${o.item ? ITEMS[o.item.defId].name : BAGS[o.bag!].name} → réserve`, C.goodStr, 1000);
      }, this.shopAnimated ? -1 : i * 70, () => {
        if (!toggleLock(this.run, i)) return;
        sfx(o.locked ? 'pickup' : 'rotate');
        vibrate(8);
        this.reopenShop(true);
        if (o.locked) toast(this, 'Verrouillée : elle reste après une relance et passe à la boutique suivante', '#5fb3e0', 1000);
      });
    });
    const by = 220 + 3 * (ch + 16) + 8;
    m.add(button(this, 30, by, 320, 88, `Relancer · ${rerollCost(this.run)} cr`, () => {
      if (!rerollShop(this.run)) return this.shopError('Pas assez de crédits');
      vibrate(12);
      this.reopenShop(false);
    }, { size: 24 }).root);
    m.add(button(this, 370, by, 320, 88, 'Ranger le sac', () => {
      this.closeModal();
      this.refresh();
    }, { size: 24, primary: true }).root);
    m.add(txt(this, W / 2, by + 112, this.run.resupply ? 'Les achats vont en réserve. « Terminer » ramène à la carte.' : 'Les achats vont en réserve. « Terminer » clôt l\'action.', 17, C.quiet).setOrigin(0.5));
    m.add(txt(this, W / 2, by + 138, 'Cadenas : garde une offre pour plus tard (relance et boutique suivante).', 17, '#5fb3e0').setOrigin(0.5));
    this.modal = m;
    this.updateButtons();
    saveRun(this.run);
  }

  private shopError(s: string) {
    toast(this, s, C.dangerStr, 1000);
    sfx('hit_armor', { vol: 0.5, pitch: 0.6 });
    this.cameras.main.shake(100, 0.003);
    vibrate([10, 30, 10]);
  }

  private reopenShop(still: boolean) {
    this.closeModal();
    this.refresh();
    this.shopAnimated = still;
    this.openShop();
    this.shopAnimated = false;
  }

  /**
   * Caisse de ravitaillement : la caisse tremble, s'ouvre, le butin jaillit puis file en réserve.
   * Caisse épique : caisse violette cerclée d'or, lueur qui monte, tremblements plus longs, double gerbe de rayons
   * et pluie d'étoiles ; l'objet assemblé sort en premier.
   */
  private openCrate(loot: Loot) {
    if (this.modal) return;
    const epic = this.epic;
    const m = modalBase(this);
    this.modal = m;
    this.updateButtons();
    const cx = W / 2;
    const cy = 760;
    const head = txt(this, W / 2, 200, CRATE_TITLE[this.crate], epic ? 46 : 36, epic ? EPIC_HEX : this.crate === 'caisse_renforcee' ? '#5fb3e0' : C.text, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
    m.add(head);
    if (epic) {
      head.setShadow(0, 0, '#e9c46a', 14, true, true);
      head.setScale(0.4).setAlpha(0);
      this.tweens.add({ targets: head, scale: 1, alpha: 1, duration: 420, ease: 'Back.Out' });
      m.add(txt(this, W / 2, 252, 'Un objet assemblé parmi les choix', 24, GOLD, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5));
    }
    // Lueur au sol qui monte pendant les tremblements (épique).
    const aura = this.add.graphics().setPosition(cx, cy).setAlpha(0);
    if (epic) {
      for (let k = 6; k >= 1; k--) {
        aura.fillStyle(k % 2 ? EPIC_COLOR : TIER_COLORS[1], 0.09);
        aura.fillCircle(0, 0, 90 + k * 34);
      }
      m.add(aura);
    }
    const rays = this.add.graphics().setPosition(cx, cy - 40).setAlpha(0);
    const nRays = epic ? 18 : 12;
    rays.fillStyle(epic ? EPIC_COLOR : 0xe9c46a, epic ? 0.26 : 0.18);
    for (let i = 0; i < nRays; i++) {
      const a = (i / nRays) * Math.PI * 2;
      rays.fillTriangle(0, 0, Math.cos(a - 0.1) * 460, Math.sin(a - 0.1) * 460, Math.cos(a + 0.1) * 460, Math.sin(a + 0.1) * 460);
    }
    m.add(rays);
    // 2e gerbe de rayons, or, qui tourne en sens inverse (épique).
    const rays2 = this.add.graphics().setPosition(cx, cy - 40).setAlpha(0);
    if (epic) {
      rays2.fillStyle(0xe9c46a, 0.2);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.2;
        rays2.fillTriangle(0, 0, Math.cos(a - 0.05) * 520, Math.sin(a - 0.05) * 520, Math.cos(a + 0.05) * 520, Math.sin(a + 0.05) * 520);
      }
      m.add(rays2);
    }
    // Caisse : corps et couvercle
    const crate = this.add.container(cx, cy);
    const body = this.add.graphics();
    const cBody = epic ? 0x3a2a4e : 0x3f5a35;
    const cDark = epic ? 0x3a2a4e : 0x34362a;
    const cBand = epic ? 0x3a2a4e : 0x4a4d3a;
    body.fillStyle(0x000000, 0.4);
    body.fillRoundedRect(-130, -64, 260, 150, 10);
    body.fillStyle(cBody, 1);
    body.fillRoundedRect(-130, -70, 260, 150, 10);
    body.lineStyle(4, epic ? 0xe9c46a : cDark, 1);
    body.strokeRoundedRect(-130, -70, 260, 150, 10);
    body.fillStyle(epic ? 0xe9c46a : cBand, 1);
    body.fillRect(-130, -20, 260, epic ? 8 : 14);
    body.fillRect(-130, 40, 260, epic ? 8 : 14);
    if (epic) {
      // Coins renforcés dorés
      for (const [qx, qy] of [[-130, -70], [106, -70], [-130, 56], [106, 56]]) body.fillRect(qx, qy, 24, 24);
    }
    body.fillStyle(0xe9c46a, 1);
    body.fillRect(-40, -2, 80, 30);
    crate.add(body);
    crate.add(txt(this, 0, 13, epic ? '★ ÉPIQUE ★' : 'SUPPLY', epic ? 15 : 18, '#17141c', { fontStyle: 'bold' }).setOrigin(0.5));
    const lid = this.add.container(0, -70);
    const lg = this.add.graphics();
    lg.fillStyle(epic ? 0x8f6bb8 : 0x3f5a35, 1);
    lg.fillRoundedRect(-140, -30, 280, 34, 8);
    lg.lineStyle(4, epic ? 0xe9c46a : cDark, 1);
    lg.strokeRoundedRect(-140, -30, 280, 34, 8);
    lg.fillStyle(epic ? 0xe9c46a : 0x969678, 1);
    lg.fillRect(-14, -26, 28, 10);
    lid.add(lg);
    crate.add(lid);
    m.add(crate);
    crate.setScale(0.2).setAlpha(0);
    this.tweens.add({ targets: crate, scale: 1, alpha: 1, duration: 320, ease: 'Back.Out' });
    // Tremblements croissants (plus longs pour l'épique, avec la lueur qui monte)
    const shakes = epic ? 11 : 5;
    this.tweens.add({ targets: crate, angle: { from: -4, to: 4 }, duration: 70, yoyo: true, repeat: shakes, delay: 380, onComplete: () => crate.setAngle(0) });
    if (epic) {
      this.tweens.add({ targets: aura, alpha: 1, scale: { from: 0.5, to: 1.1 }, delay: 380, duration: 70 * 2 * (shakes + 1) });
      this.time.delayedCall(380 + 70 * (shakes + 1), () => this.cameras.main.shake(70 * (shakes + 1), 0.003));
    }
    const t0 = 380 + 70 * 2 * (shakes + 1) + 40;
    this.time.delayedCall(t0, () => {
      // Le couvercle saute
      this.tweens.add({ targets: lid, y: -300, angle: -35, alpha: 0, duration: 520, ease: 'Quad.Out' });
      this.tweens.add({ targets: rays, alpha: 1, duration: 260 });
      this.tweens.add({ targets: rays, angle: 360, duration: 12000, repeat: -1 });
      if (epic) {
        this.tweens.add({ targets: rays2, alpha: 1, duration: 260 });
        this.tweens.add({ targets: rays2, angle: -360, duration: 9000, repeat: -1 });
        this.tweens.add({ targets: aura, scale: 1.25, alpha: 0.75, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        // Pluie d'étoiles violettes et dorées
        for (let k = 0; k < 26; k++) {
          const a = Math.random() * Math.PI * 2;
          const d = 180 + Math.random() * 300;
          const star = txt(this, cx, cy - 60, '★', 18 + Math.floor(Math.random() * 22), k % 2 ? GOLD : EPIC_HEX).setOrigin(0.5);
          m.add(star);
          this.tweens.add({
            targets: star, x: cx + Math.cos(a) * d, y: cy - 60 + Math.sin(a) * d * 0.8 + 120, angle: 360 * (Math.random() < 0.5 ? -1 : 1),
            alpha: 0, scale: 0.3, duration: 900 + Math.random() * 700, ease: 'Cubic.Out', onComplete: () => star.destroy(),
          });
        }
      }
      this.cameras.main.shake(epic ? 380 : 220, epic ? 0.014 : 0.008);
      if (epic) this.cameras.main.flash(260, 200, 150, 255);
      else this.cameras.main.flash(160, 255, 236, 180);
      sfx('frag', { vol: epic ? 0.7 : 0.45, pitch: 1.4 });
      if (epic) sfx('craft');
      vibrate(epic ? [40, 40, 40, 40, 80] : [30, 40, 30]);
      const entries: { v: Container; label: string; col: string; w: number; h: number }[] = [];
      // Les objets proposés jaillissent (on les choisira ensuite) ; l'objet assemblé en premier.
      const offers = this.run.pendingLoot?.items ?? [];
      const items = [...offers].sort((a, b) => tierOf(b.defId) - tierOf(a.defId)).slice(0, 3);
      // Tout doit tenir dans la largeur : l'espacement et la taille suivent le nombre d'éléments.
      const nAll = items.length + loot.bags.length;
      const gap = Math.min(260, (W - 40) / Math.max(1, nAll));
      const maxPx = Math.min(150, gap - 24);
      for (const it of items) {
        const d = dims(it);
        const s = Math.min(1, maxPx / (Math.max(d.w, d.h) * CELL));
        entries.push({ v: itemView(this, it, CELL).setScale(s), label: `${ITEMS[it.defId].name}\n${TIER_NAMES[tierOf(it.defId)]}`, col: TIER_HEX[tierOf(it.defId)], w: d.w * CELL * s, h: d.h * CELL * s });
      }
      for (const b of loot.bags) {
        const d = dims(b);
        const s = Math.min(1, maxPx / (Math.max(d.w, d.h) * CELL));
        entries.push({ v: bagView(this, b, CELL).setScale(s), label: `${BAGS[b.defId as BagId].name}\n+${cellCount(b.defId)} cases`, col: '#f8d9ab', w: d.w * CELL * s, h: d.h * CELL * s });
      }
      const n = entries.length;
      const sources: { x: number; y: number }[] = [];
      entries.forEach((e, i) => {
        const fx = W / 2 + (i - (n - 1) / 2) * gap;
        const fy = 380;
        sources.push({ x: fx, y: fy });
        e.v.setPosition(cx - e.w / 2, cy - 60 - e.h / 2).setAlpha(0);
        m.add(e.v);
        this.tweens.add({ targets: e.v, x: fx - e.w / 2, y: fy - e.h / 2, alpha: 1, delay: 120 + i * 160, duration: 520, ease: 'Back.Out' });
        const t = txt(this, fx, fy + 92, e.label, n >= 4 ? 18 : 22, e.col, { fontStyle: 'bold', align: 'center', stroke: '#000000', strokeThickness: 4, wordWrap: { width: gap - 10 } }).setOrigin(0.5, 0).setAlpha(0);
        m.add(t);
        this.tweens.add({ targets: t, alpha: 1, delay: 400 + i * 160, duration: 250 });
      });
      if (loot.credits) {
        const ct = txt(this, W / 2, 940, `Cash ramassé : +${loot.credits} cr`, 26, C.accentStr, { fontStyle: 'bold' }).setOrigin(0.5);
        m.add(ct);
      }
      if (!n) m.add(txt(this, W / 2, 400, 'Vide… pas de chance.', 26, C.quiet).setOrigin(0.5));
      const pl = this.run.pendingLoot;
      const hint = txt(this, W / 2, 1040, pl?.maxPicks ? `Touche pour choisir : ${pl.maxPicks} objet${pl.maxPicks > 1 ? 's' : ''} sur ${pl.items.length}` : 'Touche pour ranger', 24, C.text, { fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0);
      m.add(hint);
      this.tweens.add({ targets: hint, alpha: 1, delay: 700, duration: 300 });
      this.tweens.add({ targets: hint, scale: 1.08, yoyo: true, repeat: -1, delay: 1000, duration: 500 });
      const catcher = this.add.rectangle(0, 0, W, H, 0x000000, 0.001).setOrigin(0).setInteractive();
      m.add(catcher);
      let done = false;
      const armedAt = this.time.now + 600;
      catcher.on('pointerup', () => {
        if (done || this.time.now < armedAt) return;
        done = true;
        this.closeModal();
        const bagFrom = sources.slice(items.length);
        if (loot.bags.length) this.flyToReserve([], bagFrom.length ? bagFrom : sources, 0, loot.bags);
        if (this.run.pendingLoot) this.time.delayedCall(loot.bags.length ? 500 : 0, () => this.openLootChoice());
      });
    });
  }

  // ---------------------------------------------------------------- butin en vol

  /** Butin qui jaillit d'un point (sac adverse, caisse) puis vole vers sa case de réserve. */
  private flyToReserve(items: ItemInst[], from: { x: number; y: number }[], delay = 0, bags: BagInst[] = []) {
    items.forEach((it) => this.hidden.add(it.uid));
    bags.forEach((b) => this.hiddenBags.add(b.uid));
    this.refresh();
    const all: { it?: ItemInst; b?: BagInst }[] = [...items.map((it) => ({ it })), ...bags.map((b) => ({ b }))];
    all.forEach((e, i) => {
      const inst = (e.it ?? e.b)!;
      const v = e.it ? this.trayViews.get(e.it.uid) : this.trayBagViews.get(e.b!.uid);
      const src = from[i % Math.max(1, from.length)] ?? { x: W / 2, y: 400 };
      const d = dims(inst);
      const s0 = Math.min(0.7, 120 / (Math.max(d.w, d.h) * CELL));
      const f = (e.it ? itemView(this, e.it, CELL) : bagView(this, e.b!, CELL)).setScale(s0).setDepth(60).setAlpha(0);
      f.setPosition(src.x - (d.w * CELL * s0) / 2, src.y - (d.h * CELL * s0) / 2);
      const t0 = delay + i * 260;
      this.tweens.add({ targets: f, alpha: 1, y: f.y - 40, delay: t0, duration: 240, ease: 'Back.Out' });
      const fallback = e.it ? { x: RESERVE.x + RESERVE.w / 2, y: RESERVE.y + 40 } : { x: BAG_RESERVE.x + BAG_RESERVE.w / 2, y: BAG_RESERVE.y + 40 };
      this.tweens.add({
        targets: f,
        x: v ? v.x : fallback.x,
        y: v ? v.y : fallback.y,
        scale: v ? v.scaleX : 0.3,
        delay: t0 + 340,
        duration: 460,
        ease: 'Cubic.InOut',
        onComplete: () => {
          f.destroy();
          if (e.it) this.hidden.delete(e.it.uid);
          else this.hiddenBags.delete(e.b!.uid);
          if (v) {
            v.setVisible(true);
            pop(this, v, 1.5, 340);
          }
          vibrate(10);
        },
      });
    });
  }

  // ---------------------------------------------------------------- flux

  private onMain() {
    if (this.modal) return;
    if (this.phase === 'prep') return this.startFight();
    // Butin pas encore choisi : on rouvre la fouille.
    if (this.run.pendingLoot && !this.run.over) return this.openLootChoice(this.bot?.name);
    if (this.phase === 'result' || this.phase === 'over') {
      const go = this.post?.go;
      if (go) go();
      else this.route();
      return;
    }
    if (this.phase !== 'edit') return;
    if (this.mode === 'manage') return this.route();
    if (this.run.resupply) {
      // Fin du ravitaillement : la carte, avec le gaz qui se resserre (ou le Top 1).
      closeResupply(this.run);
      return this.route();
    }
    // Boutique ou caisse : fin de l'action
    const e = endAction(this.run);
    saveRun(this.run);
    this.route(); // fin de cercle : la carte ouvre le ravitaillement
  }

  private onAlt() {
    if (this.modal) return;
    if (this.phase === 'prep') return this.openEnemy();
    if ((this.phase === 'result' || this.phase === 'over') && this.report) return this.openReport();
    if (this.phase === 'edit' && this.mode === 'shop') this.openShop();
  }

  /** Après une action : fin de run, retour à la zone, ou carte. */
  private route() {
    saveRun(this.run);
    const r = this.run;
    const target = r.over ? 'end' : r.zoneId !== null && r.actionsLeft > 0 ? 'zone' : 'map';
    this.input.enabled = false;
    this.cameras.main.fadeOut(200, ...FADE_RGB);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(target));
  }

  /** Vitesse des combats : réglage du joueur, gardé d'une partie à l'autre. */
  private get speed(): number {
    return getSettings().speed;
  }

  private cycleSpeed() {
    setSettings({ speed: nextSpeed(this.speed) });
    this.updateButtons();
  }

  // ---------------------------------------------------------------- duel : mise en place

  /** Entrée en mode duel : duel en cours, Goulag en attente, ou Top 1 (y compris après un rechargement). */
  private enterDuel() {
    const r = this.run;
    if (r.over) {
      this.phase = 'over';
      this.post = { label: 'Voir le bilan', go: () => this.route() };
      this.refresh();
      return;
    }
    if (r.pendingGoulag) {
      this.refresh();
      this.showGoulag();
      return;
    }
    if (r.pendingLoot) {
      // Rechargement pendant la fouille d'un sac : on y revient.
      this.phase = 'result';
      this.refresh();
      this.time.delayedCall(150, () => this.openLootChoice());
      return;
    }
    if (!r.fight && r.round >= FINAL_ROUND) {
      this.refresh();
      this.announceFinal();
      return;
    }
    const p = currentDuel(r);
    if (p?.type === 'final') {
      // La carte a déjà lancé le Top 1 (finalDuelParams) : on garde l'annonce.
      this.refresh();
      this.announceFinal();
      return;
    }
    if (!p) {
      // Rien à combattre : simple rangement.
      this.mode = 'manage';
      this.refresh();
      return;
    }
    this.setupDuel(p);
  }

  private setupDuel(p: DuelParams) {
    this.params = p;
    this.bot = generateBot(p.seed, p.round, { danger: p.danger, final: p.type === 'final', goulag: p.type === 'goulag', elite: p.type === 'elite', theme: p.theme });
    this.botL = botLoadout(this.bot);
    this.phase = 'prep';
    this.post = null;
    this.play = null;
    this.report = null;
    this.clearDuelFx();
    this.stripLayer.removeAll(true);
    this.buildArena();
    this.buildEnemyPanel();
    this.refresh();
    saveRun(this.run);
    warmSfx(DUEL_SFX);
    // Annonce du duel
    const title = p.type === 'goulag' ? 'GOULAG' : p.type === 'final' ? 'TOP 1' : p.type === 'elite' ? 'ÉLITE' : 'DUEL SOLO';
    const col = p.type === 'goulag' ? C.dangerStr : p.type === 'final' ? GOLD : C.text;
    this.slam(title, col, GRID_Y + 140);
    this.time.delayedCall(1300, () => toast(this, 'Range ton sac, puis « Combat ! »', C.text, GRID_Y + 300));
  }

  /** Gros titre qui s'écrase avec secousse. */
  private slam(s: string, color: string, y: number, size = 64) {
    const t = txt(this, W / 2, y, s, size, color, { fontFamily: TITLE_FONT, stroke: '#000000', strokeThickness: 10, padding: { x: 16, y: 6 } })
      .setOrigin(0.5).setDepth(210).setScale(3).setAlpha(0);
    this.tweens.add({
      targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Quad.In',
      onComplete: () => {
        this.cameras.main.shake(160, 0.008);
        sfx('place', { pitch: 0.6, vary: 0 });
        vibrate(25);
      },
    });
    this.tweens.add({ targets: t, alpha: 0, y: y - 30, delay: 1000, duration: 320, onComplete: () => t.destroy() });
  }

  private arenaTheme() {
    const t = this.params?.type;
    if (t === 'goulag') return { sky: [0x6a2226, 0x6a2226], ground: 0x221e28, tint: 0xef7b72, bg: 'bg-base' };
    if (t === 'final') return { sky: [0x3a2a4e, 0x6e2f27], ground: 0x2b2632, tint: 0xf8d9ab, bg: 'bg-base' };
    return { sky: [0x2b2632, 0x5a5162], ground: 0x342e3c, tint: 0xffffff, bg: 'bg-industrie' };
  }

  private buildArena() {
    const L = this.arenaLayer;
    L.removeAll(true);
    const A = ARENA;
    const th = this.arenaTheme();
    // Fond : décor recadré, sinon ciel en dégradé
    if (this.textures.exists(th.bg)) {
      const img = this.add.image(0, 0, th.bg).setOrigin(0);
      const k = A.h / img.height;
      const cropW = A.w / k;
      const sx = Math.max(0, (img.width - cropW) / 2);
      img.setScale(k).setCrop(sx, 0, cropW, img.height).setPosition(A.x - sx * k, A.y).setTint(th.tint);
      L.add(img);
    } else {
      const g = this.add.graphics();
      for (let i = 0; i < 20; i++) {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(th.sky[0]), Phaser.Display.Color.ValueToColor(th.sky[1]), 19, i);
        g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
        g.fillRect(A.x, A.y + (i * A.h) / 20, A.w, A.h / 20 + 1);
      }
      g.fillStyle(th.ground, 1);
      g.fillRect(A.x, A.y + A.h - 60, A.w, 60);
      L.add(g);
    }
    if (this.params?.type === 'goulag') {
      // Voile rouge et barbelés
      const v = this.add.graphics();
      v.fillStyle(0x6a2226, 0.35);
      v.fillRect(A.x, A.y, A.w, A.h);
      v.lineStyle(2, 0x1c1822, 0.9);
      for (let x = A.x; x < A.x + A.w; x += 18) {
        v.lineBetween(x, A.y + 52, x + 9, A.y + 58);
        v.lineBetween(x + 9, A.y + 58, x + 18, A.y + 52);
      }
      L.add(v);
    }
    // Bandeau sombre en bas pour les stats
    const shade = this.add.graphics();
    shade.fillStyle(0x000000, 0.55);
    shade.fillRect(A.x, A.y + A.h - 40, A.w, 40);
    shade.fillStyle(0x000000, 0.45);
    shade.fillRect(A.x, A.y, A.w, 36);
    L.add(shade);
    const p = this.params!;
    const head = p.type === 'goulag' ? 'GOULAG · DERNIÈRE CHANCE' : p.type === 'final' ? 'DERNIER CERCLE · TOP 1'
      : p.type === 'elite' ? 'ÉLITE · BOT FORT' : 'DUEL SOLO';
    L.add(txt(this, A.x + 18, A.y + 18, head, 16, p.type === 'goulag' ? C.dangerStr : p.type === 'final' ? GOLD : C.text, { fontFamily: TITLE_FONT, letterSpacing: 1 }).setOrigin(0, 0.5));
    const feet = A.y + A.h - 50;
    const { loadout } = this.loadout();
    const meFig = opFig(this.run.operator);
    const enemyFig = foeFig(p.type === 'final', this.bot!.quality === 'fort', p.seed);
    this.me = this.makeActor('a', A.x + 92, feet, p.hp, p.maxHp, loadout.armor, OPERATORS[this.run.operator].name, meFig, FIG_PX);
    this.foe = this.makeActor('b', A.x + A.w - 92, feet, this.botL!.maxHp, this.botL!.maxHp, this.botL!.armor, this.bot!.name, enemyFig, FIG_PX);
    // VS au centre
    const vs = this.add.container(A.x + A.w / 2, A.y + 150);
    const slash = this.add.graphics();
    slash.fillStyle(P.braise, 0.9);
    slash.fillPoints([new Phaser.Math.Vector2(-30, 34), new Phaser.Math.Vector2(-14, 34), new Phaser.Math.Vector2(30, -34), new Phaser.Math.Vector2(14, -34)], true);
    slash.fillStyle(P.orangeClair, 0.9);
    slash.fillPoints([new Phaser.Math.Vector2(-10, 34), new Phaser.Math.Vector2(-2, 34), new Phaser.Math.Vector2(42, -34), new Phaser.Math.Vector2(34, -34)], true);
    vs.add([slash, txt(this, 0, 0, 'VS', 40, C.accentStr, { fontFamily: TITLE_FONT, stroke: '#000000', strokeThickness: 8 }).setOrigin(0.5)]);
    vs.setName('vs');
    L.add(vs);
    this.tweens.add({ targets: vs, scale: { from: 2.4, to: 1 }, alpha: { from: 0, to: 1 }, duration: 300, ease: 'Back.Out' });
    // Entrée des personnages
    this.me.fig.x -= 140;
    this.foe.fig.x += 140;
    this.tweens.add({ targets: this.me.fig, x: this.me.x, duration: 380, ease: 'Cubic.Out' });
    this.tweens.add({ targets: this.foe.fig, x: this.foe.x, duration: 380, ease: 'Cubic.Out' });
    this.myStats = txt(this, A.x + 14, A.y + A.h - 20, '', 16, C.text, { fontStyle: 'bold' }).setOrigin(0, 0.5);
    L.add(this.myStats);
    // Le bandeau des stats passe devant les personnages (un corps à terre ne le cache pas).
    L.bringToTop(shade);
    L.bringToTop(this.myStats);
    // Cadre : coins coupés (le décor est masqué dans les angles), renforts rivetés.
    const fc = p.type === 'goulag' ? P.braiseSombre : p.type === 'final' ? P.orSombre : C.panelLine;
    const frame = this.add.graphics();
    const CH = 16;
    frame.fillStyle(C.bg, 1);
    frame.fillTriangle(A.x - 1, A.y - 1, A.x + CH, A.y - 1, A.x - 1, A.y + CH);
    frame.fillTriangle(A.x + A.w + 1, A.y - 1, A.x + A.w - CH, A.y - 1, A.x + A.w + 1, A.y + CH);
    frame.fillTriangle(A.x - 1, A.y + A.h + 1, A.x + CH, A.y + A.h + 1, A.x - 1, A.y + A.h - CH);
    frame.fillTriangle(A.x + A.w + 1, A.y + A.h + 1, A.x + A.w - CH, A.y + A.h + 1, A.x + A.w + 1, A.y + A.h - CH);
    frame.lineStyle(4, fc, 1);
    frame.strokePoints(chamferPoints(A.x, A.y, A.w, A.h, CH), false, true);
    frame.fillStyle(fc, 1);
    frame.fillRect(A.x + 10, A.y + 34, 22, 3);
    frame.fillRect(A.x + A.w - 32, A.y + 34, 22, 3);
    L.add(frame);
  }

  private updateMyStats(loadout: PlayerLoadout) {
    if (!this.myStats || !this.myStats.active || !this.params) return;
    const hp = this.phase === 'prep' ? this.params.hp : Math.round(this.me?.hp ?? this.params.hp);
    this.myStats.setText(`TOI  ♥ ${hp}/${this.params.maxHp}  ARM ${loadout.armor}  ✦ DPS ${Math.round(estimateDps(loadout))}`);
    if (this.myStats.width > ARENA.w - 28) this.myStats.setScale((ARENA.w - 28) / this.myStats.width);
    else this.myStats.setScale(1);
    if (this.phase === 'prep' && this.me) {
      this.me.maxArmor = loadout.armor;
      this.me.armor = loadout.armor;
      this.drawBars(this.me);
    }
  }

  /** Panneau de droite : indicatif, qualité, sac adverse en miniature, stats. */
  private buildEnemyPanel() {
    const L = this.enemyLayer;
    L.removeAll(true);
    this.enemyViews.clear();
    const E = ENEMY;
    const bot = this.bot!;
    const bl = this.botL!;
    const q = QUALITY[bot.quality];
    L.add(panel(this, E.x, E.y, E.w, E.h, P.braiseSombre));
    const name = txt(this, E.x + 30, E.y + 14, bot.name.toUpperCase(), 22, '#ef7b72', { fontFamily: TITLE_FONT });
    L.add(name);
    // Badge de qualité
    const bw = 78;
    const badge = this.add.graphics();
    badge.fillStyle(q.color, 1);
    badge.fillPoints(chamferPoints(E.x + E.w - bw - 14, E.y + 14, bw, 28, 7), true);
    L.add(badge);
    L.add(txt(this, E.x + E.w - bw / 2 - 14, E.y + 28, q.label, 14, '#0f0d13', { fontFamily: TITLE_FONT }).setOrigin(0.5));
    if (name.width > E.w - bw - 56) name.setScale((E.w - bw - 56) / name.width);
    L.add(txt(this, E.x + 14, E.y + 46, `${OPERATORS[bot.operator].name} · `, 15, C.quiet));
    const arch = txt(this, 0, E.y + 46, ARCHETYPES[bot.archetype].name.toUpperCase(), 15, C.accentStr, { fontStyle: 'bold' });
    arch.setX(E.x + 14 + (L.list[L.list.length - 1] as Phaser.GameObjects.Text).width);
    L.add(arch);
    // Sac adverse en miniature (sa boîte englobante seulement)
    const cells = bot.usable.map((k) => k.split(',').map(Number));
    const x0 = Math.min(...cells.map((c) => c[0]));
    const y0 = Math.min(...cells.map((c) => c[1]));
    const bwc = Math.max(...cells.map((c) => c[0])) - x0 + 1;
    const bhc = Math.max(...cells.map((c) => c[1])) - y0 + 1;
    const areaW = E.w - 24;
    const areaH = 178;
    const cell = Math.floor(Math.min(areaW / bwc, areaH / bhc, 46));
    const gx = E.x + (E.w - bwc * cell) / 2;
    const gy = E.y + 72 + (areaH - bhc * cell) / 2;
    const bg = this.add.graphics();
    bg.fillStyle(0x4b4354, 1);
    bg.fillRoundedRect(gx - 5, gy - 5, bwc * cell + 10, bhc * cell + 10, 10);
    bg.fillStyle(0x342e3c, 1);
    bg.fillRoundedRect(gx - 2, gy - 2, bwc * cell + 4, bhc * cell + 4, 8);
    bg.fillStyle(0x000000, 0.2);
    for (const [cx, cy] of cells) bg.fillRoundedRect(gx + (cx - x0) * cell + 3, gy + (cy - y0) * cell + 3, cell - 6, cell - 6, 4);
    L.add(bg);
    for (const it of bot.items) {
      const v = itemView(this, it, cell).setPosition(gx + (it.x - x0) * cell, gy + (it.y - y0) * cell);
      L.add(v);
      this.enemyViews.set(it.uid, v);
    }
    const st = txt(this, E.x + E.w / 2, E.y + E.h - 20, `♥ ${bl.maxHp}  ARM ${bl.armor}  ✦ DPS ${Math.round(estimateDps(bl))}`, 17, C.text, { fontStyle: 'bold' }).setOrigin(0.5);
    L.add(st);
    // Indice : on peut toucher le panneau pour le détail
    const hint = txt(this, E.x + E.w - 10, E.y + 50, 'détail ▸', 14, C.accentStr, { fontStyle: 'bold' }).setOrigin(1, 0);
    hint.setName('hint');
    L.add(hint);
    // Entrée du panneau
    L.setX(60).setAlpha(0);
    this.tweens.add({ targets: L, x: 0, alpha: 1, duration: 360, ease: 'Cubic.Out' });
  }

  /** Sac adverse en grand : touche un objet pour sa fiche. */
  private openEnemy() {
    if (this.modal || !this.bot) return;
    const bot = this.bot;
    const bl = this.botL!;
    const m = modalBase(this, () => this.closeModal());
    const q = QUALITY[bot.quality];
    const pnl = panel(this, 24, 110, W - 48, 1000, 0x6e2f27);
    m.add(pnl);
    m.add(txt(this, 54, 140, bot.name.toUpperCase(), 40, '#ef7b72', { fontFamily: TITLE_FONT }));
    const badge = this.add.graphics();
    badge.fillStyle(q.color, 1);
    badge.fillRoundedRect(W - 54 - 110, 148, 110, 36, 18);
    m.add(badge);
    m.add(txt(this, W - 54 - 55, 166, q.label, 20, '#0f0d13', { fontStyle: 'bold' }).setOrigin(0.5));
    m.add(txt(this, 54, 196, `${OPERATORS[bot.operator].name} · ♥ ${bl.maxHp} · ARM ${bl.armor} · DPS ${Math.round(estimateDps(bl))}`, 22, C.text));
    const A = ARCHETYPES[bot.archetype];
    m.add(txt(this, 54, 226, `${A.name.toUpperCase()} : ${A.blurb}`, 18, C.accentStr, { wordWrap: { width: W - 108 } }));
    const cells = bot.usable.map((k) => k.split(',').map(Number));
    const x0 = Math.min(...cells.map((c) => c[0]));
    const y0 = Math.min(...cells.map((c) => c[1]));
    const bwc = Math.max(...cells.map((c) => c[0])) - x0 + 1;
    const bhc = Math.max(...cells.map((c) => c[1])) - y0 + 1;
    const cell = Math.floor(Math.min(600 / bwc, 470 / bhc, 90));
    const gx = (W - bwc * cell) / 2;
    const gy = 290;
    const bg = this.add.graphics();
    bg.fillStyle(0x4b4354, 1);
    bg.fillRoundedRect(gx - 8, gy - 8, bwc * cell + 16, bhc * cell + 16, 14);
    bg.fillStyle(0x342e3c, 1);
    bg.fillRoundedRect(gx - 3, gy - 3, bwc * cell + 6, bhc * cell + 6, 10);
    bg.fillStyle(0x000000, 0.2);
    for (const [cx, cy] of cells) bg.fillRoundedRect(gx + (cx - x0) * cell + 5, gy + (cy - y0) * cell + 5, cell - 10, cell - 10, 6);
    m.add(bg);
    const infoY = gy + bhc * cell + 30;
    const info = txt(this, 54, infoY, 'Touche un objet pour sa fiche.', 20, C.quiet, { wordWrap: { width: W - 108 }, lineSpacing: 4 });
    for (const it of bot.items) {
      const v = itemView(this, it, cell).setPosition(gx + (it.x - x0) * cell, gy + (it.y - y0) * cell);
      m.add(v);
      for (const [cx, cy] of cellsAt(it, it.x, it.y)) {
        const z = this.add.zone(gx + (cx - x0 + 0.5) * cell, gy + (cy - y0 + 0.5) * cell, cell, cell).setInteractive();
        z.on('pointerup', (_p: unknown, _x: unknown, _y: unknown, ev: Phaser.Types.Input.EventData) => {
          ev?.stopPropagation?.();
          const d = describe(it);
          info.setText(`${d.title} · ${d.subtitle}\n${d.lines.slice(0, 4).join('\n')}`).setColor(C.text);
          flashItem(this, v, TIER_COLORS[tierOf(it.defId)]);
        });
        m.add(z);
      }
    }
    m.add(info);
    const ph = infoY + 170 - 110;
    pnl.clear();
    pnl.destroy();
    m.addAt(panel(this, 24, 110, W - 48, ph, 0x6e2f27), 1);
    m.add(txt(this, W / 2, 110 + ph + 34, 'Touche en dehors pour fermer', 20, C.quiet).setOrigin(0.5));
    this.modal = m;
    this.updateButtons();
  }

  // ---------------------------------------------------------------- duel : acteurs

  private makeActor(side: Side, x: number, feet: number, hp: number, maxHp: number, armor: number, name: string, figId: PxFigId, px: number): Actor {
    const dir = side === 'a' ? 1 : -1;
    const meta = PX_FIGS[figId];
    const fig = this.add.container(x, feet);
    // Ombre au sol
    const sh = this.add.ellipse(0, 2, 26 * px, 12, 0x000000, 0.45);
    fig.add(sh);
    if (this.textures.exists(pxKey(figId))) {
      fig.add(pxFigure(this, 0, 0, figId, px, dir < 0));
    } else {
      fig.add(this.add.rectangle(0, -28 * px, 14 * px, 56 * px, side === 'a' ? 0x6e6f55 : 0x6f5238).setOrigin(0.5));
    }
    const pt = (p: readonly number[]) => ({ x: x + p[0] * px * dir, y: feet + p[1] * px });
    const head = pt(meta.head);
    const barW = 120;
    const barY = Math.max(ARENA.y + 70, head.y - 18);
    const barX = Phaser.Math.Clamp(x, ARENA.x + barW / 2 + 10, ARENA.x + ARENA.w - barW / 2 - 10);
    const bars = this.add.graphics();
    const hpText = txt(this, barX, barY, '', 13, '#ffffff', { fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5);
    const label = txt(this, barX, barY - 32, name.toUpperCase(), 15, side === 'a' ? C.text : '#ef7b72', { fontFamily: TITLE_FONT, stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5);
    this.arenaLayer.add([fig, bars, hpText, label]);
    const a: Actor = {
      side, x, feet, hp, maxHp, armor, maxArmor: armor, fig, bars, hpText, barW, barX, barY,
      muzzle: pt(meta.muzzle), chest: pt(meta.chest),
      end: ENDURANCE_MAX, endMax: ENDURANCE_MAX, endRegen: 1, burn: 0, shock: 0, shockMax: 5, lastTired: -9, lastPierce: -9, chips: [],
    };
    this.drawBars(a);
    return a;
  }

  private drawBars(a: Actor) {
    const y = a.barY;
    const g = a.bars;
    const x0 = a.barX - a.barW / 2;
    g.clear();
    // Barre inclinée (parallélogramme), graduée tous les 10 %.
    const SK = 6;
    const bar = (bx: number, by: number, bw: number, bh: number) =>
      [new Phaser.Math.Vector2(bx + SK, by), new Phaser.Math.Vector2(bx + bw + SK, by), new Phaser.Math.Vector2(bx + bw, by + bh), new Phaser.Math.Vector2(bx, by + bh)];
    g.fillStyle(P.nuit, 0.85);
    g.fillPoints(bar(x0 - 3, y - 10, a.barW + 6, 20), true);
    const frac = Math.max(0, a.hp / a.maxHp);
    if (frac > 0) {
      g.fillStyle(a.side === 'a' ? (frac > 0.3 ? C.good : C.danger) : C.danger, 1);
      g.fillPoints(bar(x0, y - 8, a.barW * frac, 16), true);
      g.fillStyle(P.blanc, 0.2);
      g.fillPoints(bar(x0 + 1, y - 7, Math.max(0, a.barW * frac - 2), 5), true);
    }
    g.lineStyle(1, P.nuit, 0.8);
    for (let k = 1; k < 10; k++) {
      const tx = x0 + (a.barW * k) / 10;
      g.lineBetween(tx + SK * 0.9, y - 8, tx + SK * 0.1, y + 8);
    }
    g.lineStyle(2, a.side === 'a' ? P.traitClair : P.braiseSombre, 1);
    g.strokePoints(bar(x0 - 3, y - 10, a.barW + 6, 20), false, true);
    if (a.maxArmor > 0) {
      g.fillStyle(P.nuit, 0.85);
      g.fillPoints(bar(x0 + 4, y - 19, a.barW - 2, 7), true);
      const af = Math.max(0, a.armor) / a.maxArmor;
      if (af > 0) {
        g.fillStyle(C.armor, 1);
        g.fillPoints(bar(x0 + 4, y - 19, (a.barW - 2) * af, 7), true);
      }
    }
    // Endurance : fine jauge dorée sous la vie.
    if (Number.isFinite(a.endMax)) {
      g.fillStyle(P.nuit, 0.85);
      g.fillRect(x0, y + 12, a.barW, 5);
      g.fillStyle(a.end < 1.5 ? P.braise : P.or, 1);
      g.fillRect(x0, y + 12, (a.barW * Math.max(0, Math.min(a.end, a.endMax))) / a.endMax, 5);
    }
    // Statuts : pastille flamme (cumuls de Brûlure) et éclair (Choc / seuil).
    let cx = x0;
    const chip = (color: number, n: string, icon: (gx: number, gy: number) => void) => {
      const w = 22 + n.length * 7;
      g.fillStyle(P.nuit, 0.9);
      g.fillRoundedRect(cx, y + 21, w, 16, 5);
      g.lineStyle(1, color, 1);
      g.strokeRoundedRect(cx, y + 21, w, 16, 5);
      icon(cx + 8, y + 29);
      a.chips.push(this.add.text(cx + 15, y + 29, n, { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: hex(color), resolution: 2 }).setOrigin(0, 0.5));
      cx += w + 4;
    };
    for (const t of a.chips) t.destroy();
    a.chips = [];
    if (a.burn > 0) chip(P.orange, `${a.burn}`, (gx, gy) => {
      g.fillStyle(P.orange, 1);
      g.fillTriangle(gx - 4, gy + 5, gx + 4, gy + 5, gx, gy - 6);
      g.fillStyle(P.or, 1);
      g.fillTriangle(gx - 2, gy + 5, gx + 2, gy + 5, gx, gy - 1);
    });
    if (a.shock > 0) chip(P.precision, `${a.shock}/${a.shockMax}`, (gx, gy) => {
      g.fillStyle(P.precision, 1);
      g.fillTriangle(gx + 2, gy - 6, gx - 4, gy + 1, gx, gy + 1);
      g.fillTriangle(gx - 2, gy + 6, gx + 4, gy - 1, gx, gy - 1);
    });
    for (const t of a.chips) this.arenaLayer.add(t);
    a.hpText.setText(`${Math.ceil(a.hp)}`);
  }

  // ---------------------------------------------------------------- duel : lecture

  private startFight() {
    const p = this.params;
    if (!p || !this.bot || !this.botL || !this.me || !this.foe) return;
    const { loadout } = this.loadout();
    const result = simulateDuel(loadout, this.botL, p.seed, { hpA: p.hp });
    this.fightL = { a: loadout, b: this.botL };
    this.phase = 'combat';
    this.unfedLayer.setVisible(false);
    this.starLayer.setVisible(false);
    this.ammo.clear();
    for (const side of ['a', 'b'] as Side[]) {
      for (const w of this.fightL[side].weapons) {
        this.ammo.set(`${side}:${w.uid}`, { ammo: w.mag, mag: w.mag });
        this.showAmmo(side, w.uid);
      }
    }
    this.me.hp = Math.max(1, Math.min(p.maxHp, p.hp));
    this.me.maxHp = p.maxHp;
    this.me.armor = loadout.armor;
    this.me.maxArmor = loadout.armor;
    this.foe.hp = this.botL.maxHp;
    this.foe.armor = this.botL.armor;
    for (const [a, l] of [[this.me, loadout], [this.foe, this.botL]] as const) {
      a.endMax = l.endMax ?? Infinity;
      a.end = a.endMax;
      a.endRegen = l.endRegen ?? 1;
      a.burn = 0;
      a.shock = 0;
      a.shockMax = l.shockThreshold ?? 5;
    }
    this.drawBars(this.me);
    this.drawBars(this.foe);
    const vs = this.arenaLayer.getByName('vs');
    if (vs) this.tweens.add({ targets: vs, alpha: 0, scale: 2, duration: 220, onComplete: () => vs.destroy() });
    this.enemyLayer.getByName('hint')?.destroy();
    this.refresh();
    this.slam('COMBAT !', C.accentStr, GRID_Y + 160);
    vibrate([20, 40, 20]);
    this.play = { result, idx: 0, t: -0.5 };
    this.updateButtons();
  }

  private actor(side: Side): Actor {
    return side === 'a' ? this.me! : this.foe!;
  }

  private viewOf(side: Side, uid: number): Container | undefined {
    return side === 'a' ? this.views.get(uid) : this.enemyViews.get(uid);
  }

  /** Objet qui se déclenche : éclair et petite pulsation, dans le sac du joueur ou le sac adverse. */
  private trigger(side: Side, uid: number, color = 0xffffff) {
    const v = this.viewOf(side, uid);
    if (!v) return;
    flashItem(this, v, color);
    this.pulse(v, side === 'a' ? 1.08 : 1.18);
  }

  private pulse(v: Container, k: number) {
    if (v.getData('bs') === undefined) v.setData('bs', v.scaleX).setData('bx', v.x).setData('by', v.y);
    const bs = v.getData('bs') as number;
    const bx = v.getData('bx') as number;
    const by = v.getData('by') as number;
    const w = v.width * bs;
    const h = v.height * bs;
    (v.getData('pt') as Phaser.Tweens.Tween | undefined)?.stop();
    const st = { k };
    const apply = () => {
      v.setScale(bs * st.k);
      v.setPosition(bx - ((st.k - 1) * w) / 2, by - ((st.k - 1) * h) / 2);
    };
    apply();
    v.setData('pt', this.tweens.add({ targets: st, k: 1, duration: 200 / this.speed, ease: 'Quad.Out', onUpdate: apply, onComplete: apply }));
  }

  /** Remet à leur taille les objets encore en pulsation (fin de combat, combat passé). */
  private resetPulses() {
    for (const v of [...this.views.values(), ...this.enemyViews.values()]) {
      if (v.getData('bs') === undefined) continue;
      (v.getData('pt') as Phaser.Tweens.Tween | undefined)?.stop();
      v.setScale(v.getData('bs')).setPosition(v.getData('bx'), v.getData('by'));
    }
  }

  /** Feu continu (Viper) : badge « +18 % » sur l'arme qui tire, éteint à la recharge et en fin de duel. */
  private setHeat(side: Side, uid: number, heat: number) {
    const v = this.viewOf(side, uid);
    if (!v) return;
    let t = v.getData('heat') as Phaser.GameObjects.Text | undefined;
    if (heat <= 0) {
      t?.setVisible(false);
      return;
    }
    if (!t) {
      const mask = v.getData('mask') as boolean[][];
      const cell = v.getData('cell') as number;
      const k = cell / 80;
      const row = mask[0];
      const right = row.length - [...row].reverse().findIndex(Boolean);
      t = txt(this, right * cell - 5 * k, 5 * k, '', Math.max(12, Math.round(18 * k)), HEAT_COLORS[0], {
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(1, 0);
      v.add(t);
      v.setData('heat', t);
    }
    const lvl = heat >= 0.3 ? 2 : heat >= 0.15 ? 1 : 0;
    t.setText(`+${Math.round(heat * 100)} %`).setColor(HEAT_COLORS[lvl]).setVisible(true);
  }

  /** Bonus total (en %) de la Marque pour l'arme qui la consomme. */
  private markPct(side: Side, uid: number): number {
    const l = this.fightL?.[side];
    const w = l?.weapons.find((x) => x.uid === uid);
    return Math.round(((l?.markBonus ?? 0) + (w?.markBoost ?? 0)) * 100);
  }

  /** Marque (Sentinelle) : viseur qui tourne sur le combattant marqué, retiré quand la marque est consommée. */
  private setMark(a: Actor, on: boolean) {
    const old = this.markers[a.side];
    if (old) {
      delete this.markers[a.side];
      this.tweens.killTweensOf(old);
      this.tweens.killTweensOf(old.getData('ring'));
      this.tweens.add({ targets: old, scale: 1.8, alpha: 0, duration: 200 / this.speed, onComplete: () => old.destroy() });
    }
    if (!on) return;
    const m = this.add.container(a.chest.x, a.chest.y - 10).setDepth(26);
    const g = this.add.graphics();
    g.lineStyle(3, MARK_HEX, 1);
    g.strokeCircle(0, 0, 24);
    g.lineStyle(2, MARK_HEX, 0.8);
    g.strokeCircle(0, 0, 10);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.lineBetween(dx * 16, dy * 16, dx * 32, dy * 32);
    const ring = this.add.container(0, 0, [g]);
    const label = txt(this, 0, 42, 'MARQUÉ', 14, MARK_COLOR, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5);
    m.add([ring, label]);
    m.setData('ring', ring);
    m.setScale(1.8).setAlpha(0);
    this.tweens.add({ targets: m, scale: 1, alpha: 1, duration: 180 / this.speed, ease: 'Back.Out' });
    this.tweens.add({ targets: ring, angle: 360, duration: 2400, repeat: -1 });
    this.arenaLayer.add(m);
    this.markers[a.side] = m;
  }

  /** Efface les marques et les badges de Feu continu (fin de duel, nouveau duel). */
  private clearDuelFx() {
    for (const side of ['a', 'b'] as Side[]) {
      const m = this.markers[side];
      if (m) {
        this.tweens.killTweensOf(m);
        this.tweens.killTweensOf(m.getData('ring'));
        m.destroy();
      }
    }
    this.markers = {};
    this.fightL = null;
    for (const v of [...this.views.values(), ...this.enemyViews.values()]) {
      (v.getData('heat') as Phaser.GameObjects.Text | undefined)?.setVisible(false);
      (v.getData('ammo') as Phaser.GameObjects.Text | undefined)?.setVisible(false);
    }
    this.ammo.clear();
    this.unfedLayer.setVisible(true);
    this.starLayer.setVisible(true);
  }

  /** Compteur de munitions sur l'arme : « 7/15 », orange quand le chargeur est vide. */
  private showAmmo(side: Side, uid: number) {
    const st = this.ammo.get(`${side}:${uid}`);
    const v = this.viewOf(side, uid);
    if (!st || !v) return;
    let t = v.getData('ammo') as Phaser.GameObjects.Text | undefined;
    if (!t) {
      const cell = v.getData('cell') as number;
      const k = cell / 80;
      // En haut à gauche, après le coin de famille (le nom est en bas, le Feu continu en haut à droite).
      t = txt(this, 16 * k, 4 * k, '', Math.max(11, Math.round(16 * k)), '#ffffff', {
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0, 0);
      v.add(t);
      v.setData('ammo', t);
    }
    t.setText(`${st.ammo}/${st.mag}`).setColor(st.ammo === 0 ? '#f4b06a' : '#ffffff');
    t.setVisible(true);
  }

  /** Coup de lame : entaille sur la cible. */
  private slash(to: Actor, color = 0xffffff) {
    const g = this.add.graphics().setDepth(25).setPosition(to.chest.x, to.chest.y);
    const d = to.side === 'b' ? 1 : -1;
    g.lineStyle(5, color, 1);
    g.beginPath();
    g.arc(-18 * d, 0, 30, -0.9, 0.9);
    g.strokePath();
    g.setScale(d, 1);
    this.tweens.add({ targets: g, alpha: 0, duration: 200 / this.speed, onComplete: () => g.destroy() });
  }

  private floatText(a: Actor, s: string, color: string, size = 26, dy = 0) {
    const sp = this.speed;
    const t = txt(this, a.chest.x + Phaser.Math.Between(-18, 18), a.chest.y - 30 + dy, s, size, color, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(30)
      .setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 160 / sp, ease: 'Back.Out' });
    this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, delay: 250 / sp, duration: 550 / sp, ease: 'Quad.In', onComplete: () => t.destroy() });
  }

  /** Secousse d'écran + arrêt sur image, proportionnels à l'importance du coup. */
  private impact(tier: 'small' | 'medium' | 'large') {
    const cfg = { small: [60, 0.002, 0], medium: [110, 0.005, 0.05], large: [300, 0.012, 0.18] }[tier];
    this.cameras.main.shake(cfg[0], cfg[1]);
    this.freeze = Math.max(this.freeze, cfg[2]);
  }

  private hitReact(a: Actor) {
    const dir = a.side === 'a' ? -1 : 1;
    this.tweens.killTweensOf(a.fig);
    a.fig.x = a.x + 9 * dir;
    a.fig.alpha = a.fig.alpha < 0.5 ? a.fig.alpha : 0.55;
    this.tweens.add({ targets: a.fig, x: a.x, duration: 120 / this.speed, ease: 'Quad.Out' });
    if (a.hp > 0) this.tweens.add({ targets: a.fig, alpha: 1, duration: 120 / this.speed });
  }

  /** Traçante du canon à la poitrine de la cible ; l'éclair de bouche seulement pour la 1re balle d'un tir. */
  private tracer(from: Actor, to: Actor, muzzleFlash: boolean, miss: boolean) {
    const g = this.add.graphics().setDepth(25);
    const m = from.muzzle;
    const tx = to.chest.x + Phaser.Math.Between(-6, 6);
    const ty = to.chest.y + (miss ? Phaser.Math.Between(-40, -24) : Phaser.Math.Between(-8, 8));
    const fx = m.x + (tx - m.x) * 0.45;
    const fy = m.y + (ty - m.y) * 0.45;
    g.lineStyle(1.5, 0xece2cf, 0.6);
    g.lineBetween(m.x, m.y, fx, fy);
    g.lineStyle(3, from.side === 'b' ? 0xe8894a : 0xf8d9ab, 1);
    g.lineBetween(fx, fy, tx, ty);
    if (muzzleFlash) {
      const dir = tx > m.x ? 1 : -1;
      g.fillStyle(0xf8d9ab, 1);
      g.fillTriangle(m.x, m.y - 5, m.x, m.y + 5, m.x + 18 * dir, m.y);
      g.fillStyle(0xf4b06a, 0.8);
      g.fillCircle(m.x + 3 * dir, m.y, 5);
    }
    if (!miss) {
      g.fillStyle(0xf8d9ab, 1);
      for (let i = 0; i < 4; i++) g.fillRect(tx + Phaser.Math.Between(-7, 7), ty + Phaser.Math.Between(-7, 7), 2, 2);
    }
    this.tweens.add({ targets: g, alpha: 0, duration: 160 / this.speed, onComplete: () => g.destroy() });
  }

  private boom(a: Actor, color = C.accent) {
    const g = this.add.graphics().setDepth(25).setPosition(a.chest.x, a.chest.y);
    g.fillStyle(color, 0.75);
    g.fillCircle(0, 0, 40);
    g.lineStyle(4, color, 1);
    g.strokeCircle(0, 0, 52);
    g.setScale(0.3);
    this.tweens.add({ targets: g, scale: 1.2, alpha: 0, duration: 380 / this.speed, ease: 'Quad.Out', onComplete: () => g.destroy() });
  }

  /** Texte au-dessus du lanceur d'une explosion : grenade, frappe d'artillerie ou détonateur. */
  private fragLabel(side: Side, uid: number): string {
    const items = side === 'a' ? this.run.items : this.bot?.items ?? [];
    const d = ITEMS[items.find((i) => i.uid === uid)?.defId ?? ''];
    if (d?.keystone?.reloadBlast) return 'DÉTONATEUR';
    if (d?.active?.strike) return 'ARTILLERIE !';
    if (d?.active?.burn) return 'INCENDIE !';
    return 'FRAG !';
  }

  /** Son de tir selon la classe de l'arme ; le camp adverse est un peu plus discret et à droite. */
  private shotSfx(side: Side, uid: number) {
    const items = side === 'a' ? this.run.items : this.bot?.items ?? [];
    const def = items.find((i) => i.uid === uid)?.defId;
    const id: SfxId = (def ? SHOT_SFX[ITEMS[def].wclass ?? ''] : undefined) ?? 'shot_pistol';
    sfx(id, { vol: side === 'a' ? 0.75 : 0.55, pan: side === 'a' ? -0.25 : 0.25 });
  }

  /** Son d'impact : critique, armure (plus de la moitié absorbée) ou chair. */
  private hitSfx(to: Side, crit: boolean, amount: number, absorbed = 0) {
    const pan = to === 'a' ? -0.3 : 0.3;
    if (crit) sfx('crit', { vol: 0.8, pan });
    else if (absorbed > amount / 2) sfx('hit_armor', { vol: 0.45, pan });
    else sfx('hit', { vol: to === 'a' ? 0.7 : 0.5, pan });
  }

  /** « PERCE L'ARMURE » : des dégâts passent aux PV alors qu'il reste de l'armure (au plus une fois par seconde et demie). */
  private pierceHint(a: Actor) {
    const t = this.play?.t ?? 0;
    if (t - a.lastPierce < 1.5) return;
    a.lastPierce = t;
    this.floatText(a, "PERCE L'ARMURE", hex(P.acierClair), 15, 48);
  }

  /** Éteint les badges de Feu continu de toutes les armes d'un camp (décharge du Choc). */
  private setHeatAll(side: Side, heat: number) {
    for (const w of this.fightL?.[side].weapons ?? []) this.setHeat(side, w.uid, heat);
  }

  private applyEvent(e: DuelEvent, animate: boolean) {
    // Statuts posés par une grenade, un flash ou un taser : sur l'adversaire du lanceur.
    if ((e.kind === 'frag' || e.kind === 'taser' || e.kind === 'flash') && (e.burnStacks !== undefined || e.shockStacks !== undefined)) {
      const to = this.actor(e.side === 'a' ? 'b' : 'a');
      if (e.burnStacks !== undefined) to.burn = e.burnStacks;
      if (e.shockStacks !== undefined) to.shock = e.shockStacks;
      this.drawBars(to);
    }
    switch (e.kind) {
      case 'shot': {
        const from = this.actor(e.from);
        const to = this.actor(e.from === 'a' ? 'b' : 'a');
        to.hp = e.hp;
        to.armor = e.armor;
        if (e.burnStacks !== undefined) to.burn = e.burnStacks;
        if (e.shockStacks !== undefined) to.shock = e.shockStacks;
        if (e.end !== undefined) {
          from.end = e.end;
          this.drawBars(from);
        }
        this.drawBars(to);
        if (!e.melee && !e.double) {
          const st = this.ammo.get(`${e.from}:${e.uid}`);
          if (st) {
            st.ammo = Math.max(0, st.ammo - 1);
            this.showAmmo(e.from, e.uid);
          }
        }
        if (e.melee) {
          if (!animate) break;
          this.trigger(e.from, e.uid, 0xffffff);
          sfx('melee', { vol: 0.7, pan: to.side === 'a' ? -0.3 : 0.3 });
          this.slash(to);
          this.floatText(to, `${e.amount}`, to.side === 'a' ? C.dangerStr : C.text, 24);
          if (e.bleed) this.floatText(to, `+${e.bleed} saignement`, BLEED_COLOR, 16, 30);
          this.hitReact(to);
          if (to.side === 'a') vibrate(5);
          break;
        }
        if (!animate) break;
        this.tracer(from, to, !e.double, e.miss);
        if (!e.double) this.shotSfx(e.from, e.uid);
        if (e.miss) {
          if (!e.double) sfx('miss', { vol: 0.5 });
        } else this.hitSfx(to.side, e.crit || !!e.marked, e.amount, e.absorbed);
        if (e.mark) sfx('mark', { vol: 0.6 });
        if (!e.double) {
          this.trigger(e.from, e.uid, e.crit ? C.accent : 0xffffff);
          this.setHeat(e.from, e.uid, e.heat ?? 0);
        }
        if (e.blocked) {
          this.floatText(to, 'BLOQUÉ', ARMOR_STR, 22);
          const sh = this.fightL?.[to.side].block;
          const v = sh ? this.viewOf(to.side, sh.uid) : undefined;
          if (v) flashItem(this, v, P.acierClair);
          sfx('hit_armor', { vol: 0.6, pan: to.side === 'a' ? -0.3 : 0.3 });
        } else if (e.miss) this.floatText(to, 'raté', C.quiet, 20);
        else {
          if (e.marked) {
            // Touche qui consomme la Marque : texte distinct, couleur Précision.
            this.setMark(to, false);
            this.floatText(to, `${e.amount}${e.crit ? ' CRIT' : ''} ◎`, MARK_COLOR, 36);
            this.floatText(to, `MARQUE +${this.markPct(e.from, e.uid)} %`, MARK_COLOR, 18, 34);
          } else {
            const col = e.crit ? C.accentStr : to.side === 'a' ? C.dangerStr : C.text;
            this.floatText(to, `${e.amount}${e.crit ? ' CRIT' : ''}${e.pierce ? ' ⇢' : ''}`, col, e.crit ? 32 : 24);
          }
          if (e.mark) this.setMark(to, true); // le viseur porte l'étiquette « MARQUÉ »
          const w = this.fightL?.[e.from].weapons.find((x) => x.uid === e.uid);
          if ((e.pierce || (w?.trueDmg ?? 0) > 0) && e.armor > 0.5 && (e.absorbed ?? 0) < e.amount - 0.5) this.pierceHint(to);
          this.hitReact(to);
          if (e.crit || e.marked) this.impact('medium');
          else if (to.side === 'a' && e.amount >= 10) this.impact('small');
          if (to.side === 'a') vibrate(5);
        }
        break;
      }
      case 'reload': {
        const st = this.ammo.get(`${e.side}:${e.uid}`);
        if (st) {
          st.ammo = st.mag;
          this.showAmmo(e.side, e.uid);
        }
        if (animate) {
          const v = this.viewOf(e.side, e.uid);
          if (v) flashItem(this, v, 0x5fb3e0);
          sfx('reload', { vol: e.side === 'a' ? 0.6 : 0.4, pan: e.side === 'a' ? -0.3 : 0.3 });
          this.setHeat(e.side, e.uid, 0); // la recharge éteint le Feu continu
        }
        break;
      }
      case 'bleed': {
        const a = this.actor(e.side);
        a.hp = e.hp;
        this.drawBars(a);
        if (animate && e.amount > 0) this.floatText(a, `-${e.amount}`, BLEED_COLOR, 18);
        break;
      }
      case 'taser': {
        const to = this.actor(e.side === 'a' ? 'b' : 'a');
        to.hp = e.hp;
        to.armor = e.armor;
        this.drawBars(to);
        if (animate) {
          this.trigger(e.side, e.uid, 0x9ad3f2);
          sfx('taser', { vol: 0.7 });
          this.tracer(this.actor(e.side), to, false, false);
          this.hitReact(to);
          this.floatText(to, `TASER ${e.amount}`, '#9ad3f2', 22);
          this.floatText(to, 'IMMOBILISÉ', '#9ad3f2', 16, 30);
          this.impact('small');
          vibrate(15);
        }
        break;
      }
      case 'bandage': {
        const a = this.actor(e.side);
        a.hp = e.hp;
        this.drawBars(a);
        if (animate) {
          this.trigger(e.side, e.uid, C.good);
          sfx('heal', { vol: 0.6 });
          this.floatText(a, `+${e.amount}`, C.goodStr, 26);
          if (e.cured > 0) this.floatText(a, 'BANDAGE', C.goodStr, 16, 30);
        }
        break;
      }
      case 'frag': {
        const to = this.actor(e.side === 'a' ? 'b' : 'a');
        to.hp = e.hp;
        to.armor = e.armor;
        this.drawBars(to);
        if (animate) {
          this.trigger(e.side, e.uid, C.accent);
          sfx('frag', { vol: 0.9 });
          this.boom(to, e.side === 'a' ? C.accent : C.danger);
          this.hitReact(to);
          this.floatText(to, `${e.amount}`, C.accentStr, 32);
          this.floatText(this.actor(e.side), this.fragLabel(e.side, e.uid), '#e9c46a', 18);
          if (e.armor > 0.5 && (e.absorbed ?? 0) < e.amount - 0.5) this.pierceHint(to);
          this.impact('medium');
          vibrate(20);
        }
        break;
      }
      case 'smoke':
        if (animate) {
          this.trigger(e.side, e.uid, 0xa39a8c);
          sfx('smoke', { vol: 0.7 });
          const a = this.actor(e.side);
          const g = this.add.graphics().setDepth(24);
          g.fillStyle(0xece2cf, 0.4);
          const sx = a.x + (e.side === 'a' ? 50 : -50);
          for (let i = 0; i < 5; i++) g.fillCircle(sx + Phaser.Math.Between(-30, 30), a.feet - 40 - Phaser.Math.Between(0, 70), Phaser.Math.Between(26, 40));
          g.setScale(0.4);
          this.tweens.add({ targets: g, scale: 1, duration: 300 / this.speed, ease: 'Quad.Out' });
          this.tweens.add({ targets: g, alpha: 0, delay: 200, duration: Math.max(200, ((e.until - e.t) * 1000) / this.speed), onComplete: () => g.destroy() });
          this.floatText(a, 'FUMIGÈNE', '#ece2cf', 18);
        }
        break;
      case 'flash':
        if (animate) {
          this.trigger(e.side, e.uid, 0xffffff);
          const foe = this.actor(e.side === 'a' ? 'b' : 'a');
          if (foe.hp > 0) this.floatText(foe, 'ÉTOURDI', '#ffffff', 20);
          this.cameras.main.flash(120, 255, 255, 255);
          sfx('flash', { vol: 0.8 });
          vibrate(15);
        }
        break;
      case 'adrenaline':
        if (animate) {
          this.trigger(e.side, e.uid, C.good);
          sfx('adrenaline', { vol: 0.6 });
          this.floatText(this.actor(e.side), 'ADRÉNALINE', C.goodStr, 20);
        }
        break;
      case 'heal': {
        const a = this.actor(e.side);
        a.hp = e.hp;
        this.drawBars(a);
        if (animate) {
          this.trigger(e.side, e.uid, C.good);
          sfx('heal', { vol: 0.6, pitch: 0.9 });
          this.floatText(a, `+${e.amount}`, C.goodStr, 30);
        }
        break;
      }
      case 'burn': {
        const a = this.actor(e.side);
        a.hp = e.hp;
        a.burn = e.stacks;
        this.drawBars(a);
        if (animate && e.amount >= 1) this.floatText(a, `-${Math.round(e.amount)}`, hex(P.orange), 17, -6);
        break;
      }
      case 'discharge': {
        const a = this.actor(e.side);
        a.shock = 0;
        if (e.hp !== undefined) a.hp = e.hp;
        if (animate && e.amount) this.floatText(a, `-${e.amount}`, hex(P.precisionClaire), 28, 10);
        this.drawBars(a);
        if (animate) {
          this.trigger(e.side === 'a' ? 'b' : 'a', e.uid, P.precision);
          this.floatText(a, 'DÉCHARGE', hex(P.precisionClaire), 22, -20);
          this.setHeatAll(e.side, 0);
          this.cameras.main.flash(90, 95, 179, 224);
          sfx('taser', { vol: 0.6, pitch: 1.3 });
          this.hitReact(a);
        }
        break;
      }
      case 'tired': {
        const a = this.actor(e.side);
        a.end = e.end;
        this.drawBars(a);
        if (animate && (this.play?.t ?? 0) - a.lastTired > 1.5) {
          a.lastTired = this.play?.t ?? 0;
          this.floatText(a, 'ESSOUFFLÉ', C.quiet, 15, 40);
        }
        break;
      }
      case 'revive': {
        const a = this.actor(e.side);
        a.hp = e.hp;
        a.burn = 0;
        this.drawBars(a);
        if (animate) {
          this.trigger(e.side, e.uid, P.violetClair);
          sfx('heal', { vol: 0.8, pitch: 1.2 });
          this.floatText(a, 'ANGE GARDIEN', hex(P.violetClair), 26, 20);
          this.floatText(a, `+${e.hp}`, C.goodStr, 30);
          this.cameras.main.flash(220, 195, 166, 224);
          vibrate([30, 30, 30]);
        }
        break;
      }
      case 'death': {
        const a = this.actor(e.side);
        a.hp = 0;
        this.drawBars(a);
        // Chute vers l'avant : le corps reste dans l'arène.
        const ang = e.side === 'a' ? 82 : -82;
        if (animate) {
          this.tweens.killTweensOf(a.fig);
          this.tweens.add({ targets: a.fig, alpha: 0.3, angle: ang, y: a.feet - 16, duration: 340 / this.speed, ease: 'Quad.In' });
          this.impact('large');
          sfx('death');
          this.boom(a, e.side === 'a' ? C.danger : 0xffffff);
          this.cameras.main.flash(200, e.side === 'a' ? 160 : 255, e.side === 'a' ? 20 : 240, e.side === 'a' ? 20 : 200);
          vibrate(e.side === 'a' ? [60, 40, 120] : [30, 30, 60]);
        } else a.fig.setAlpha(0.3).setAngle(ang).setY(a.feet - 16);
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
    const dt = (delta / 1000) * this.speed;
    P.t += dt;
    // Endurance qui remonte entre deux tirs (les événements la recalent) ; jauge redessinée par paliers.
    for (const a of [this.me, this.foe]) {
      if (!a || !Number.isFinite(a.endMax) || a.end >= a.endMax || a.hp <= 0) continue;
      const before = Math.floor(a.end * 4);
      a.end = Math.min(a.endMax, a.end + a.endRegen * dt);
      if (Math.floor(a.end * 4) !== before) this.drawBars(a);
    }
    const ev = P.result.events;
    while (P.idx < ev.length && ev[P.idx].t <= P.t) this.applyEvent(ev[P.idx++], true);
    if (P.idx >= ev.length && P.t >= P.result.duration + 0.8) this.finishFight();
  }

  private skipFight() {
    const P = this.play;
    if (!P) return;
    while (P.idx < P.result.events.length) this.applyEvent(P.result.events[P.idx++], false);
    this.finishFight();
  }

  // ---------------------------------------------------------------- duel : rapport

  /** Fige le rapport du duel qui vient de finir (objets et liens tels qu'au combat : on peut revendre ensuite). */
  private keepReport(res: DuelResult) {
    if (!this.fightL || !this.bot) return;
    const mine = this.run.items.filter((i) => i.placed);
    this.report = {
      rep: duelReport(res, this.fightL.a, this.fightL.b),
      duration: res.duration,
      win: res.win,
      defs: { a: new Map(mine.map((i) => [i.uid, i.defId])), b: new Map(this.bot.items.map((i) => [i.uid, i.defId])) },
      links: {
        a: computeLoadout(this.run.items, this.run.operator, this.fightL.a.maxHp).links,
        b: computeLoadout(this.bot.items, this.bot.operator, this.bot.maxHp, { wins: this.bot.wins }).links,
      },
    };
  }

  /** Valeur principale d'un objet dans le rapport : texte court et couleur (dégâts, soins, armure, effet). */
  private reportValue(r: ItemReport): { s: string; color: string } | null {
    if (r.dmg > 0) return { s: `${r.dmg}`, color: C.accentStr };
    if (r.heal > 0) return { s: `+${r.heal}`, color: C.goodStr };
    if (r.absorbed > 0) return { s: `${r.absorbed}`, color: ARMOR_STR };
    if (r.stun > 0) return { s: `${fmt1(r.stun)} s`, color: C.text };
    if (r.dodged > 0) return { s: `${r.dodged} ratés`, color: C.text };
    if (r.blocked > 0) return { s: `${r.blocked} bloqués`, color: ARMOR_STR };
    if (r.uses > 0) return { s: `×${r.uses}`, color: C.text };
    return null;
  }

  /** Après un duel : pastille de valeur sur chaque objet du sac qui a compté (le plus utile en doré). */
  private drawReportBadges() {
    this.reportLayer.removeAll(true);
    const R = this.report;
    if (!R || (this.phase !== 'result' && this.phase !== 'over')) return;
    const best = R.rep.a.items[0]?.uid;
    for (const r of R.rep.a.items) {
      const inst = this.run.items.find((i) => i.uid === r.uid && i.placed);
      const val = this.reportValue(r);
      if (!inst || !val || this.drag?.item?.uid === r.uid || this.hidden.has(r.uid)) continue;
      // Case de l'objet la plus proche du centre de sa forme, pastille à son pied.
      const cells = cellsAt(inst, inst.x, inst.y);
      const mx = cells.reduce((t, c) => t + c[0], 0) / cells.length;
      const my = cells.reduce((t, c) => t + c[1], 0) / cells.length;
      const [cx, cy] = cells.reduce((a, c) => (Math.hypot(c[0] - mx, c[1] - my) < Math.hypot(a[0] - mx, a[1] - my) ? c : a));
      const x = GRID_X + (cx + 0.5) * CELL;
      const y = GRID_Y + (cy + 0.5) * CELL;
      const t = txt(this, x, y, val.s, 17, val.color, { fontStyle: 'bold', fontFamily: MONO }).setOrigin(0.5);
      const w = Math.max(40, t.width + 16);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.78);
      g.fillRoundedRect(x - w / 2, y - 12, w, 24, 12);
      if (r.uid === best) {
        g.lineStyle(2, GOLD_HEX, 1);
        g.strokeRoundedRect(x - w / 2, y - 12, w, 24, 12);
      }
      this.reportLayer.add([g, t]);
    }
  }

  /** Lignes de détail d'un objet du rapport. */
  private reportDetail(side: Side, r: ItemReport): string {
    const R = this.report!;
    const parts: string[] = [];
    if (r.shots > 0 && !r.uses) {
      parts.push(`${r.hits}/${r.shots} touches`);
      if (r.crits) parts.push(`${r.crits} crit.`);
    }
    if (r.bleed > 0) parts.push(`dont ${r.bleed} saignement`);
    if (r.uses > 0) parts.push(r.uses > 1 ? `${r.uses} fois` : '1 fois');
    if (r.dmg > 0 && r.uses > 0) parts.push(`${r.dmg} dégâts`);
    if (r.heal > 0) parts.push(`+${r.heal} PV`);
    if (r.stun > 0) parts.push(`${fmt1(r.stun)} s d'étourdissement`);
    if (r.dodged > 0) parts.push(`${r.dodged} tirs adverses ratés dessous`);
    if (r.blocked > 0) parts.push(`${r.blocked} touche${r.blocked > 1 ? 's' : ''} bloquée${r.blocked > 1 ? 's' : ''}`);
    if (r.absorbed > 0) parts.push(`${r.absorbed} dégâts pris par l'armure`);
    if (r.burnDmg > 0) parts.push(`dont ${r.burnDmg} de brûlure`);
    if (r.discharges > 0) parts.push(`${r.discharges} décharge${r.discharges > 1 ? 's' : ''}`);
    if (r.tired > 0) parts.push(`essoufflée ${r.tired} fois`);
    // Ce qui l'a renforcé : les objets liés à lui.
    const names = new Set<string>();
    for (const l of R.links[side]) {
      const o = l.a === r.uid ? l.b : l.b === r.uid ? l.a : null;
      const d = o !== null ? R.defs[side].get(o) : undefined;
      if (d) names.add(ITEMS[d].short);
    }
    if (names.size) parts.push(`lié à ${[...names].join(', ')}`);
    return parts.join(' · ');
  }

  /** Rapport de duel : pour chaque camp, ce que chaque objet a infligé, soigné ou encaissé. */
  private openReport() {
    const R = this.report;
    if (this.modal || !R) return;
    const m = modalBase(this, () => this.closeModal());
    this.modal = m;
    this.updateButtons();
    const top = 70;
    const PH = 1140;
    m.add(panel(this, 24, top, W - 48, PH, R.win ? 0x3f5a35 : 0x6e2f27));
    m.add(txt(this, 54, top + 24, 'RAPPORT DE DUEL', 34, R.win ? C.goodStr : '#ef7b72', { fontFamily: TITLE_FONT }));
    m.add(txt(this, W - 54, top + 34, `${fmt1(R.duration)} s`, 22, C.quiet, { fontFamily: MONO }).setOrigin(1, 0));
    const A = R.rep.a;
    const sum = `Infligés ${A.dealt} · Reçus ${A.tookHp + A.tookArmor} (armure ${A.tookArmor})${A.healed ? ` · Soignés ${A.healed}` : ''}`;
    m.add(txt(this, 54, top + 72, sum, 19, C.text, { wordWrap: { width: W - 108 } }));
    // Légende des couleurs des valeurs et des barres.
    let lx = 54;
    for (const [s, col] of [['■ dégâts', C.accentStr], ['■ soins', C.goodStr], ['■ armure absorbée', ARMOR_STR], ['■ effets', C.text]] as const) {
      const t = txt(this, lx, top + 102, s, 16, col);
      m.add(t);
      lx += t.width + 18;
    }

    const maxW = Math.max(1, ...[...R.rep.a.items, ...R.rep.b.items].map(itemWeight));
    const ROW = 70;
    const rows = (side: Side, y0: number, cap: number, title: string, color: string): number => {
      const list = R.rep[side].items;
      m.add(txt(this, 54, y0, title, 20, color, { fontStyle: 'bold' }));
      let y = y0 + 34;
      if (!list.length) {
        m.add(txt(this, 54, y, 'Aucun objet n\'a servi.', 18, C.quiet));
        return y + 40;
      }
      for (const r of list.slice(0, cap)) {
        const def = R.defs[side].get(r.uid);
        if (!def) continue;
        // Icône réduite à 56 × 52
        const mask = maskOf(def, 0);
        const cell = Math.floor(Math.min(56 / mask[0].length, 52 / mask.length));
        const v = itemView(this, { defId: def, rot: 0 }, cell);
        v.setPosition(54 + (56 - mask[0].length * cell) / 2, y + (52 - mask.length * cell) / 2);
        m.add(v);
        const x1 = 122;
        m.add(txt(this, x1, y + 2, ITEMS[def].short, 19, C.text, { fontStyle: 'bold' }));
        const val = this.reportValue(r);
        if (val) m.add(txt(this, W - 54, y + 2, val.s, 20, val.color, { fontStyle: 'bold', fontFamily: MONO }).setOrigin(1, 0));
        // Barre : dégâts, soins et armure empilés, à l'échelle du meilleur objet des deux sacs.
        const bw = W - 54 - 96 - (x1 + 120);
        const bx = x1 + 120;
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.35);
        g.fillRoundedRect(bx, y + 8, bw, 12, 6);
        let off = 0;
        for (const [v2, c] of [[r.dmg, C.accent], [r.heal, C.good], [r.absorbed, C.armor]] as const) {
          if (v2 <= 0) continue;
          const w = Math.max(3, (bw * v2) / maxW);
          g.fillStyle(c, 1);
          g.fillRect(bx + off, y + 8, Math.min(w, bw - off), 12);
          off += w;
        }
        m.add(g);
        m.add(txt(this, x1, y + 30, this.reportDetail(side, r), 15, C.quiet, { wordWrap: { width: W - 54 - x1 }, maxLines: 2 }));
        y += ROW;
      }
      if (list.length > cap) {
        m.add(txt(this, 54, y - 4, `+ ${list.length - cap} autre${list.length - cap > 1 ? 's' : ''}`, 16, C.quiet));
        y += 22;
      }
      return y;
    };
    let y = rows('a', top + 140, 8, 'TON SAC', C.accentStr);
    const botName = this.bot?.name?.toUpperCase() ?? 'ADVERSAIRE';
    rows('b', y + 14, Math.max(2, Math.floor((top + PH - 110 - (y + 48)) / ROW)), `SAC DE ${botName}`, '#ef7b72');

    const by = top + PH - 96;
    const enemyBtn = button(this, 54, by, 300, 72, 'Son sac', () => {
      this.closeModal();
      this.openEnemy();
    }, { size: 24 });
    const closeBtn = button(this, W - 54 - 300, by, 300, 72, 'Fermer', () => this.closeModal(), { primary: true, size: 26 });
    m.add([enemyBtn.root, closeBtn.root]);
  }

  // ---------------------------------------------------------------- duel : résultat

  private finishFight() {
    const P = this.play;
    const p = this.params;
    if (!P || !p || !this.bot) return;
    this.play = null;
    this.freeze = 0;
    this.resetPulses();
    this.keepReport(P.result);
    this.clearDuelFx();
    const res = P.result;
    const r = this.run;
    if (res.timeout) toast(this, 'Temps écoulé : décision aux PV restants', C.text, ARENA.y + ARENA.h + 30);
    this.phase = 'result';

    if (p.type === 'goulag') {
      resolveGoulag(r, res.win);
      if (res.win) {
        banner(this, 'DE RETOUR !', C.goodStr, GRID_Y + 160);
        sfx('win');
        vibrate([40, 40, 80]);
        const e = endAction(r);
        this.post = e?.nextRound ? { label: 'Ravitaillement →', go: () => this.route() } : { label: 'Continuer', go: () => this.route() };
      } else this.gameOver(false);
      this.refresh();
      return;
    }

    const out = resolveDuel(r, { win: res.win, hpEnd: res.hpEndA, botItems: this.bot.items, botUsable: this.bot.usable });
    if (out.over) {
      this.gameOver(out.over === 'win');
      this.refresh();
      return;
    }
    if (out.goulag) {
      banner(this, 'ÉLIMINÉ', C.dangerStr, GRID_Y + 160);
      sfx('lose');
      vibrate([80, 60, 160]);
      this.post = { label: 'Goulag →', go: () => this.showGoulag() };
      this.refresh();
      return;
    }
    // Victoire : crédits (et sacoche après une Élite) tout de suite, puis on fouille le sac du vaincu.
    banner(this, 'VICTOIRE', C.goodStr, GRID_Y + 160);
    sfx('win');
    vibrate([30, 30, 60]);
    this.post = null;
    this.refresh(); // sauvegarde : un rechargement reprend au choix du butin
    const loot = out.loot;
    const bagSources = loot.bags.map(() => ({ x: ENEMY.x + ENEMY.w / 2, y: ENEMY.y + ENEMY.h / 2 }));
    loot.bags.forEach((b) => this.hiddenBags.add(b.uid));
    this.refresh();
    this.time.delayedCall(700, () => {
      if (loot.bags.length) this.flyToReserve([], bagSources, 0, loot.bags);
      if (loot.credits) {
        toast(this, `+${loot.credits} cr${loot.bags.length ? ' + sacoche' : ''}`, C.accentStr, GRID_Y + 250);
        this.coinBurst(ENEMY.x + ENEMY.w / 2, ENEMY.y + ENEMY.h - 30);
      }
    });
    this.time.delayedCall(r.pendingLoot ? 1300 : 700, () => {
      if (r.pendingLoot) this.openLootChoice(this.bot?.name);
      else this.afterLoot();
    });
  }

  /** Suite après le butin : fin de l'action. */
  private afterLoot() {
    const e = endAction(this.run);
    this.post = e?.nextRound ? { label: 'Ravitaillement →', go: () => this.route() } : { label: 'Continuer', go: () => this.route() };
    this.refresh();
  }

  /**
   * Fouille du sac adverse (« comme quand on loot vraiment un gars ») : son sac en grand, tel qu'il était rangé.
   * On prend tout ce qu'on veut : l'objet va en réserve, ou directement dans le sac si la réserve est pleine ;
   * si tout est plein, on choisit un objet à revendre en échange. « Terminer » laisse le reste.
   * La fouille est en attente dans la run (pendingLoot) : un rechargement la reprend ici.
   */
  private openLootChoice(botName?: string) {
    const pl = this.run.pendingLoot;
    if (!pl) return this.afterLoot();
    this.closeModal();
    const m = modalBase(this);
    this.modal = m;
    this.phase = 'result';
    this.updateButtons();
    const top = 96;
    const PH = 1130;
    const crate = pl.crate;
    const pnl = panel(this, 24, top, W - 48, PH, crate === 'caisse_epique' ? EPIC_COLOR : crate === 'caisse_renforcee' ? 0x5fb3e0 : crate ? 0x86a95a : 0x6e2f27);
    m.add(pnl);
    const head = crate ? CRATE_TITLE[crate] : botName ? `SAC DE ${botName.toUpperCase()}` : 'SAC DU VAINCU';
    m.add(txt(this, 54, top + 26, head, 34, crate === 'caisse_epique' ? EPIC_HEX : crate ? '#a8c97a' : '#ef7b72', { fontFamily: TITLE_FONT }));
    const counter = txt(this, 54, top + 76, '', 24, GOLD, { fontStyle: 'bold' });
    m.add(counter);
    // Sac du bot : ses cases (ou, à défaut, la boîte englobante de ses objets)
    const cells = (pl.usable.length ? pl.usable.map((k) => k.split(',').map(Number)) : pl.items.flatMap((it) => cellsAt(it, it.x, it.y)));
    const x0 = Math.min(...cells.map((c) => c[0]));
    const y0 = Math.min(...cells.map((c) => c[1]));
    const bwc = Math.max(...cells.map((c) => c[0])) - x0 + 1;
    const bhc = Math.max(...cells.map((c) => c[1])) - y0 + 1;
    const cell = Math.floor(Math.min(620 / bwc, 520 / bhc, 96));
    const gx = (W - bwc * cell) / 2;
    const gy = top + 130;
    const bg = this.add.graphics();
    bg.fillStyle(0x4b4354, 1);
    bg.fillRoundedRect(gx - 8, gy - 8, bwc * cell + 16, bhc * cell + 16, 14);
    bg.fillStyle(0x342e3c, 1);
    bg.fillRoundedRect(gx - 3, gy - 3, bwc * cell + 6, bhc * cell + 6, 10);
    bg.fillStyle(0x000000, 0.2);
    for (const [cx, cy] of cells) bg.fillRoundedRect(gx + (cx - x0) * cell + 5, gy + (cy - y0) * cell + 5, cell - 10, cell - 10, 6);
    m.add(bg);
    const infoY = gy + bhc * cell + 26;
    const title = txt(this, 54, infoY, '', 24, C.text, { fontStyle: 'bold', wordWrap: { width: W - 108 } });
    const info = txt(this, 54, infoY + 40, '', 19, C.quiet, { wordWrap: { width: W - 108 }, lineSpacing: 4 });
    m.add([title, info]);
    const sel = this.add.graphics();
    const views = new Map<number, Container>();
    /** Objets pris (uid dans la run) et d'où ils partent, pour l'animation vers la réserve à la fin. */
    const flown: { item: ItemInst; from: { x: number; y: number } }[] = [];
    let current: ItemInst | null = null;
    let swapLayer: Container | null = null;

    const centerOf = (uid: number) => {
      const vv = views.get(uid)!;
      return { x: vv.x + (vv.width * vv.scaleX) / 2, y: vv.y + (vv.height * vv.scaleY) / 2 };
    };
    /** L'objet a quitté le sac du vaincu : il s'efface, la fiche se vide. */
    const taken = (srcUid: number, item: ItemInst, to: 'reserve' | 'sac') => {
      const v = views.get(srcUid)!;
      flashItem(this, v, 0xe9c46a);
      this.tweens.add({ targets: v, alpha: 0.15, duration: 250 });
      flown.push({ item, from: centerOf(srcUid) });
      sfx('pickup');
      vibrate(15);
      toast(this, to === 'reserve' ? `${ITEMS[item.defId].short} → réserve` : `Réserve pleine : ${ITEMS[item.defId].short} rangé dans le sac`, C.goodStr, top + 110);
      current = null;
      sel.clear();
      saveRun(this.run);
      update();
    };

    const take = button(this, 54, top + PH - 120, 360, 96, 'Prendre', () => {
      if (!current || swapLayer) return;
      const src = current;
      const r = lootItem(this.run, src.uid);
      if (!r) return;
      if (r.to === 'plein') return openSwap(src);
      taken(src.uid, r.item, r.to);
    }, { primary: true, size: 26 });
    const finish = button(this, 54 + 376, top + PH - 120, W - 108 - 376, 96, 'Terminer', () => {
      if (swapLayer) return;
      if (crate === 'largage' && !this.run.pendingLoot?.picked) return;
      finishLoot(this.run);
      this.closeModal();
      // Ce qui est allé en réserve s'y envole ; ce qui est dans le sac y apparaît (et peut s'assembler).
      const still = flown.filter((f) => this.run.items.some((i) => i.uid === f.item.uid && !i.placed));
      if (still.length) this.flyToReserve(still.map((f) => f.item), still.map((f) => f.from), 0);
      if (crate) {
        // Caisse : retour au rangement, l'action se termine avec le bouton principal.
        this.mode = 'caisse';
        this.crate = crate;
        this.epic = crate === 'caisse_epique';
        this.phase = 'edit';
        this.post = null;
        this.craftNow();
        this.updateButtons();
        return;
      }
      this.craftNow();
      this.afterLoot();
    }, { size: 24 });
    m.add([take.root, finish.root]);

    const update = () => {
      const p = this.run.pendingLoot;
      const max = p?.maxPicks;
      // Caisse : plus rien à prendre une fois le quota atteint.
      const left = p && (max === undefined || p.picked < max) ? p.items.length : 0;
      const res = `Réserve ${reserve(this.run).length}/${RESERVE_MAX}`;
      counter.setText(max !== undefined ? `Choisis ${max} objet${max > 1 ? 's' : ''} · ${p!.picked}/${max} · ${res}`
        : `${res} · ${left ? `${left} objet${left > 1 ? 's' : ''} à prendre` : 'sac vidé'}`);
      if (current) {
        const d = describe(current);
        title.setText(`${d.title} · ${d.subtitle}`).setColor(TIER_HEX[tierOf(current.defId)]);
        info.setText(d.lines.slice(0, 5).join('\n'));
        take.setLabel(`Prendre · ${ITEMS[current.defId].short}`);
        take.setEnabled(left > 0);
      } else {
        title.setText(left ? 'Touche un objet pour voir sa fiche, puis prends-le.' : 'Plus rien à prendre.').setColor(C.text);
        info.setText(crate === 'largage' ? 'Ton arme de départ : elle arrive dans le sac avec son chargeur. Elle oriente ta run sans la figer.'
          : crate ? 'Ce que tu prends va en réserve, puis dans le sac. Le reste reste dans la caisse.'
          : 'Choisis ce que tu emportes : la réserve, puis le sac. Le reste est perdu.');
        take.setLabel('Prendre');
        take.setEnabled(false);
      }
      finish.setLabel(left ? 'Terminer' : 'Terminer ▸');
      // Largage : on ne repart pas sans arme.
      finish.setEnabled(crate !== 'largage' || p?.picked === 1);
    };

    /** Tout est plein : choisir un objet du joueur à revendre pour faire de la place. */
    const openSwap = (src: ItemInst) => {
      const layer = this.add.container(0, 0);
      swapLayer = layer;
      m.add(layer);
      layer.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.75).setOrigin(0).setInteractive());
      layer.add(panel(this, 24, top, W - 48, PH, 0xf4b06a));
      layer.add(txt(this, 54, top + 26, 'TOUT EST PLEIN', 34, GOLD, { fontFamily: TITLE_FONT }));
      layer.add(txt(this, 54, top + 76, `Revends un objet pour prendre : ${ITEMS[src.defId].name}`, 22, C.text, { wordWrap: { width: W - 108 } }));
      const close = () => {
        layer.destroy();
        swapLayer = null;
      };
      const mine = [...this.run.items].sort((a, b) => Number(a.placed) - Number(b.placed));
      const TW = 150;
      const TH = 150;
      const cols = 4;
      const ox = (W - cols * TW - (cols - 1) * 10) / 2;
      mine.forEach((it, i) => {
        const tx = ox + (i % cols) * (TW + 10);
        const ty = top + 140 + Math.floor(i / cols) * (TH + 10);
        const g = this.add.graphics();
        g.fillStyle(C.panel, 1);
        g.fillRoundedRect(tx, ty, TW, TH, 12);
        g.lineStyle(2, TIER_COLORS[tierOf(it.defId)], 0.9);
        g.strokeRoundedRect(tx, ty, TW, TH, 12);
        layer.add(g);
        const d = dims(it);
        const sc = Math.min((TW - 20) / (d.w * CELL), 80 / (d.h * CELL), 0.5);
        layer.add(itemView(this, { defId: it.defId, rot: 0 }, CELL).setScale(sc).setPosition(tx + (TW - d.w * CELL * sc) / 2, ty + 10 + (80 - d.h * CELL * sc) / 2));
        layer.add(txt(this, tx + TW / 2, ty + 96, ITEMS[it.defId].short, 17, C.text, { fontStyle: 'bold' }).setOrigin(0.5, 0));
        layer.add(txt(this, tx + TW / 2, ty + 120, `${it.placed ? 'sac' : 'réserve'} · +${itemSellValue(it.defId)} cr`, 15, C.quiet).setOrigin(0.5, 0));
        const z = this.add.zone(tx + TW / 2, ty + TH / 2, TW, TH).setInteractive({ useHandCursor: true });
        z.on('pointerup', () => {
          const r = swapLoot(this.run, src.uid, it.uid);
          if (!r) {
            toast(this, `${ITEMS[src.defId].short} ne rentre pas, même à la place de ${ITEMS[it.defId].short}`, C.dangerStr, top + 110);
            vibrate([10, 30, 10]);
            return;
          }
          close();
          this.coinBurst(W / 2, top + 140);
          toast(this, `${ITEMS[it.defId].short} revendu +${r.credits} cr`, C.accentStr, top + 160);
          // L'objet revendu n'existe plus : il ne s'envole pas vers la réserve.
          for (let k = flown.length - 1; k >= 0; k--) if (flown[k].item.uid === it.uid) flown.splice(k, 1);
          this.refresh();
          taken(src.uid, r.take.item, r.take.to);
        });
        layer.add(z);
      });
      const cancel = button(this, 54, top + PH - 120, W - 108, 96, 'Annuler', close, { size: 26 });
      layer.add(cancel.root);
    };

    for (const it of pl.items) {
      const v = itemView(this, it, cell).setPosition(gx + (it.x - x0) * cell, gy + (it.y - y0) * cell);
      m.add(v);
      views.set(it.uid, v);
      const row = maskOf(it.defId, it.rot)[0];
      const right = (row.length - [...row].reverse().findIndex(Boolean)) * cell;
      this.affinityBadges(v, 2, 2, right - 2, it.defId);
      v.setAlpha(0);
      this.tweens.add({ targets: v, alpha: 1, delay: 80 + views.size * 50, duration: 200 });
      for (const [cx, cy] of cellsAt(it, it.x, it.y)) {
        const z = this.add.zone(gx + (cx - x0 + 0.5) * cell, gy + (cy - y0 + 0.5) * cell, cell, cell).setInteractive({ useHandCursor: true });
        z.on('pointerup', () => {
          if (swapLayer || !this.run.pendingLoot?.items.some((i) => i.uid === it.uid)) return;
          current = it;
          vibrate(8);
          sel.clear();
          sel.lineStyle(5, 0xe9c46a, 1);
          for (const [sx, sy] of cellsAt(it, it.x, it.y)) sel.strokeRoundedRect(gx + (sx - x0) * cell + 2, gy + (sy - y0) * cell + 2, cell - 4, cell - 4, 8);
          pop(this, v, 1.08, 160);
          update();
        });
        m.add(z);
      }
    }
    m.add(sel);
    update();
  }

  /** « ★ » (se lierait au sac) en haut à gauche, « ⚗ » (complète une recette) en haut à droite. */
  private affinityBadges(c: Container, left: number, top: number, right: number, defId: string) {
    const items = this.run.items;
    if (starAffinity(items, defId)) {
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.7);
      g.fillCircle(left + 14, top + 14, 14);
      drawStar(g, left + 14, top + 14, 10, true, GOLD_HEX, 1);
      c.add(g);
    }
    if (completesRecipe(items, defId)) {
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.7);
      g.fillCircle(right - 14, top + 14, 14);
      c.add([g, txt(this, right - 14, top + 14, '⚗', 18, '#9ad3f2', { fontStyle: 'bold' }).setOrigin(0.5)]);
    }
  }

  private gameOver(win: boolean) {
    this.phase = 'over';
    this.post = { label: 'Voir le bilan', go: () => this.route() };
    if (win) {
      this.slam('TOP 1 !', GOLD, GRID_Y + 160, 88);
      this.confetti();
      sfx('win', { pitch: 0.9 });
      this.time.delayedCall(500, () => sfx('craft'));
      vibrate([40, 40, 40, 40, 120]);
    } else {
      banner(this, 'ÉLIMINÉ', C.dangerStr, GRID_Y + 160);
      sfx('lose');
      this.cameras.main.shake(400, 0.01);
      vibrate([120, 60, 200]);
      this.time.delayedCall(1300, () => toast(this, 'Fin de la run', C.dangerStr, GRID_Y + 260));
    }
  }

  private confetti() {
    const cols = [0xe9c46a, 0xe8894a, 0x86a95a, 0x5fb3e0, 0xffffff];
    for (let i = 0; i < 70; i++) {
      const r = this.add.rectangle(Phaser.Math.Between(0, W), -20, 8, 14, cols[i % cols.length]).setDepth(220);
      this.tweens.add({
        targets: r, y: H + 40, x: r.x + Phaser.Math.Between(-120, 120), angle: Phaser.Math.Between(-720, 720),
        delay: Phaser.Math.Between(0, 900), duration: Phaser.Math.Between(1800, 3000), ease: 'Quad.In', onComplete: () => r.destroy(),
      });
    }
  }

  // ---------------------------------------------------------------- écrans dramatiques

  /** Écran plein du Goulag : « Dernière chance ». */
  private showGoulag() {
    const p = goulagParams(this.run);
    if (!p) return this.route();
    this.closeModal();
    const m = this.add.container(0, 0).setDepth(150);
    this.modal = m;
    this.updateButtons();
    const bg = this.add.rectangle(0, 0, W, H, 0x000000, 1).setOrigin(0).setInteractive().setAlpha(0);
    m.add(bg);
    this.tweens.add({ targets: bg, alpha: 0.96, duration: 250 });
    const g = this.add.graphics();
    g.fillStyle(0x6a2226, 0.5);
    g.fillCircle(W / 2, 560, 420);
    // Barbelés
    g.lineStyle(3, 0x6b6370, 1);
    for (const y of [300, 860]) {
      for (let x = 0; x < W; x += 24) {
        g.lineBetween(x, y, x + 12, y + 8);
        g.lineBetween(x + 12, y + 8, x + 24, y);
        g.lineBetween(x + 10, y - 6, x + 14, y + 14);
      }
    }
    m.add(g);
    const title = txt(this, W / 2, 470, 'GOULAG', 120, '#c94a4a', { fontStyle: 'bold italic', stroke: '#000000', strokeThickness: 14, padding: { x: 20, y: 10 } })
      .setOrigin(0.5).setScale(4).setAlpha(0);
    m.add(title);
    this.tweens.add({
      targets: title, scale: 1, alpha: 1, delay: 250, duration: 260, ease: 'Quad.In',
      onComplete: () => {
        this.cameras.main.shake(380, 0.014);
        this.cameras.main.flash(200, 255, 40, 30);
        vibrate([100, 50, 100]);
      },
    });
    const sub = txt(this, W / 2, 590, 'DERNIÈRE CHANCE', 44, C.text, { fontFamily: TITLE_FONT, stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5).setAlpha(0);
    m.add(sub);
    this.tweens.add({ targets: sub, alpha: 1, delay: 700, duration: 300 });
    const body = txt(this, W / 2, 680, 'Un duel 1v1 à PV pleins.\nGagne : tu reviens dans la partie.\nPerds : la run est finie.', 26, '#ece2cf', { align: 'center', lineSpacing: 8 })
      .setOrigin(0.5, 0).setAlpha(0);
    m.add(body);
    this.tweens.add({ targets: body, alpha: 1, delay: 950, duration: 300 });
    const b = button(this, 120, 940, 480, 100, 'Entrer au Goulag', () => {
      this.tweens.add({
        targets: m, alpha: 0, duration: 260, onComplete: () => {
          m.destroy();
          this.modal = null;
          this.setupDuel(p);
        },
      });
    }, { primary: true, size: 30 });
    b.root.setAlpha(0);
    m.add(b.root);
    this.tweens.add({ targets: b.root, alpha: 1, delay: 1200, duration: 300 });
  }

  /** Annonce du duel final : le dernier cercle se referme. */
  private announceFinal() {
    const p = finalDuelParams(this.run);
    saveRun(this.run);
    if (!p) return this.route();
    this.closeModal();
    const m = this.add.container(0, 0).setDepth(150);
    this.modal = m;
    this.updateButtons();
    const bg = this.add.rectangle(0, 0, W, H, 0x000000, 1).setOrigin(0).setInteractive().setAlpha(0);
    m.add(bg);
    this.tweens.add({ targets: bg, alpha: 0.97, duration: 250 });
    // Cercle de gaz qui se referme
    const ring = this.add.graphics().setPosition(W / 2, 560);
    ring.lineStyle(10, 0x8f6bb8, 0.9);
    ring.strokeCircle(0, 0, 200);
    ring.fillStyle(0x8f6bb8, 0.08);
    ring.fillCircle(0, 0, 200);
    ring.setScale(3);
    m.add(ring);
    this.tweens.add({ targets: ring, scale: 1, duration: 1100, ease: 'Cubic.Out' });
    this.tweens.add({ targets: ring, alpha: 0.5, yoyo: true, repeat: -1, duration: 700, delay: 1100 });
    const pre = txt(this, W / 2, 440, 'DERNIER CERCLE', 48, '#c3a6e0', { fontFamily: TITLE_FONT, stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5).setAlpha(0);
    m.add(pre);
    this.tweens.add({ targets: pre, alpha: 1, delay: 500, duration: 300 });
    const title = txt(this, W / 2, 560, 'TOP 1', 150, GOLD, { fontStyle: 'bold italic', stroke: '#000000', strokeThickness: 16, padding: { x: 24, y: 10 } })
      .setOrigin(0.5).setScale(4).setAlpha(0);
    m.add(title);
    this.tweens.add({
      targets: title, scale: 1, alpha: 1, delay: 900, duration: 260, ease: 'Quad.In',
      onComplete: () => {
        this.cameras.main.shake(400, 0.014);
        this.cameras.main.flash(220, 255, 220, 120);
        vibrate([80, 50, 140]);
      },
    });
    const body = txt(this, W / 2, 700, 'Un seul survivant.\nLe meilleur sac du serveur t\'attend.', 28, C.text, { align: 'center', lineSpacing: 8 }).setOrigin(0.5, 0).setAlpha(0);
    m.add(body);
    this.tweens.add({ targets: body, alpha: 1, delay: 1400, duration: 300 });
    const b = button(this, 120, 940, 480, 100, 'Affronter', () => {
      this.tweens.add({
        targets: m, alpha: 0, duration: 260, onComplete: () => {
          m.destroy();
          this.modal = null;
          this.mode = 'duel';
          this.setupDuel(p);
        },
      });
    }, { primary: true, size: 32 });
    b.root.setAlpha(0);
    m.add(b.root);
    this.tweens.add({ targets: b.root, alpha: 1, delay: 1700, duration: 300 });
  }
}
