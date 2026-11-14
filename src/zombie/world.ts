// Mode Zombie : simulation pure de la partie (sans Phaser). Le soldat, les zombies, les balles, l'XP,
// les soutiens. Tout est en réserves de taille fixe (aucune allocation par image) ; collisions par grille
// spatiale centrée sur le soldat. La scène lit l'état et les événements pour l'affichage et le son.
import {
  BLAST, ELITE, EVOLUTIONS, EvoId, MAX_ZOMBIES, PLAYER, POWERS, PowerId, RUN_TIME, SPIT, ZOMBIES, ZType, xpToNext,
} from './data';
import { Choice, applyChoice, drawChoices } from './powerups';
import { Levels, Loadout, Stats, computeStats } from './stats';
import { bossHp, dmgMul, hpMul, pickType, spawnRate, targetCount, waveEvents } from './waves';
import type { RunResult } from './progress';

export interface Zombie {
  id: number;
  active: boolean;
  type: ZType;
  elite: boolean;
  x: number;
  y: number;
  /** Vitesse de recul (décroît). */
  kx: number;
  ky: number;
  hp: number;
  maxHp: number;
  speed: number;
  dmg: number;
  r: number;
  mass: number;
  atkCd: number;
  burn: number;
  burnT: number;
  /** Éclat blanc après un coup (s). */
  hitT: number;
  spitCd: number;
  bladeCd: number;
  face: number;
  phase: number;
  /** Boss : préparation de charge, charge en cours, direction. */
  chargeCd: number;
  windT: number;
  chargeT: number;
  cdx: number;
  cdy: number;
  summonCd: number;
  tier: number;
}

export interface Bullet {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  dist: number;
  pierce: number;
  bounces: number;
  crit: boolean;
  last: number;
  /** 0 arme, 1 drone, 2 tourelle, 3 crachat ennemi. */
  src: number;
}

export interface Gem {
  active: boolean;
  x: number;
  y: number;
  v: number;
  pull: boolean;
  sp: number;
}

export type PickupKind = 'medkit' | 'caisse' | 'aimant' | 'frappe';
export interface Pickup {
  active: boolean;
  x: number;
  y: number;
  kind: PickupKind;
  t: number;
}

export interface Mine {
  active: boolean;
  x: number;
  y: number;
  arm: number;
}

/** Grenade en vol ou obus d'artillerie (marqueur au sol, puis explosion). */
export interface Shell {
  active: boolean;
  /** 0 grenade, 1 obus. */
  kind: number;
  sx: number;
  sy: number;
  x: number;
  y: number;
  t: number;
  dur: number;
  r: number;
  dmg: number;
}

export interface Fire {
  active: boolean;
  x: number;
  y: number;
  r: number;
  t: number;
  dps: number;
  tick: number;
}

export interface Turret {
  active: boolean;
  x: number;
  y: number;
  life: number;
  cd: number;
  ang: number;
  follow: number;
}

export type EvKind =
  | 'shot' | 'hit' | 'kill' | 'boom' | 'hurt' | 'gem' | 'pickup' | 'reload' | 'reloaded' | 'boss' | 'elite' | 'horde'
  | 'shock' | 'spit' | 'heal' | 'revive' | 'frappe' | 'levelup' | 'extract' | 'charge' | 'blade' | 'drone' | 'turret' | 'mine' | 'throw' | 'dead';

export interface Ev {
  k: EvKind;
  x: number;
  y: number;
  x2: number;
  y2: number;
  v: number;
  crit: boolean;
}

export const POOL = { bullets: 420, gems: 420, pickups: 24, mines: 16, shells: 40, fires: 14, turrets: 3, events: 640 };

const GRID_CELL = 64;
const GRID_N = 44; // 2816 px de côté, centrés sur le soldat
const SPAWN_R = 800;
const DESPAWN_R = 1350;

export class World {
  readonly zombies: Zombie[] = [];
  readonly bullets: Bullet[] = [];
  readonly gems: Gem[] = [];
  readonly pickups: Pickup[] = [];
  readonly mines: Mine[] = [];
  readonly shells: Shell[] = [];
  readonly fires: Fire[] = [];
  readonly turrets: Turret[] = [];
  readonly events: Ev[] = [];
  evCount = 0;

  // Soldat
  px = 0;
  py = 0;
  hp: number;
  face = 1;
  aim = 0;
  moving = false;
  ammo: number;
  reloadT = 0;
  fireCd = 0;
  invuln = 0;
  revived = false;
  /** Déplacement demandé (-1..1), écrit par la scène. */
  mx = 0;
  my = 0;

  time = 0;
  level = 1;
  xp = 0;
  pendingLevels = 0;
  /** Niveaux offerts par une caisse (même écran que le passage de niveau). */
  rerolls: number;
  kills: Partial<Record<ZType, number>> = {};
  elites = 0;
  killCount = 0;
  dead = false;
  extracted = false;
  endless = false;
  alive = 0;
  boss: Zombie | null = null;
  damageDealt = 0;

  readonly levels: Levels = {};
  readonly evos = new Set<EvoId>();
  stats: Stats;

  private nextId = 1;
  private spawnAcc = 0;
  private grenadeT = 2;
  private mineT = 1;
  private turretT = 3;
  private artyT = 4;
  private droneCd: number[] = [0, 0, 0, 0];
  private bladeAng = 0;
  private gemCursor = 0;
  // Grille spatiale : tête de liste par case, chaînage par zombie.
  private head = new Int32Array(GRID_N * GRID_N);
  private next = new Int32Array(MAX_ZOMBIES);
  private gx0 = 0;
  private gy0 = 0;
  private qbuf = new Int32Array(MAX_ZOMBIES);

