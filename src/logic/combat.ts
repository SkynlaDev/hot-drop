// Duel 1v1 sac contre sac : simulation symétrique et déterministe (même graine = même duel).
import { hashParts, mulberry32 } from './rng';
import { MELEE_ONLY_SPEED, THROW_COST } from './stats';
import type { MeleeRt, PlayerLoadout, WeaponRt } from './stats';

/** 'a' = le joueur, 'b' = le bot. */
export type Side = 'a' | 'b';

/**
 * Événements du duel, dans l'ordre chronologique.
 * - shot : un impact de `from` sur l'adversaire. Un tir à plombs (pellets 2) ou une balle doublée
 *   (Rafale palier 4) produit plusieurs événements au même `t` ; les impacts en plus ont `double: true`.
 *   hp/armor = ceux de la cible après l'impact.
 *   `heat` (Feu continu de Viper) : bonus de cadence de l'arme au moment du tir (0,18 = +18 %), absent si nul.
 *   `mark` (Marque de Sentinelle) : ce critique marque l'adversaire.
 *   `marked` : cette touche consomme la marque (dégâts majorés, déjà comptés dans `amount`).
 *   `melee` : coup d'arme de mêlée, sans balle ; `bleed` : saignement ajouté à la cible.
 *   `absorbed` (shot, taser, frag) : part de `amount` prise par l'armure de la cible, absent si nulle.
 * - reload : `side` recharge l'arme `uid` (sans fin : un chargeur adjacent accélère la recharge).
 * - bleed : `side` perd `amount` PV de saignement (cumulés sur une demi-seconde), hp = après.
 * - taser : `side` immobilise l'adversaire jusqu'à `until` et lui inflige `amount` ; hp/armor = ceux de l'adversaire.
 * - bandage : `side` retire `cured` de saignement et soigne `amount`.
 * - frag : grenade lancée par `side`, hp/armor = ceux de l'adversaire après l'explosion.
 * - smoke : `side` se couvre, la précision adverse est divisée par 2 jusqu'à `until`.
 * - flash : `side` étourdit les armes adverses jusqu'à `until`.
 * - adrenaline / heal : sur `side` lui-même.
 * - death : `side` est mort.
 * Combat v2 :
 * - shot/frag/flash/taser : `burn` / `shock` = cumuls posés, `burnStacks` / `shockStacks` = cumuls de la cible après ;
 *   shot : `end` = Endurance du tireur après le tir.
 * - burn : `side` perd `amount` PV de Brûlure (ignore l'armure), `stacks` = cumuls restants.
 * - discharge : décharge du Choc sur `side`, déclenchée par l'objet `uid` du camp adverse.
 * - tired : l'arme `uid` de `side` attend, faute d'Endurance (`end` = Endurance restante).
 * Objets légendaires :
 * - shot `blocked` : la touche est bloquée (Bouclier anti-émeute de la cible), amount 0.
 * - revive : `side` revient à `hp` PV (Médaille de l'ange gardien `uid`).
 * - frag d'un Détonateur de recharge (uid du détonateur) ; heal du vol de vie (uid de la Poche de sang).
 */
export type DuelEvent =
  | { t: number; kind: 'shot'; from: Side; uid: number; amount: number; crit: boolean; miss: boolean; pierce: boolean; double?: boolean; heat?: number; mark?: boolean; marked?: boolean; melee?: 'lame'; bleed?: number; absorbed?: number; blocked?: boolean; hp: number; armor: number } & StatusFields & { end?: number }
  | { t: number; kind: 'reload'; side: Side; uid: number }
  | { t: number; kind: 'bleed'; side: Side; amount: number; hp: number }
  | ({ t: number; kind: 'taser'; side: Side; uid: number; amount: number; until: number; absorbed?: number; hp: number; armor: number } & StatusFields)
  | { t: number; kind: 'bandage'; side: Side; uid: number; amount: number; cured: number; hp: number }
  | ({ t: number; kind: 'frag'; side: Side; uid: number; amount: number; absorbed?: number; hp: number; armor: number } & StatusFields)
  | { t: number; kind: 'smoke'; side: Side; uid: number; until: number }
  | ({ t: number; kind: 'flash'; side: Side; uid: number; until: number } & StatusFields)
  | { t: number; kind: 'adrenaline'; side: Side; uid: number; until: number }
  | { t: number; kind: 'heal'; side: Side; uid: number; amount: number; hp: number }
  | { t: number; kind: 'death'; side: Side }
  | { t: number; kind: 'burn'; side: Side; amount: number; hp: number; stacks: number }
  | { t: number; kind: 'discharge'; side: Side; uid: number; amount?: number; hp?: number }
  | { t: number; kind: 'tired'; side: Side; uid: number; end: number }
  | { t: number; kind: 'revive'; side: Side; uid: number; hp: number };

