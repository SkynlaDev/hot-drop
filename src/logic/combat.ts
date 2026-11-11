// Duel 1v1 sac contre sac : simulation symétrique et déterministe (même graine = même duel).
import { hashParts, mulberry32 } from './rng';
import type { PlayerLoadout, WeaponRt } from './stats';

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
 * - frag : grenade lancée par `side`, hp/armor = ceux de l'adversaire après l'explosion.
 * - smoke : `side` se couvre, la précision adverse est divisée par 2 jusqu'à `until`.
 * - flash : `side` étourdit les armes adverses jusqu'à `until`.
 * - adrenaline / heal : sur `side` lui-même.
 * - death : `side` est mort.
 */
export type DuelEvent =
  | { t: number; kind: 'shot'; from: Side; uid: number; amount: number; crit: boolean; miss: boolean; pierce: boolean; double?: boolean; heat?: number; mark?: boolean; marked?: boolean; hp: number; armor: number }
  | { t: number; kind: 'reload'; side: Side; uid: number }
  | { t: number; kind: 'frag'; side: Side; uid: number; amount: number; hp: number; armor: number }
  | { t: number; kind: 'smoke'; side: Side; uid: number; until: number }
  | { t: number; kind: 'flash'; side: Side; uid: number; until: number }
  | { t: number; kind: 'adrenaline'; side: Side; uid: number; until: number }
  | { t: number; kind: 'heal'; side: Side; uid: number; amount: number; hp: number }
  | { t: number; kind: 'death'; side: Side };

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
export const MAX_TIME = 40;
const DT = 0.05;
/** Précision de base de chaque camp (divisée par 2 sous le fumigène adverse). */
export const ACCURACY = 0.85;
/** Part maximale des dégâts d'une balle que la réduction par balle (armure lourde) peut retirer. */
export const MAX_FLAT_REDUCE = 0.25;

interface Fighter {
  side: Side;
  l: PlayerLoadout;
  hp: number;
  armor: number;
  /** `fireStart` : début de la salve en cours (depuis la dernière recharge), pour le Feu continu. */
  ws: { w: WeaponRt; ammo: number; next: number; shots: number; fireStart: number }[];
  as: { a: PlayerLoadout['actives'][number]; charges: number; next: number }[];
  smokeUntil: number;
  adrenalineUntil: number;
  adrenalineBoost: number;
  dealt: number;
  /** Marque posée sur ce combattant : uid de l'arme adverse qui l'a posée, -1 = aucune. */
  markedBy: number;
}