  constructor(readonly loadout: Loadout, readonly rng: () => number) {
    for (let i = 0; i < MAX_ZOMBIES; i++) this.zombies.push(blankZombie());
    for (let i = 0; i < POOL.bullets; i++) this.bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, dmg: 0, dist: 0, pierce: 0, bounces: 0, crit: false, last: 0, src: 0 });
    for (let i = 0; i < POOL.gems; i++) this.gems.push({ active: false, x: 0, y: 0, v: 0, pull: false, sp: 0 });
    for (let i = 0; i < POOL.pickups; i++) this.pickups.push({ active: false, x: 0, y: 0, kind: 'medkit', t: 0 });
    for (let i = 0; i < POOL.mines; i++) this.mines.push({ active: false, x: 0, y: 0, arm: 0 });
    for (let i = 0; i < POOL.shells; i++) this.shells.push({ active: false, kind: 0, sx: 0, sy: 0, x: 0, y: 0, t: 0, dur: 0, r: 0, dmg: 0 });
    for (let i = 0; i < POOL.fires; i++) this.fires.push({ active: false, x: 0, y: 0, r: 0, t: 0, dps: 0, tick: 0 });
    for (let i = 0; i < POOL.turrets; i++) this.turrets.push({ active: false, x: 0, y: 0, life: 0, cd: 0, ang: 0, follow: 0 });
    for (let i = 0; i < POOL.events; i++) this.events.push({ k: 'hit', x: 0, y: 0, x2: 0, y2: 0, v: 0, crit: false });
    if (loadout.perk === 'sapeur') this.levels.grenades = 1;
    this.stats = computeStats(loadout, this.levels, this.evos);
    this.hp = this.stats.maxHp;
    this.ammo = this.stats.mag;
    this.rerolls = this.stats.rerolls;
  }

  /* -------------------------------------------------------------- */
  /* Boucle                                                          */
  /* -------------------------------------------------------------- */

  update(dt: number) {
    this.evCount = 0;
    if (this.dead) return;
    dt = Math.min(dt, 0.05);
    const t0 = this.time;
    this.time += dt;
    if (!this.endless && t0 < RUN_TIME && this.time >= RUN_TIME) {
      this.extracted = true;
      this.ev('extract', this.px, this.py);
    }
    for (const e of waveEvents(t0, this.time)) {
      if (e.kind === 'boss') this.spawnBoss(e.tier);
      else if (e.kind === 'elite') this.spawnElite();
      else this.spawnHorde(e.count, e.type);
    }
    this.spawn(dt);
    this.updatePlayer(dt);
    this.buildGrid();
    this.updateWeapon(dt);
    this.updateSupports(dt);
    this.updateZombies(dt);
    this.updateBullets(dt);
    this.updateGems(dt);
  }

  /** Choix proposés au prochain passage de niveau. */
  drawChoices(): Choice[] {
    return drawChoices(this.rng, this.levels, this.evos, this.stats.choices);
  }

  /** Applique un power-up choisi ; recalcule les stats. */
  choose(c: Choice) {
    if (this.pendingLevels > 0) this.pendingLevels--;
    if (c.kind === 'soin') {
      this.heal(this.stats.maxHp * 0.4);
      return;
    }
    const before = this.stats.maxHp;
    applyChoice(this.levels, this.evos, c);
    this.stats = computeStats(this.loadout, this.levels, this.evos);
    if (this.stats.maxHp > before) this.hp += this.stats.maxHp - before;
    this.ammo = Math.min(this.ammo, this.stats.mag);
    if (c.kind === 'power' && c.id === 'recharge') this.ammo = this.stats.mag;
  }

  result(): RunResult {
    return { weapon: this.loadout.weapon, time: Math.floor(this.time), level: this.level, kills: { ...this.kills }, elites: this.elites, won: this.time >= RUN_TIME };
  }

  powerLevel(p: PowerId) {
    return this.levels[p] ?? 0;
  }

  /* -------------------------------------------------------------- */
  /* Événements                                                      */
  /* -------------------------------------------------------------- */

  private ev(k: EvKind, x: number, y: number, v = 0, x2 = 0, y2 = 0, crit = false) {
    if (this.evCount >= POOL.events) return;
    const e = this.events[this.evCount++];
    e.k = k;
    e.x = x;
    e.y = y;
    e.v = v;
    e.x2 = x2;
    e.y2 = y2;
    e.crit = crit;
  }

  /* -------------------------------------------------------------- */
  /* Apparitions                                                     */
  /* -------------------------------------------------------------- */

  private freeZombie(): Zombie | null {
    for (const z of this.zombies) if (!z.active) return z;
    return null;
  }

  private spawnAt(type: ZType, x: number, y: number, elite = false): Zombie | null {
    const z = this.freeZombie();
    if (!z) return null;
    const d = ZOMBIES[type];
    const hm = type === 'boss' ? 1 : hpMul(this.time);
    z.id = this.nextId++;
    z.active = true;
    z.type = type;
    z.elite = elite;
    z.x = x;
    z.y = y;
    z.kx = 0;
    z.ky = 0;
    z.maxHp = z.hp = Math.round(d.hp * hm * (elite ? ELITE.hp : 1));
    z.speed = d.speed * (0.9 + this.rng() * 0.2) * (elite ? 0.9 : 1);
    z.dmg = d.dmg * dmgMul(this.time) * (elite ? ELITE.dmg : 1);
    z.r = d.r * (elite ? ELITE.r : 1);
    z.mass = d.mass * (elite ? 3 : 1);
    z.atkCd = 0;
    z.burn = 0;
    z.burnT = 0;
    z.hitT = 0;
    z.spitCd = SPIT.cooldown * (0.5 + this.rng());
    z.bladeCd = 0;
    z.face = x < this.px ? 1 : -1;
    z.phase = this.rng() * Math.PI * 2;
    z.chargeCd = 5;
    z.windT = 0;
    z.chargeT = 0;
    z.summonCd = 8;
    z.tier = 0;
    this.alive++;
    return z;
  }

  private ringPoint(spread = Math.PI * 2, center = this.rng() * Math.PI * 2, r = SPAWN_R): [number, number] {
    const a = center + (this.rng() - 0.5) * spread;
    const rr = r + this.rng() * 80;
    return [this.px + Math.cos(a) * rr, this.py + Math.sin(a) * rr];
  }

  private spawn(dt: number) {
    const target = targetCount(this.time) + (this.endless ? Math.min(60, (this.time - RUN_TIME) / 6) : 0);
    if (this.alive >= Math.min(MAX_ZOMBIES, target)) {
      this.spawnAcc = 0;
      return;
    }
    this.spawnAcc += spawnRate(this.time) * dt * (this.alive < target * 0.5 ? 2 : 1);
    while (this.spawnAcc >= 1) {
      this.spawnAcc--;
      // Un peu plus d'apparitions devant le soldat quand il bouge (on ne fuit pas les zombies indéfiniment).
      const ahead = this.moving && this.rng() < 0.5;
      const [x, y] = ahead ? this.ringPoint(Math.PI, Math.atan2(this.my, this.mx)) : this.ringPoint();
      this.spawnAt(pickType(this.time, this.rng()), x, y);
    }
  }

  private spawnElite() {
    const types: ZType[] = this.time > 270 ? ['marcheur', 'coureur', 'brute', 'cracheur'] : ['marcheur', 'coureur'];
    const [x, y] = this.ringPoint();
    if (this.spawnAt(types[Math.floor(this.rng() * types.length)], x, y, true)) this.ev('elite', x, y);
  }

  private spawnHorde(count: number, type: ZType) {
    this.ev('horde', this.px, this.py, count);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.spawnAt(type, this.px + Math.cos(a) * (SPAWN_R - 40), this.py + Math.sin(a) * (SPAWN_R - 40));
    }
  }

  private spawnBoss(tier: number) {
    // Place garantie : au besoin, on recycle le zombie normal le plus éloigné.
    if (!this.freeZombie()) {
      let far: Zombie | null = null;
      let fd = -1;
      for (const z of this.zombies) {
        if (!z.active || z.type === 'boss' || z.elite) continue;
        const d = (z.x - this.px) ** 2 + (z.y - this.py) ** 2;
        if (d > fd) [fd, far] = [d, z];
      }
      if (far) {
        far.active = false;
        this.alive--;
      }
    }
    const [x, y] = this.ringPoint(0.6, -Math.PI / 2, SPAWN_R - 150);
    const z = this.spawnAt('boss', x, y);
    if (!z) return;
    z.maxHp = z.hp = bossHp(tier);
    z.dmg = ZOMBIES.boss.dmg * (1 + 0.25 * (tier - 1));
    z.speed = ZOMBIES.boss.speed + 4 * tier;
    z.tier = tier;
    this.boss = z;
    this.ev('boss', x, y, tier);
  }

  /* -------------------------------------------------------------- */
  /* Soldat et arme                                                  */
  /* -------------------------------------------------------------- */

  private updatePlayer(dt: number) {
    const s = this.stats;
    let mx = this.mx;
    let my = this.my;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    this.moving = len > 0.08;
    if (this.moving) {
      this.px += mx * s.move * dt;
      this.py += my * s.move * dt;
      if (Math.abs(mx) > 0.15) this.face = mx > 0 ? 1 : -1;
    }
    if (this.invuln > 0) this.invuln -= dt;
    if (s.regen > 0 && this.hp < s.maxHp) this.hp = Math.min(s.maxHp, this.hp + s.regen * dt);
  }

  heal(n: number) {
    const before = this.hp;
    this.hp = Math.min(this.stats.maxHp, this.hp + n);
    if (this.hp > before) this.ev('heal', this.px, this.py, Math.round(this.hp - before));
  }

  private hurt(dmg: number, x: number, y: number) {
    if (this.invuln > 0 || this.dead) return;
    const d = dmg * this.stats.taken;
    this.hp -= d;
    this.invuln = PLAYER.invuln;
    this.ev('hurt', this.px, this.py, Math.round(d), x, y);
    if (this.hp <= 0) {
      if (this.evos.has('seconde_vie') && !this.revived) {
        this.revived = true;
        this.hp = this.stats.maxHp * 0.6;
        this.invuln = 2;
        this.ev('revive', this.px, this.py);
        this.explode(this.px, this.py, 260, 400, false);
        return;
      }
      this.hp = 0;
      this.dead = true;
      this.ev('dead', this.px, this.py);
    }
  }

  /** Zombie le plus proche dans un rayon (null sinon). */
  nearest(x: number, y: number, range: number, exclude = -1): Zombie | null {
    let best: Zombie | null = null;
    let bd = range * range;
    for (const z of this.zombies) {
      if (!z.active || z.id === exclude) continue;
      const d = (z.x - x) ** 2 + (z.y - y) ** 2 - z.r * z.r;
      if (d < bd) {
        bd = d;
        best = z;
      }
    }
    return best;
  }

  private updateWeapon(dt: number) {
    const s = this.stats;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.ammo = s.mag;
        this.ev('reloaded', this.px, this.py);
      }
      return;
    }
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.fireCd > 0) return;
    const target = this.nearest(this.px, this.py, s.range);
    if (!target) return;
    const a = Math.atan2(target.y - this.py, target.x - this.px);
    this.aim = a;
    this.face = Math.cos(a) >= 0 ? 1 : -1;
    this.fireCd += 1 / s.rate;
    if (this.fireCd < 0) this.fireCd = 0;
    const n = s.pellets;
    const shotgun = this.loadout.weapon === 'pompe';
    for (let i = 0; i < n; i++) {
      // Plombs : éventail régulier + bruit ; tir multiple d'une arme à balle : petit éventail.
      const fan = shotgun ? (n > 1 ? (i / (n - 1) - 0.5) * 2 * s.spread : 0) : n > 1 ? (i - (n - 1) / 2) * 0.14 : 0;
      const ang = a + fan + (this.rng() * 2 - 1) * (shotgun ? s.spread * 0.25 : s.spread);
      const crit = this.rng() < s.crit;
      this.fire(this.px + Math.cos(a) * 26, this.py - 22 + Math.sin(a) * 26, ang, s.bulletSpeed, s.dmg * (crit ? s.critMul : 1), s.range * 1.15, s.pierce, s.bounces, 0, crit);
    }
    this.ev('shot', this.px, this.py, a);
    this.ammo--;
    if (this.ammo <= 0) {
      this.reloadT = s.reload;
      this.ev('reload', this.px, this.py, s.reload);
    }
  }

  private fire(x: number, y: number, a: number, speed: number, dmg: number, dist: number, pierce: number, bounces: number, src: number, crit = false) {
    for (const b of this.bullets) {
      if (b.active) continue;
      b.active = true;
      b.x = x;
      b.y = y;
      b.vx = Math.cos(a) * speed;
      b.vy = Math.sin(a) * speed;
      b.dmg = dmg;
      b.dist = dist;
      b.pierce = pierce;
      b.bounces = bounces;
      b.crit = crit;
      b.last = -1;
      b.src = src;
      return b;
    }
    return null;
  }

  /* -------------------------------------------------------------- */
  /* Soutiens                                                        */
  /* -------------------------------------------------------------- */

  /** Position du drone i (orbite autour du soldat). */
  dronePos(i: number, n: number): [number, number] {
    const a = this.time * 1.6 + (i / n) * Math.PI * 2;
    return [this.px + Math.cos(a) * 70, this.py - 40 + Math.sin(a) * 34];
  }

  droneCount(): number {
    const L = this.stats.drone;
    if (!L) return 0;
    return this.evos.has('escadrille') ? 4 : 1 + (L >= 3 ? 1 : 0) + (L >= 5 ? 1 : 0);
  }

  bladeCount(): number {
    const L = this.stats.lames;
    return !L ? 0 : this.evos.has('tourbillon') ? 8 : L;
  }

  bladeRadius(): number {
    return this.evos.has('tourbillon') ? 125 : 95;
  }

  bladePos(i: number, n: number): [number, number] {
    const a = this.bladeAng + (i / n) * Math.PI * 2;
    const r = this.bladeRadius();
    return [this.px + Math.cos(a) * r, this.py - 20 + Math.sin(a) * r * 0.8];
  }

  private updateSupports(dt: number) {
    const s = this.stats;
    // Grenades
    if (s.grenades) {
      this.grenadeT -= dt;
      if (this.grenadeT <= 0) {
        const bomb = this.evos.has('bombardement');
        this.grenadeT = bomb ? 2 : s.grenadeCd;
        const n = bomb ? 6 : 1 + Math.floor((s.grenades - 1) / 2);
        for (let i = 0; i < n; i++) {
          const t = this.randomZombieNear(380);
          const [tx, ty] = t ? [t.x, t.y] : [this.px + (this.rng() - 0.5) * 400, this.py + (this.rng() - 0.5) * 400];
          this.launch(0, tx + (this.rng() - 0.5) * 40, ty + (this.rng() - 0.5) * 40, 0.55 + i * 0.05,
            (70 + 8 * s.grenades) * s.blastR * (bomb ? 1.3 : 1), (28 + 14 * s.grenades) * s.allDmg * s.blastDmg);
        }
        this.ev('throw', this.px, this.py, n);
      }
    }
    // Drones
    const nd = this.droneCount();
    for (let i = 0; i < nd; i++) {
      this.droneCd[i] -= dt;
      if (this.droneCd[i] > 0) continue;
      const [dx, dy] = this.dronePos(i, nd);
      const t = this.nearest(dx, dy, 420);
      if (!t) continue;
      const esc = this.evos.has('escadrille');
      this.droneCd[i] = (1.0 - 0.1 * s.drone) / (esc ? 2 : 1);
      const a = Math.atan2(t.y - dy, t.x - dx);
      this.fire(dx, dy, a, 900, (6 + 4 * s.drone) * s.allDmg, 460, esc ? 2 : 0, 0, 1);
      this.ev('drone', dx, dy, a);
    }
    // Mines
    if (s.mines) {
      this.mineT -= dt;
      if (this.mineT <= 0) {
        this.mineT = 3.5 - 0.3 * (s.mines - 1);
        const m = this.mines.find((m) => !m.active) ?? this.mines[0];
        m.active = true;
        m.x = this.px;
        m.y = this.py;
        m.arm = 0.6;
        this.ev('mine', m.x, m.y);
      }
      for (const m of this.mines) {
        if (!m.active) continue;
        if (m.arm > 0) {
          m.arm -= dt;
          continue;
        }
        const z = this.nearest(m.x, m.y, 34);
        if (z) {
          m.active = false;
          const r = (80 + 8 * s.mines) * s.blastR;
          this.explode(m.x, m.y, r, (40 + 20 * s.mines) * s.allDmg * s.blastDmg);
          if (this.evos.has('napalm')) this.addFire(m.x, m.y, 90, 30 * s.allDmg, 4);
        }
      }
    }
    // Machettes
    const nb = this.bladeCount();
    if (nb) {
      const tb = this.evos.has('tourbillon');
      this.bladeAng += dt * (tb ? 4 : 3.2);
      const dmg = (14 + 6 * s.lames) * s.allDmg * (tb ? 2 : 1);
      const hr = tb ? 32 : 24;
      for (let i = 0; i < nb; i++) {
        const [bx, by] = this.bladePos(i, nb);
        const n = this.query(bx, by, hr + 50);
        for (let k = 0; k < n; k++) {
          const z = this.zombies[this.qbuf[k]];
          if (!z.active || z.bladeCd > 0) continue;
          const rr = hr + z.r;
          if ((z.x - bx) ** 2 + (z.y - 10 - by) ** 2 > rr * rr) continue;
          z.bladeCd = 0.35;
          const a = Math.atan2(z.y - this.py, z.x - this.px);
          this.ev('blade', z.x, z.y - 10);
          this.damage(z, dmg, false, Math.cos(a), Math.sin(a), tb ? 30 : 8);
        }
      }
    }
    // Tourelles
    if (s.tourelle) {
      const fort = this.evos.has('forteresse');
      if (fort) {
        for (let i = 0; i < 2; i++) {
          const t = this.turrets[i];
          if (!t.active) {
            t.active = true;
            t.life = Infinity;
            t.cd = 0;
            t.follow = i === 0 ? -1 : 1;
          }
          t.x += (this.px + t.follow * 70 - t.x) * Math.min(1, dt * 4);
          t.y += (this.py + 30 - t.y) * Math.min(1, dt * 4);
        }
      } else {
        this.turretT -= dt;
        if (this.turretT <= 0) {
          this.turretT = 14;
          const t = this.turrets[0];
          t.active = true;
          t.x = this.px;
          t.y = this.py + 10;
          t.life = 8 + s.tourelle;
          t.cd = 0.3;
          t.follow = 0;
          this.ev('turret', t.x, t.y);
        }
      }
      for (const t of this.turrets) {
        if (!t.active) continue;
        t.life -= dt;
        if (t.life <= 0) {
          t.active = false;
          continue;
        }
        t.cd -= dt;
        if (t.cd > 0) continue;
        const z = this.nearest(t.x, t.y - 20, 400);
        if (!z) continue;
        t.cd = 1 / (4 + s.tourelle);
        t.ang = Math.atan2(z.y - (t.y - 20), z.x - t.x);
        this.fire(t.x + Math.cos(t.ang) * 20, t.y - 20 + Math.sin(t.ang) * 20, t.ang + (this.rng() - 0.5) * 0.08, 1000, (5 + 2.5 * s.tourelle) * s.allDmg, 440, 0, 0, 2);
      }
    }
    // Artillerie
    if (s.artillerie) {
      this.artyT -= dt;
      if (this.artyT <= 0) {
        this.artyT = this.evos.has('forteresse') ? 4 : 9 - 0.8 * (s.artillerie - 1);
        const n = 2 + s.artillerie;
        for (let i = 0; i < n; i++) {
          const z = this.randomZombieNear(520);
          const [x, y] = z ? [z.x, z.y] : [this.px + (this.rng() - 0.5) * 700, this.py + (this.rng() - 0.5) * 900];
          this.launch(1, x, y, 0.9 + i * 0.12, 85 * s.blastR, (50 + 25 * s.artillerie) * s.allDmg * s.blastDmg);
        }
      }
    }
    // Grenades en vol, obus
    for (const sh of this.shells) {
      if (!sh.active) continue;
      sh.t += dt;
      if (sh.t >= sh.dur) {
        sh.active = false;
        this.explode(sh.x, sh.y, sh.r, sh.dmg);
      }
    }
    // Mares de feu
    for (const f of this.fires) {
      if (!f.active) continue;
      f.t -= dt;
      f.tick -= dt;
      if (f.t <= 0) {
        f.active = false;
        continue;
      }
      if (f.tick <= 0) {
        f.tick = 0.25;
        const n = this.query(f.x, f.y, f.r + 40);
        for (let k = 0; k < n; k++) {
          const z = this.zombies[this.qbuf[k]];
          if (z.active && (z.x - f.x) ** 2 + (z.y - f.y) ** 2 < (f.r + z.r) ** 2) this.damage(z, f.dps * 0.25, false, 0, 0, 0, true);
        }
      }
    }
  }

  private launch(kind: number, x: number, y: number, dur: number, r: number, dmg: number) {
    const sh = this.shells.find((s) => !s.active);
    if (!sh) return;
    sh.active = true;
    sh.kind = kind;
    sh.sx = this.px;
    sh.sy = this.py - 30;
    sh.x = x;
    sh.y = y;
    sh.t = 0;
    sh.dur = dur;
    sh.r = r;
    sh.dmg = dmg;
  }

  private addFire(x: number, y: number, r: number, dps: number, t: number) {
    const f = this.fires.find((f) => !f.active) ?? this.fires[0];
    f.active = true;
    f.x = x;
    f.y = y;
    f.r = r;
    f.dps = dps;
    f.t = t;
    f.tick = 0;
  }

  private randomZombieNear(range: number): Zombie | null {
    // Quelques essais au hasard, sinon le plus proche.
    for (let k = 0; k < 8; k++) {
      const z = this.zombies[Math.floor(this.rng() * MAX_ZOMBIES)];
      if (z.active && (z.x - this.px) ** 2 + (z.y - this.py) ** 2 < range * range) return z;
    }
    return this.nearest(this.px, this.py, range);
  }

  /** Explosion : dégâts dans un rayon (les gonflés touchent aussi le soldat). */
  explode(x: number, y: number, r: number, dmg: number, hurtsPlayer = false) {
    this.ev('boom', x, y, r);
    if (hurtsPlayer && (this.px - x) ** 2 + (this.py - 20 - y) ** 2 < r * r) this.hurt(dmg, x, y);
    const n = this.query(x, y, r + 50);
    for (let k = 0; k < n; k++) {
      const z = this.zombies[this.qbuf[k]];
      if (!z.active) continue;
      const d = Math.hypot(z.x - x, z.y - y);
      if (d > r + z.r) continue;
      this.damage(z, hurtsPlayer ? dmg * 0.5 : dmg, false, (z.x - x) / (d || 1), (z.y - y) / (d || 1), hurtsPlayer ? 10 : 18);
    }
  }

  /* -------------------------------------------------------------- */
  /* Zombies                                                         */
  /* -------------------------------------------------------------- */

  private buildGrid() {
    this.head.fill(-1);
    this.gx0 = this.px - (GRID_N * GRID_CELL) / 2;
    this.gy0 = this.py - (GRID_N * GRID_CELL) / 2;
    for (let i = 0; i < MAX_ZOMBIES; i++) {
      const z = this.zombies[i];
      if (!z.active) continue;
      const c = this.cellOf(z.x, z.y);
      this.next[i] = this.head[c];
      this.head[c] = i;
    }
  }

  private cellOf(x: number, y: number): number {
    const cx = Math.max(0, Math.min(GRID_N - 1, Math.floor((x - this.gx0) / GRID_CELL)));
    const cy = Math.max(0, Math.min(GRID_N - 1, Math.floor((y - this.gy0) / GRID_CELL)));
    return cy * GRID_N + cx;
  }

  /** Remplit qbuf avec les zombies des cases couvrant le carré (x ± r, y ± r) ; renvoie leur nombre. */
  private query(x: number, y: number, r: number): number {
    const c0x = Math.max(0, Math.floor((x - r - this.gx0) / GRID_CELL));
    const c1x = Math.min(GRID_N - 1, Math.floor((x + r - this.gx0) / GRID_CELL));
    const c0y = Math.max(0, Math.floor((y - r - this.gy0) / GRID_CELL));
    const c1y = Math.min(GRID_N - 1, Math.floor((y + r - this.gy0) / GRID_CELL));
    let n = 0;
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        for (let i = this.head[cy * GRID_N + cx]; i !== -1; i = this.next[i]) this.qbuf[n++] = i;
      }
    }
    return n;
  }

  private updateZombies(dt: number) {
    const px = this.px;
    const py = this.py;
    for (let i = 0; i < MAX_ZOMBIES; i++) {
      const z = this.zombies[i];
      if (!z.active) continue;
      if (z.hitT > 0) z.hitT -= dt;
      if (z.atkCd > 0) z.atkCd -= dt;
      if (z.bladeCd > 0) z.bladeCd -= dt;
      // Brûlure
      if (z.burnT > 0) {
        z.burnT -= dt;
        this.damage(z, z.burn * dt, false, 0, 0, 0, true);
        if (!z.active) continue;
      }
      let dx = px - z.x;
      let dy = py - z.y;
      const d2 = dx * dx + dy * dy;
      // Trop loin : on le replace devant le soldat (les zombies ne se perdent pas).
      if (d2 > DESPAWN_R * DESPAWN_R && z.type !== 'boss') {
        const [x, y] = this.ringPoint(Math.PI * 0.8, Math.atan2(this.my || -dy, this.mx || -dx));
        z.x = x;
        z.y = y;
        continue;
      }
      const d = Math.sqrt(d2) || 1;
      dx /= d;
      dy /= d;
      let sp = z.speed;
      // Comportements particuliers
      if (z.type === 'cracheur') {
        if (d < 220) sp = -z.speed * 0.6;
        else if (d < SPIT.range) sp = 0;
        z.spitCd -= dt;
        if (z.spitCd <= 0 && d < SPIT.range + 40) {
          z.spitCd = SPIT.cooldown;
          const b = this.fire(z.x, z.y - 30, Math.atan2(py - 20 - (z.y - 30), px - z.x), SPIT.speed, SPIT.dmg * dmgMul(this.time) * (z.elite ? ELITE.dmg : 1), SPIT.range + 200, 0, 0, 3);
          if (b) this.ev('spit', z.x, z.y - 30);
        }
      } else if (z.type === 'kamikaze' && d < BLAST.trigger + z.r) {
        this.kill(z, true);
        continue;
      } else if (z.type === 'boss') {
        this.updateBoss(z, dt, dx, dy);
        sp = z.chargeT > 0 ? 430 : z.windT > 0 ? 0 : z.speed;
        if (z.chargeT > 0) {
          dx = z.cdx;
          dy = z.cdy;
        }
      }
      z.x += (dx * sp + z.kx) * dt;
      z.y += (dy * sp + z.ky) * dt;
      const damp = Math.max(0, 1 - dt * 10);
      z.kx *= damp;
      z.ky *= damp;
      if (Math.abs(dx) > 0.2) z.face = dx > 0 ? 1 : -1;
      // Séparation : on repousse les voisins qui se chevauchent (plus fort pour les petits).
      const n = this.query(z.x, z.y, z.r + 30);
      for (let k = 0; k < n; k++) {
        const j = this.qbuf[k];
        if (j === i) continue;
        const o = this.zombies[j];
        if (!o.active) continue;
        const ox = z.x - o.x;
        const oy = z.y - o.y;
        const rr = (z.r + o.r) * 0.85;
        const od2 = ox * ox + oy * oy;
        if (od2 >= rr * rr || od2 === 0) continue;
        const od = Math.sqrt(od2);
        const push = ((rr - od) / od) * 0.5;
        const wz = o.mass / (z.mass + o.mass);
        z.x += ox * push * wz;
        z.y += oy * push * wz;
      }
      // Contact
      const cr = z.r + PLAYER.r;
      if (d < cr) {
        if (z.dmg > 0 && z.atkCd <= 0) {
          z.atkCd = 0.8;
          this.hurt(z.dmg, z.x, z.y);
        }
        // Ne traverse pas le soldat
        z.x = px - dx * cr;
        z.y = py - dy * cr;
      }
    }
  }

  private updateBoss(z: Zombie, dt: number, dx: number, dy: number) {
    if (z.chargeT > 0) {
      z.chargeT -= dt;
      return;
    }
    if (z.windT > 0) {
      z.windT -= dt;
      if (z.windT <= 0) {
        z.chargeT = 0.9;
        z.cdx = dx;
        z.cdy = dy;
      }
      return;
    }
    z.chargeCd -= dt;
    if (z.chargeCd <= 0) {
      z.chargeCd = 6 - Math.min(2, z.tier * 0.5);
      z.windT = 0.8;
      this.ev('charge', z.x, z.y);
    }
    z.summonCd -= dt;
    if (z.summonCd <= 0) {
      z.summonCd = 10;
      for (let k = 0; k < 4 + 2 * z.tier; k++) {
        const a = (k / (4 + 2 * z.tier)) * Math.PI * 2;
        this.spawnAt(z.tier >= 2 ? 'coureur' : 'marcheur', z.x + Math.cos(a) * 90, z.y + Math.sin(a) * 90);
      }
    }
  }

  /** Inflige des dégâts (recul selon la direction (nx, ny) et la masse). */
  damage(z: Zombie, dmg: number, crit: boolean, nx: number, ny: number, knock: number, dot = false) {
    if (!z.active) return;
    z.hp -= dmg;
    this.damageDealt += dmg;
    if (!dot) {
      z.hitT = 0.08;
      if (knock) {
        const k = (knock * 14) / z.mass;
        z.kx += nx * k;
        z.ky += ny * k;
      }
      this.ev('hit', z.x, z.y - z.r, Math.round(dmg), 0, 0, crit);
    }
    if (z.hp <= 0) this.kill(z, false);
  }

  private kill(z: Zombie, blastFromContact: boolean) {
    if (!z.active) return;
    z.active = false;
    this.alive--;
    this.kills[z.type] = (this.kills[z.type] ?? 0) + 1;
    this.killCount++;
    if (z.elite) this.elites++;
    if (z === this.boss) this.boss = null;
    this.ev('kill', z.x, z.y, z.r, z.elite ? 1 : 0, 0, z.type === 'boss');
    const d = ZOMBIES[z.type];
    this.dropGem(z.x, z.y, d.xp * (z.elite ? ELITE.xp : 1));
    if (z.type === 'boss') {
      for (let k = 0; k < 6; k++) this.dropGem(z.x + (this.rng() - 0.5) * 120, z.y + (this.rng() - 0.5) * 120, 10 * z.tier);
      this.dropPickup(z.x - 30, z.y, 'caisse');
      this.dropPickup(z.x + 30, z.y, 'medkit');
    } else if (z.elite) this.dropPickup(z.x, z.y, 'caisse');
    else {
      const r = this.rng();
      if (r < 0.006) this.dropPickup(z.x, z.y, 'medkit');
      else if (r < 0.0085) this.dropPickup(z.x, z.y, 'aimant');
      else if (r < 0.0097) this.dropPickup(z.x, z.y, 'frappe');
    }
    if (z.type === 'kamikaze') this.explode(z.x, z.y - 10, BLAST.radius, BLAST.dmg * dmgMul(this.time), true);
    void blastFromContact;
  }

  /* -------------------------------------------------------------- */
  /* Balles                                                          */
  /* -------------------------------------------------------------- */

  private updateBullets(dt: number) {
    const s = this.stats;
    for (const b of this.bullets) {
      if (!b.active) continue;
      const step = Math.hypot(b.vx, b.vy) * dt;
      const sub = Math.max(1, Math.ceil(step / 14));
      const sdt = dt / sub;
      for (let k = 0; k < sub && b.active; k++) {
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;
        b.dist -= step / sub;
        if (b.dist <= 0) {
          b.active = false;
          break;
        }
        if (b.src === 3) {
          // Crachat : touche le soldat
          if ((b.x - this.px) ** 2 + (b.y - (this.py - 20)) ** 2 < (PLAYER.r + 8) ** 2) {
            b.active = false;
            this.hurt(b.dmg, b.x, b.y);
          }
          continue;
        }
        const n = this.query(b.x, b.y + 20, 64);
        for (let q = 0; q < n; q++) {
          const z = this.zombies[this.qbuf[q]];
          if (!z.active || z.id === b.last) continue;
          // Le corps du zombie est centré un peu au-dessus de ses pieds.
          const cy = z.y - z.r;
          const rr = z.r + 5;
          if ((z.x - b.x) ** 2 + (cy - b.y) ** 2 > rr * rr) continue;
          this.bulletHit(b, z, s);
          break;
        }
      }
    }
  }

  private bulletHit(b: Bullet, z: Zombie, s: Stats) {
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const nx = b.vx / sp;
    const ny = b.vy / sp;
    const fromGun = b.src === 0;
    b.last = z.id;
    const zx = z.x;
    const zy = z.y - z.r;
    if (fromGun && s.burn > 0) {
      z.burn = Math.max(z.burn, b.dmg * s.burn);
      z.burnT = 3;
    }
    this.damage(z, b.dmg, b.crit, nx, ny, fromGun ? s.knock : 2);
    if (fromGun && s.explode > 0) this.explode(zx, zy, s.explodeR * s.blastR, b.dmg * s.explode * s.blastDmg);
    if (fromGun && s.shockChance > 0 && this.rng() < s.shockChance) this.shock(zx, zy, z.id, b.dmg * 0.6, s.shockN);
    if (b.pierce > 0) {
      b.pierce--;
      b.dmg *= 0.85;
      return;
    }
    if (b.bounces > 0) {
      const t = this.nearest(zx, zy, 320, z.id);
      if (t) {
        b.bounces--;
        const a = Math.atan2(t.y - t.r - zy, t.x - zx);
        b.vx = Math.cos(a) * sp;
        b.vy = Math.sin(a) * sp;
        b.x = zx;
        b.y = zy;
        b.dist = Math.max(b.dist, 360);
        return;
      }
    }
    b.active = false;
  }

  private shock(x: number, y: number, from: number, dmg: number, count: number) {
    let lx = x;
    let ly = y;
    let last = from;
    for (let k = 0; k < count; k++) {
      const t = this.nearest(lx, ly, 170, last);
      if (!t) break;
      this.ev('shock', lx, ly, 0, t.x, t.y - t.r);
      lx = t.x;
      ly = t.y - t.r;
      last = t.id;
      this.damage(t, dmg, false, 0, 0, 0);
    }
  }

  /* -------------------------------------------------------------- */
  /* XP et objets                                                    */
  /* -------------------------------------------------------------- */

  private dropGem(x: number, y: number, v: number) {
    for (let k = 0; k < POOL.gems; k++) {
      const g = this.gems[(this.gemCursor + k) % POOL.gems];
      if (g.active) continue;
      this.gemCursor = (this.gemCursor + k + 1) % POOL.gems;
      g.active = true;
      g.x = x;
      g.y = y;
      g.v = v;
      g.pull = false;
      g.sp = 0;
      return;
    }
    // Réserve pleine : l'XP s'ajoute à une gemme existante (fusion).
    const g = this.gems[this.gemCursor];
    g.v += v;
    this.gemCursor = (this.gemCursor + 1) % POOL.gems;
  }

  private dropPickup(x: number, y: number, kind: PickupKind) {
    const p = this.pickups.find((p) => !p.active);
    if (!p) return;
    p.active = true;
    p.x = x;
    p.y = y;
    p.kind = kind;
    p.t = 0;
  }

  private updateGems(dt: number) {
    const pr = this.stats.pickup;
    const px = this.px;
    const py = this.py - 16;
    for (const g of this.gems) {
      if (!g.active) continue;
      const dx = px - g.x;
      const dy = py - g.y;
      const d2 = dx * dx + dy * dy;
      if (!g.pull && d2 < pr * pr) g.pull = true;
      if (!g.pull) {
        // Gemmes oubliées très loin : on les libère.
        if (d2 > 2400 * 2400) g.active = false;
        continue;
      }
      g.sp = Math.min(1100, g.sp + 1600 * dt);
      const d = Math.sqrt(d2) || 1;
      if (d < 22) {
        g.active = false;
        this.gainXp(g.v);
        this.ev('gem', g.x, g.y, g.v);
        continue;
      }
      g.x += (dx / d) * g.sp * dt;
      g.y += (dy / d) * g.sp * dt;
    }
    for (const p of this.pickups) {
      if (!p.active) continue;
      p.t += dt;
      if ((p.x - px) ** 2 + (p.y - py) ** 2 > 46 * 46) continue;
      p.active = false;
      this.ev('pickup', p.x, p.y, 0, 0, 0);
      this.collect(p.kind, p.x, p.y);
    }
  }

  private collect(kind: PickupKind, x: number, y: number) {
    if (kind === 'medkit') this.heal(30 * this.stats.healMul);
    else if (kind === 'caisse') {
      this.pendingLevels++;
      this.ev('levelup', x, y, 1);
    } else if (kind === 'aimant') {
      for (const g of this.gems) if (g.active) g.pull = true;
    } else if (kind === 'frappe') {
      this.ev('frappe', this.px, this.py);
      for (const z of this.zombies) {
        if (!z.active) continue;
        if ((z.x - this.px) ** 2 + (z.y - this.py) ** 2 > 900 * 900) continue;
        this.damage(z, z.type === 'boss' ? z.maxHp * 0.1 : 99999, false, 0, 0, 0);
      }
    }
  }

  gainXp(v: number) {
    this.xp += v;
    while (this.xp >= xpToNext(this.level)) {
      this.xp -= xpToNext(this.level);
      this.level++;
      this.pendingLevels++;
      this.ev('levelup', this.px, this.py, 0);
    }
  }
}