/** Statuts posés par un coup (absents si nuls). */
export interface StatusFields {
  burn?: number;
  shock?: number;
  burnStacks?: number;
  shockStacks?: number;
  /** Dégâts de la décharge déclenchée par ce coup (Bobine Tesla), déjà retirés des PV de la cible. */
  discharged?: number;
}

export interface DuelResult {
  events: DuelEvent[];
  /** Vrai si `a` (le joueur) gagne. */
  win: boolean;
  /** Vrai si le duel s'est fini au temps limite (vainqueur à la part de PV restante). */
  timeout: boolean;
  duration: number;
  hpEndA: number;
  hpEndB: number;
}

/** Temps limite : au-delà, le camp qui a la plus grande part de ses PV max gagne. */
export const MAX_TIME = 90;
const DT = 0.05;
/** Précision de base de chaque camp (divisée par 2 sous le fumigène adverse). */
export const ACCURACY = 0.85;
/** Part maximale des dégâts d'une balle que la réduction par balle (armure lourde) peut retirer. */
export const MAX_FLAT_REDUCE = 0.25;
/** Saignement : part de la réserve versée par seconde, et minimum par seconde. */
export const BLEED_RATE = 0.35;
export const BLEED_MIN = 2;
/** Le taser se déclenche quand l'adversaire recharge, ou au plus tard à ce moment du duel. */
export const TASER_FALLBACK = 6;
/** Seuil de saignement qui déclenche le bandage. */
export const BANDAGE_BLEED = 8;
/** Brûlure : plafond de cumuls, dégâts par cumul et par tick (0,5 s), un cumul s'éteint toutes les BURN_DECAY s. */
export const BURN_MAX = 12;
export const BURN_TICK = 0.5;
export const BURN_PER_STACK = 0.5;
export const BURN_DECAY = 3;
/** Décharge du Choc : retard des armes adverses (s), Endurance retirée. */
export const DISCHARGE_STUN = 0.6;
export const DISCHARGE_END = 3;
/** Une arme à court d'Endurance réessaie après ce délai (s). */
export const TIRED_WAIT = 0.1;

interface Fighter {
  side: Side;
  l: PlayerLoadout;
  hp: number;
  armor: number;
  /**
   * `fireStart` : début de la salve en cours (depuis la dernière recharge), pour le Feu continu.
   * `reloadUntil` : fin de la recharge en cours (le taser adverse s'en sert).
   */
  ws: { w: WeaponRt; ammo: number; next: number; shots: number; fireStart: number; reloadUntil: number; tired: boolean }[];
  ml: { m: MeleeRt; next: number }[];
  /** Réserve de saignement, et saignement versé pas encore annoncé (événement toutes les 0,5 s). */
  bleed: number;
  bleedAcc: number;
  bleedNext: number;
  as: { a: PlayerLoadout['actives'][number]; charges: number; next: number }[];
  smokeUntil: number;
  adrenalineUntil: number;
  adrenalineBoost: number;
  dealt: number;
  /** Marque posée sur ce combattant : uid de l'arme adverse qui l'a posée, -1 = aucune. */
  markedBy: number;
  /** Endurance (Infinity sans limite), Brûlure (cumuls, prochain tick, prochaine extinction), Choc (cumuls). */
  end: number;
  burn: number;
  burnNext: number;
  burnDecay: number;
  shock: number;
  /** Légendaires : touches encore bloquées, résurrection utilisée, vol de vie pas encore rendu, touches d'arme à feu. */
  blocks: number;
  revived: boolean;
  steal: number;
  gunHits: number;
  /** Réaction en chaîne (Sapeur) : explosions déjà déclenchées (plafonné). */
  chain: number;
}