/** Applique des dégâts : l'armure absorbe d'abord, sauf la part qui la perce. Renvoie l'absorbé. */
function applyDamage(b: Fighter, amount: number, pierce = 0): number {
  const toArmor = Math.min(b.armor, amount * (1 - pierce));
  b.armor -= toArmor;
  b.hp = Math.max(0, b.hp - (amount - toArmor));
  return toArmor;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

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
    ws: l.weapons.map((w) => ({ w, ammo: w.mag, next: w.interval * (0.4 + 0.2 * rng()), shots: 0, fireStart: -1 })),
    as: l.actives.map((ac) => ({ a: ac, charges: ac.charges, next: ac.kind === 'heal' || ac.kind === 'adrenaline' ? 0 : ac.cooldown * 0.4 })),
    smokeUntil: -1,
    adrenalineUntil: -1,
    adrenalineBoost: 0,
    dealt: 0,
    markedBy: -1,
  });
  const hpA = Math.max(1, Math.min(a.maxHp, Math.round(opts.hpA ?? a.maxHp)));
  const A = make('a', a, hpA);
  const B = make('b', b, b.maxHp);
  const events: DuelEvent[] = [];
  const finish = (win: boolean, t: number, timeout = false): DuelResult => ({
    events, win, timeout, duration: t, hpEndA: Math.round(A.hp), hpEndB: Math.round(B.hp),
  });

  /** Tour d'un camp à l'instant t. Renvoie le camp mort, s'il y en a un. */
  const act = (me: Fighter, foe: Fighter, t: number): Side | null => {
    if (me.l.armorRegen > 0 && me.armor < me.l.armor) me.armor = Math.min(me.l.armor, me.armor + me.l.armorRegen * DT);
    const cadence = t < me.adrenalineUntil ? 1 / (1 + me.adrenalineBoost) : 1;

    // Armes
    for (const s of me.ws) {
      if (t < s.next) continue;
      if (s.ammo <= 0) {
        s.ammo = s.w.mag;
        s.next = t + s.w.reload;
        s.fireStart = -1; // la recharge éteint le Feu continu
        events.push({ t, kind: 'reload', side: me.side, uid: s.w.uid });
        continue;
      }
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
        if (!miss) {
          // Marque : la touche d'une AUTRE arme la consomme.
          const marked = me.l.markBonus > 0 && foe.markedBy >= 0 && foe.markedBy !== s.w.uid;
          if (marked) foe.markedBy = -1;
          // Une marque n'a de sens qu'avec une 2e arme pour la consommer.
          const mark = crit && me.l.markBonus > 0 && me.ws.length > 1 && foe.markedBy < 0;
          if (mark) foe.markedBy = s.w.uid;
          // Le bonus de Marque s'ajoute au multiplicateur (critique marqué ×2 → ×2,5), il ne le multiplie pas.
          const raw = s.w.dmg * ((crit ? me.l.critMult : 1) + (marked ? me.l.markBonus + s.w.markBoost : 0));
          amount = Math.max(1, Math.round(raw - Math.min(foe.l.flatReduce, raw * MAX_FLAT_REDUCE)));
          applyDamage(foe, amount, s.w.armorPierce);
          if (s.w.trueDmg > 0) {
            foe.hp = Math.max(0, foe.hp - Math.round(s.w.trueDmg));
            amount += Math.round(s.w.trueDmg);
          }
          me.dealt += amount;
          if (crit && s.w.critStun > 0) for (const fw of foe.ws) fw.next = Math.max(fw.next, t) + s.w.critStun;
          events.push({
            t, kind: 'shot', from: me.side, uid: s.w.uid, amount, crit, miss: false,
            pierce: s.w.armorPierce > 0, ...(n > 0 ? { double: true } : {}), ...heatField,
            ...(mark ? { mark: true } : {}), ...(marked ? { marked: true } : {}),
            hp: round1(foe.hp), armor: round1(foe.armor),
          });
          if (foe.hp <= 0) {
            events.push({ t, kind: 'death', side: foe.side });
            return foe.side;
          }
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

    // Objets actifs
    for (const s of me.as) {
      if (s.charges <= 0 || t < s.next) continue;
      const ac = s.a;
      if (ac.kind === 'frag') {
        const amount = Math.round(ac.value);
        applyDamage(foe, amount, ac.ignoreArmor ? 1 : 0);
        me.dealt += amount;
        events.push({ t, kind: 'frag', side: me.side, uid: ac.uid, amount, hp: round1(foe.hp), armor: round1(foe.armor) });
        if (foe.hp <= 0) {
          events.push({ t, kind: 'death', side: foe.side });
          return foe.side;
        }
      } else if (ac.kind === 'smoke') {
        me.smokeUntil = t + ac.duration;
        events.push({ t, kind: 'smoke', side: me.side, uid: ac.uid, until: me.smokeUntil });
      } else if (ac.kind === 'flash') {
        for (const fw of foe.ws) fw.next = Math.max(fw.next, t) + ac.value;
        events.push({ t, kind: 'flash', side: me.side, uid: ac.uid, until: t + ac.value });
      } else if (ac.kind === 'adrenaline') {
        if (me.hp / me.l.maxHp >= ac.threshold) continue;
        me.adrenalineUntil = t + ac.duration;
        me.adrenalineBoost = ac.value;
        events.push({ t, kind: 'adrenaline', side: me.side, uid: ac.uid, until: me.adrenalineUntil });
      } else {
        if (me.hp / me.l.maxHp >= ac.threshold) continue;
        const amount = Math.min(Math.round(ac.value), Math.round(me.l.maxHp - me.hp));
        me.hp += amount;
        events.push({ t, kind: 'heal', side: me.side, uid: ac.uid, amount, hp: round1(me.hp) });
      }
      s.charges--;
      s.next = t + ac.cooldown;
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