function blankZombie(): Zombie {
  return {
    id: 0, active: false, type: 'marcheur', elite: false, x: 0, y: 0, kx: 0, ky: 0, hp: 0, maxHp: 0, speed: 0, dmg: 0, r: 0, mass: 1,
    atkCd: 0, burn: 0, burnT: 0, hitT: 0, spitCd: 0, bladeCd: 0, face: 1, phase: 0, chargeCd: 0, windT: 0, chargeT: 0, cdx: 0, cdy: 0, summonCd: 0, tier: 0,
  };
}

/** Description courte d'un choix pour l'interface. */
export function choiceInfo(c: Choice, levels: Levels): { name: string; icon: string; desc: string; level: number; max: number; evo: boolean } {
  if (c.kind === 'soin') return { name: 'Ration', icon: 'it-ration', desc: 'Soigne 40 % des PV max.', level: 0, max: 0, evo: false };
  if (c.kind === 'evo') {
    const e = EVOLUTIONS[c.id];
    return { name: e.name, icon: e.icon, desc: e.desc, level: 0, max: 0, evo: true };
  }
  const p = POWERS[c.id];
  const lvl = (levels[c.id] ?? 0) + 1;
  return { name: p.name, icon: p.icon, desc: p.desc(lvl), level: lvl, max: p.max, evo: false };
}