/** Applique des dégâts : l'armure absorbe d'abord, sauf la part qui la perce. Renvoie l'absorbé. */
function applyDamage(b: Fighter, amount: number, pierce = 0): number {
  const toArmor = Math.min(b.armor, amount * (1 - pierce));
  b.armor -= toArmor;
  b.hp = Math.max(0, b.hp - (amount - toArmor));
  return toArmor;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const absField = (abs: number) => (abs > 0.05 ? { absorbed: round1(abs) } : {});

/**
 * Duel 1v1. `opts.hpA` : PV de départ du joueur (PV gardés entre les duels d'une escouade).
 * Pas d'égalité : au temps limite, la plus grande part de PV gagne, puis les dégâts infligés, puis la graine.
 */
export function simulateDuel(a: PlayerLoadout, b: PlayerLoadout, seed: number, opts: { hpA?: number } = {}): DuelResult {
  const rng = mulberry32(hashParts('duel', seed));
  const make = (side: Side, l: PlayerLoadout, hp: number): Fighter => ({
    side,
    l,
    hp,
    armor: l.armor,
    // Léger décalage aléatoire du 1er tir pour que deux sacs identiques ne tirent pas en miroir parfait.
    ws: l.weapons.map((w) => ({ w, ammo: w.mag, next: w.interval * (0.4 + 0.2 * rng()), shots: 0, fireStart: -1, reloadUntil: -1, tired: false })),
    ml: l.melee.map((m) => ({ m, next: m.interval * (0.5 + 0.2 * rng()) })),
    bleed: 0,
    bleedAcc: 0,
    bleedNext: 0.5,
    as: l.actives.map((ac) => ({ a: ac, charges: ac.charges, next: ac.kind === 'heal' || ac.kind === 'adrenaline' || ac.kind === 'bandage' ? 0 : ac.cooldown * 0.4 })),
    smokeUntil: -1,
    adrenalineUntil: -1,
    adrenalineBoost: 0,
    dealt: 0,
    markedBy: -1,
    end: l.endMax ?? Infinity,
    burn: 0,
    burnNext: 0,
    burnDecay: 0,
    shock: 0,
    blocks: l.block?.value ?? 0,
    revived: false,
    steal: 0,
    gunHits: 0,
    chain: 0,
  });
  const hpA = Math.max(1, Math.min(a.maxHp, Math.round(opts.hpA ?? a.maxHp)));
  const A = make('a', a, hpA);
  const B = make('b', b, b.maxHp);
  const events: DuelEvent[] = [];
  const finish = (win: boolean, t: number, timeout = false): DuelResult => ({
    events, win, timeout, duration: t, hpEndA: Math.round(A.hp), hpEndB: Math.round(B.hp),
  });

  /** `f` est-il mort ? La Médaille de l'ange gardien le relève une fois par duel. Pousse l'événement. */
  const dies = (f: Fighter, t: number): boolean => {
    if (f.hp > 0) return false;
    if (f.l.revive && !f.revived) {
      f.revived = true;
      f.hp = Math.round(f.l.maxHp * f.l.revive.value);
      f.bleed = 0;
      f.burn = 0;
      events.push({ t, kind: 'revive', side: f.side, uid: f.l.revive.uid, hp: f.hp });
      return false;
    }
    events.push({ t, kind: 'death', side: f.side });
    return true;
  };

  /** Bouclier anti-émeute : bloque la touche si `foe` en a encore. */
  const blocked = (foe: Fighter): boolean => {
    if (foe.blocks <= 0) return false;
    foe.blocks--;
    return true;
  };

  /** Vol de vie (Poche de sang) : rend une part des dégâts, annoncé par paquets d'au moins 3 PV. */
  const leech = (me: Fighter, amount: number, t: number) => {
    const ls = me.l.lifesteal;
    if (!ls || me.hp <= 0) return;
    me.steal += amount * ls.value;
    if (me.steal < 3) return;
    const heal = Math.min(Math.floor(me.steal), Math.round(me.l.maxHp - me.hp));
    me.steal -= Math.floor(me.steal);
    if (heal <= 0) return;
    me.hp += heal;
    events.push({ t, kind: 'heal', side: me.side, uid: ls.uid, amount: heal, hp: round1(me.hp) });
  };

  /** Réaction en chaîne (Sapeur) : dégâts d'une explosion de `me`, puis un cumul de plus. */
  const blast = (me: Fighter, value: number): number => {
    const c = me.l.chain;
    if (!c) return Math.round(value);
    const out = Math.round(value * (1 + c.dmg * me.chain));
    me.chain = Math.min(c.max, me.chain + 1);
    return out;
  };

  /** Étourdit `f` : ses armes et sa mêlée frappent `d` secondes plus tard. */
  const stun = (f: Fighter, t: number, d: number) => {
    for (const fw of f.ws) fw.next = Math.max(fw.next, t) + d;
    for (const fm of f.ml) fm.next = Math.max(fm.next, t) + d;
  };

  /** Coup de mêlée : toujours au but, pas de critique. Renvoie le camp mort, s'il y en a un. */
  const strike = (me: Fighter, foe: Fighter, t: number, uid: number, dmg: number, pierce: number, bleed: number): Side | null => {
    if (blocked(foe)) {
      events.push({ t, kind: 'shot', from: me.side, uid, amount: 0, crit: false, miss: false, pierce: false, melee: 'lame', blocked: true, hp: round1(foe.hp), armor: round1(foe.armor) });
      return null;
    }
    const amount = Math.max(1, Math.round(dmg - Math.min(foe.l.flatReduce, dmg * MAX_FLAT_REDUCE)));
    const abs = applyDamage(foe, amount, pierce);
    me.dealt += amount;
    if (bleed > 0) foe.bleed += bleed;
    leech(me, amount, t);
    events.push({
      t, kind: 'shot', from: me.side, uid, amount, crit: false, miss: false, pierce: pierce > 0, melee: 'lame',
      ...(bleed > 0 ? { bleed } : {}), ...absField(abs), hp: round1(foe.hp), armor: round1(foe.armor),
    });
    if (dies(foe, t)) return foe.side;
    return null;
  };

  /**
   * Pose des statuts sur `foe` (coup de l'objet `uid` de `me`). Renvoie les champs à mettre dans l'événement,
   * et `discharge` si le Choc atteint le seuil (la décharge est appliquée ici, son événement est à pousser après).
   */
  const applyStatus = (me: Fighter, foe: Fighter, t: number, burn = 0, shock = 0): { f: StatusFields; discharge: boolean } => {
    const f: StatusFields = {};
    let discharge = false;
    if (burn > 0) {
      if (foe.burn === 0) {
        foe.burnNext = t + BURN_TICK;
        foe.burnDecay = t + BURN_DECAY;
      }
      foe.burn = Math.min(BURN_MAX, foe.burn + burn);
      f.burn = burn;
      f.burnStacks = foe.burn;
    }
    if (shock > 0) {
      foe.shock += shock;
      f.shock = shock;
      if (foe.shock >= (foe.l.shockThreshold ?? 5)) {
        discharge = true;
        foe.shock = 0;
        if (!foe.l.shockImmune) {
          stun(foe, t, DISCHARGE_STUN);
          for (const fw of foe.ws) fw.fireStart = -1; // le Feu continu retombe
          foe.end = Math.max(0, foe.end - DISCHARGE_END);
        }
        // Bobine Tesla : la décharge frappe aussi, sans passer par l'armure.
        if (me.l.dischargeDmg) {
          foe.hp = Math.max(0, foe.hp - me.l.dischargeDmg);
          me.dealt += me.l.dischargeDmg;
          f.discharged = me.l.dischargeDmg;
        }
      }
      f.shockStacks = foe.shock;
    }
    return { f, discharge };
  };

  /** Tour d'un camp à l'instant t. Renvoie le camp mort, s'il y en a un. */
  const act = (me: Fighter, foe: Fighter, t: number): Side | null => {
    if (me.l.armorRegen > 0 && me.armor < me.l.armor) me.armor = Math.min(me.l.armor, me.armor + me.l.armorRegen * DT);
    if (me.l.endMax !== undefined) me.end = Math.min(me.l.endMax, me.end + (me.l.endRegen ?? 1) * DT);
    // Brûlure : un tick toutes les BURN_TICK s, qui ignore l'armure ; un cumul s'éteint toutes les BURN_DECAY s.
    if (me.burn > 0) {
      if (t >= me.burnNext) {
        const d = BURN_PER_STACK * me.burn * (1 - (me.l.burnResist ?? 0));
        me.hp = Math.max(0, me.hp - d);
        foe.dealt += d;
        me.burnNext = t + BURN_TICK;
        events.push({ t, kind: 'burn', side: me.side, amount: round1(d), hp: round1(me.hp), stacks: me.burn });
        if (dies(me, t)) return me.side;
      }
      if (t >= me.burnDecay) {
        me.burn -= 1;
        me.burnDecay = t + BURN_DECAY;
      }
    }
    // Saignement : la réserve se vide peu à peu, sans passer par l'armure.
    if (me.bleed > 0) {
      const d = Math.min(me.bleed, Math.max(BLEED_MIN, me.bleed * BLEED_RATE) * DT);
      me.bleed -= d;
      me.hp = Math.max(0, me.hp - d);
      me.bleedAcc += d;
      foe.dealt += d;
      if (me.hp <= 0 || t >= me.bleedNext || me.bleed <= 0) {
        if (me.bleedAcc >= 0.5 || me.hp <= 0) events.push({ t, kind: 'bleed', side: me.side, amount: Math.round(me.bleedAcc), hp: round1(me.hp) });
        me.bleedAcc = 0;
        me.bleedNext = t + 0.5;
      }
      if (dies(me, t)) return me.side;
    }
    const cadence = t < me.adrenalineUntil ? 1 / (1 + me.adrenalineBoost) : 1;

    // Armes
    for (const s of me.ws) {
      if (t < s.next) continue;
      if (s.ammo <= 0) {
        s.ammo = s.w.mag;
        s.next = t + s.w.reload;
        s.reloadUntil = s.next;
        if (!s.w.heatKeep) s.fireStart = -1; // la recharge éteint le Feu continu (sauf KR-4 Mitrailleur)
        events.push({ t, kind: 'reload', side: me.side, uid: s.w.uid });
        // Détonateur de recharge : un éclat part à chaque recharge.
        const rb = me.l.reloadBlast;
        if (rb) {
          if (blocked(foe)) {
            events.push({ t, kind: 'shot', from: me.side, uid: rb.uid, amount: 0, crit: false, miss: false, pierce: false, blocked: true, hp: round1(foe.hp), armor: round1(foe.armor) });
          } else {
            const dmg = blast(me, rb.value);
            const abs = applyDamage(foe, dmg, 0.5);
            me.dealt += dmg;
            events.push({ t, kind: 'frag', side: me.side, uid: rb.uid, amount: dmg, ...absField(abs), hp: round1(foe.hp), armor: round1(foe.armor) });
            if (dies(foe, t)) return foe.side;
          }
        }
        continue;
      }
      // Endurance : le tir coûte au moment où il part ; sans assez d'Endurance, l'arme attend.
      // Le Feu continu (Viper) accélère sans coûter plus : le coût d'un tir baisse avec la cadence gagnée.
      const heatNow = s.w.heatCap > 0 && s.fireStart >= 0 ? Math.min(s.w.heatCap, s.w.heatRate * (t - s.fireStart)) : 0;
      const cost = me.l.endMax === undefined || t < me.adrenalineUntil ? 0 : (s.w.endCost ?? 0) / (1 + heatNow);
      if (cost > me.end) {
        s.next = t + TIRED_WAIT;
        if (!s.tired) {
          s.tired = true;
          events.push({ t, kind: 'tired', side: me.side, uid: s.w.uid, end: round1(me.end) });
        }
        continue;
      }
      me.end -= cost;
      s.tired = false;
      const shotNo = s.shots + 1;
      const doubled = s.w.doubleEvery > 0 && shotNo % s.w.doubleEvery === 0;
      const hits = s.w.pellets * (doubled ? 2 : 1);
      const acc = ACCURACY * (t < foe.smokeUntil ? 0.5 : 1);
      // Feu continu : la cadence monte tant que l'arme tire sans recharger.
      if (s.fireStart < 0) s.fireStart = t;
      const heat = s.w.heatCap > 0 ? Math.min(s.w.heatCap, s.w.heatRate * (t - s.fireStart)) : 0;
      const heatField = heat > 0 ? { heat: Math.round(heat * 100) / 100 } : {};
      for (let n = 0; n < hits; n++) {
        const miss = rng() > acc;
        const crit = !miss && ((s.w.firstCrit && s.shots === 0 && n === 0) || rng() < s.w.crit);
        let amount = 0;
        if (!miss && blocked(foe)) {
          events.push({
            t, kind: 'shot', from: me.side, uid: s.w.uid, amount: 0, crit: false, miss: false, pierce: false, blocked: true,
            ...(n > 0 ? { double: true } : {}), ...heatField, hp: round1(foe.hp), armor: round1(foe.armor),
          });
        } else if (!miss) {
          // Marque : la touche d'une AUTRE arme la consomme.
          // Les drones tirent seuls : ils ne posent ni ne consomment la Marque.
          const marked = me.l.markBonus > 0 && !s.w.drone && foe.markedBy >= 0 && foe.markedBy !== s.w.uid;
          if (marked) foe.markedBy = -1;
          // Une marque n'a de sens qu'avec une 2e arme pour la consommer.
          const mark = crit && me.l.markBonus > 0 && !s.w.drone && me.ws.length > 1 && foe.markedBy < 0;
          if (mark) foe.markedBy = s.w.uid;
          // Le bonus de Marque s'ajoute au multiplicateur (critique marqué ×2 → ×2,5), il ne le multiplie pas.
          const raw = s.w.dmg * ((crit ? me.l.critMult : 1) + (marked ? me.l.markBonus + s.w.markBoost : 0));
          amount = Math.max(1, Math.round(raw - Math.min(foe.l.flatReduce, raw * MAX_FLAT_REDUCE)));
          const abs = applyDamage(foe, amount, s.w.armorPierce);
          if (s.w.trueDmg > 0) {
            foe.hp = Math.max(0, foe.hp - Math.round(s.w.trueDmg));
            amount += Math.round(s.w.trueDmg);
          }
          me.dealt += amount;
          if (crit && s.w.critStun > 0) for (const fw of foe.ws) fw.next = Math.max(fw.next, t) + s.w.critStun;
          // Légendaires : Brûlure des critiques (Lunette thermique), Choc toutes les N touches (Condensateur).
          me.gunHits++;
          const extraBurn = crit ? me.l.critBurn ?? 0 : 0;
          const extraShock = me.l.shockEvery && me.gunHits % me.l.shockEvery.value === 0 ? 5 : 0;
          const st = applyStatus(me, foe, t, (s.w.burn ?? 0) + extraBurn, (s.w.shock ?? 0) + extraShock);
          events.push({
            t, kind: 'shot', from: me.side, uid: s.w.uid, amount, crit, miss: false,
            pierce: s.w.armorPierce > 0, ...(n > 0 ? { double: true } : {}), ...heatField,
            ...(mark ? { mark: true } : {}), ...(marked ? { marked: true } : {}), ...absField(abs), ...st.f,
            ...(me.end !== Infinity ? { end: round1(me.end) } : {}),
            hp: round1(foe.hp), armor: round1(foe.armor),
          });
          if (st.discharge) events.push({ t, kind: 'discharge', side: foe.side, uid: s.w.uid, ...(st.f.discharged ? { amount: st.f.discharged, hp: round1(foe.hp) } : {}) });
          leech(me, amount, t);
          if (dies(foe, t)) return foe.side;
        } else {
          events.push({
            t, kind: 'shot', from: me.side, uid: s.w.uid, amount: 0, crit: false, miss: true, pierce: false,
            ...(n > 0 ? { double: true } : {}), ...heatField, hp: round1(foe.hp), armor: round1(foe.armor),
          });
        }
      }
      s.shots++;
      s.ammo--;
      s.next = t + (s.w.interval * cadence) / (1 + heat);
    }

    // Mêlée : frappe tout le duel, plus vite dans un sac sans arme à feu (build Lame).
    const bladeOnly = me.ws.length === 0;
    for (const s of me.ml) {
      if (t < s.next) continue;
      const mCost = me.l.endMax === undefined || t < me.adrenalineUntil ? 0 : s.m.endCost ?? 0;
      if (mCost > me.end) {
        s.next = t + TIRED_WAIT;
        continue;
      }
      me.end -= mCost;
      const dead = strike(me, foe, t, s.m.uid, s.m.dmg, s.m.armorPierce, s.m.bleed);
      s.next = t + (s.m.interval * cadence) / (bladeOnly ? MELEE_ONLY_SPEED : 1);
      if (dead) return dead;
    }

    // Objets actifs
    for (const s of me.as) {
      if (s.charges <= 0 || t < s.next) continue;
      const ac = s.a;
      // Lancer une grenade coûte de l'Endurance (pas les soins, le taser ni l'adrénaline).
      const thrown = (ac.kind === 'frag' || ac.kind === 'flash' || ac.kind === 'smoke') && !ac.strike;
      const aCost = thrown && me.l.endMax !== undefined && t >= me.adrenalineUntil ? THROW_COST : 0;
      if (aCost > me.end) {
        s.next = t + TIRED_WAIT;
        continue;
      }
      me.end -= aCost;
      if (ac.kind === 'taser') {
        // Quand l'adversaire recharge (ou au plus tard à TASER_FALLBACK) : dégâts et immobilisation.
        if (!foe.ws.some((w) => w.reloadUntil > t) && t < TASER_FALLBACK) continue;
        const amount = Math.round(ac.value);
        const abs = applyDamage(foe, amount);
        me.dealt += amount;
        stun(foe, t, ac.duration);
        const st = applyStatus(me, foe, t, ac.burn, ac.shock);
        events.push({ t, kind: 'taser', side: me.side, uid: ac.uid, amount, until: t + ac.duration, ...absField(abs), ...st.f, hp: round1(foe.hp), armor: round1(foe.armor) });
        if (st.discharge) events.push({ t, kind: 'discharge', side: foe.side, uid: ac.uid, ...(st.f.discharged ? { amount: st.f.discharged, hp: round1(foe.hp) } : {}) });
        s.charges--;
        s.next = t + ac.cooldown;
        if (dies(foe, t)) return foe.side;
        continue;
      }
      if (ac.kind === 'bandage') {
        if (me.bleed < BANDAGE_BLEED && me.hp / me.l.maxHp >= ac.threshold) continue;
        const cured = Math.round(Math.min(me.bleed, ac.cure));
        me.bleed = Math.max(0, me.bleed - ac.cure);
        const amount = Math.min(Math.round(ac.value), Math.round(me.l.maxHp - me.hp));
        me.hp += amount;
        events.push({ t, kind: 'bandage', side: me.side, uid: ac.uid, amount, cured, hp: round1(me.hp) });
        s.charges--;
        s.next = t + ac.cooldown;
        continue;
      }
      if (ac.kind === 'frag' && blocked(foe)) {
        events.push({ t, kind: 'shot', from: me.side, uid: ac.uid, amount: 0, crit: false, miss: false, pierce: false, blocked: true, hp: round1(foe.hp), armor: round1(foe.armor) });
      } else if (ac.kind === 'frag') {
        const amount = blast(me, ac.value);
        const abs = applyDamage(foe, amount, ac.ignoreArmor ? 1 : 0);
        me.dealt += amount;
        const st = applyStatus(me, foe, t, ac.burn, ac.shock);
        events.push({ t, kind: 'frag', side: me.side, uid: ac.uid, amount, ...absField(abs), ...st.f, hp: round1(foe.hp), armor: round1(foe.armor) });
        if (st.discharge) events.push({ t, kind: 'discharge', side: foe.side, uid: ac.uid, ...(st.f.discharged ? { amount: st.f.discharged, hp: round1(foe.hp) } : {}) });
        if (dies(foe, t)) return foe.side;
      } else if (ac.kind === 'smoke') {
        me.smokeUntil = t + ac.duration;
        events.push({ t, kind: 'smoke', side: me.side, uid: ac.uid, until: me.smokeUntil });
      } else if (ac.kind === 'flash') {
        stun(foe, t, ac.value);
        if (ac.heatReset) for (const fw of foe.ws) fw.fireStart = -1;
        const st = applyStatus(me, foe, t, ac.burn, ac.shock);
        events.push({ t, kind: 'flash', side: me.side, uid: ac.uid, until: t + ac.value, ...st.f });
        if (st.discharge) events.push({ t, kind: 'discharge', side: foe.side, uid: ac.uid, ...(st.f.discharged ? { amount: st.f.discharged, hp: round1(foe.hp) } : {}) });
        if (dies(foe, t)) return foe.side;
      } else if (ac.kind === 'adrenaline') {
        if (me.hp / me.l.maxHp >= ac.threshold) continue;
        me.adrenalineUntil = t + ac.duration;
        me.adrenalineBoost = ac.value;
        events.push({ t, kind: 'adrenaline', side: me.side, uid: ac.uid, until: me.adrenalineUntil });
      } else {
        if (me.hp / me.l.maxHp >= ac.threshold) continue;
        const amount = Math.min(Math.round(ac.value), Math.round(me.l.maxHp - me.hp));
        me.hp += amount;
        if (ac.cleanse && s.charges === ac.charges) {
          me.burn = 0;
          me.shock = 0;
          me.bleed = 0;
        }
        events.push({ t, kind: 'heal', side: me.side, uid: ac.uid, amount, hp: round1(me.hp) });
      }
      s.charges--;
      // Réaction en chaîne (Sapeur) : les explosifs reviennent plus vite à chaque explosion déjà déclenchée.
      const quick = me.l.chain && (ac.kind === 'frag' || ac.kind === 'flash' || ac.kind === 'smoke') ? 1 + me.l.chain.cd * me.chain : 1;
      s.next = t + ac.cooldown / quick;
    }
    return null;
  };

  for (let step = 1; step * DT <= MAX_TIME + 1e-9; step++) {
    const t = Math.round(step * DT * 1000) / 1000;
    // Ordre tiré au sort à chaque pas : aucun camp n'a l'avantage de tirer en premier.
    const [first, second] = rng() < 0.5 ? [A, B] : [B, A];
    const dead = act(first, second, t) ?? act(second, first, t);
    if (dead) return finish(dead === 'b', t);
  }

  // Temps limite : part de PV restante, puis dégâts infligés, puis pile ou face.
  const fa = A.hp / a.maxHp;
  const fb = B.hp / b.maxHp;
  const win = fa !== fb ? fa > fb : A.dealt !== B.dealt ? A.dealt > B.dealt : rng() < 0.5;
  return finish(win, MAX_TIME, true);
}
