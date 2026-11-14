import { describe, expect, it } from 'vitest';
import { ACCESSORIES, EVOLUTIONS, POWERS, POWER_IDS, RUN_TIME, WEAPONS, WEAPON_IDS, WEAPON_MAX_LEVEL, xpToNext } from '../src/zombie/data';
import {
  CLASS_SLOTS, applyRun, defaultSave, equippedAccessories, parseSave, perkUnlocked, runWeaponXp, toggleAccessory, unlockedAccessories,
  weaponLevel, weaponUnlocked, weaponXpToNext, RunResult,
} from '../src/zombie/progress';
import { applyChoice, drawChoices, readyEvolutions } from '../src/zombie/powerups';
import { computeStats, Levels } from '../src/zombie/stats';
import { bossTimes, hpMul, pickType, targetCount, typeWeights, waveEvents } from '../src/zombie/waves';
import { World } from '../src/zombie/world';
import { mulberry32 } from '../src/logic/rng';
import { simulate } from './zombiesim';

const run = (over: Partial<RunResult> = {}): RunResult => ({ weapon: 'pistolet', time: 120, level: 8, kills: { marcheur: 100 }, elites: 0, won: false, ...over });

describe('mode zombie : XP d’arme et déblocages', () => {
  it('les niveaux d’arme suivent la courbe et plafonnent', () => {
    expect(weaponLevel(0)).toEqual({ level: 1, into: 0, need: weaponXpToNext(1) });
    expect(weaponLevel(weaponXpToNext(1)).level).toBe(2);
    expect(weaponLevel(weaponXpToNext(1) + 5)).toMatchObject({ level: 2, into: 5 });
    expect(weaponLevel(1e9).level).toBe(WEAPON_MAX_LEVEL);
  });

  it('un accessoire par niveau, à partir du niveau 2, dans l’ordre de l’arme', () => {
    expect(unlockedAccessories('precision', 1)).toEqual([]);
    expect(unlockedAccessories('precision', 2)).toEqual(['lunette']);
    expect(unlockedAccessories('precision', 13)).toHaveLength(12);
    for (const w of WEAPON_IDS) expect(new Set(WEAPONS[w].unlocks).size).toBe(Object.keys(ACCESSORIES).length);
  });

  it('XP d’une partie : kills pondérés + minutes tenues + extraction', () => {
    expect(runWeaponXp(run())).toBe(100 + 2 * 15);
    expect(runWeaponXp(run({ kills: { brute: 2, boss: 1 }, elites: 3, time: 600, won: true }))).toBe(2 * 4 + 60 + 30 + 150 + 150);
  });

  it('applyRun : XP, nouveaux accessoires, records et objectifs', () => {
    const s = defaultSave();
    const rep = applyRun(s, run({ kills: { marcheur: 400 }, time: 320, level: 21 }));
    expect(rep.levelBefore).toBe(1);
    expect(rep.levelAfter).toBe(weaponLevel(rep.weaponXp).level);
    expect(rep.newAccessories).toEqual(WEAPONS.pistolet.unlocks.slice(0, rep.levelAfter - 1));
    expect(rep.records).toEqual(['time', 'kills', 'level']);
    expect(rep.newGoals).toEqual(expect.arrayContaining(['survive5', 'level20']));
    expect(weaponUnlocked(s, 'revolver')).toBe(true);
    expect(perkUnlocked(s, 'veinard')).toBe(true);
    expect(perkUnlocked(s, 'colosse')).toBe(false);
    // Une deuxième partie moins bonne : pas de record, objectifs déjà acquis non répétés.
    const rep2 = applyRun(s, run({ kills: { marcheur: 10 }, time: 330 }));
    expect(rep2.records).toEqual(['time']);
    expect(rep2.newGoals).not.toContain('survive5');
    expect(s.records.runs).toBe(2);
    expect(s.records.totalKills).toBe(410);
  });

  it('équiper : un accessoire par emplacement, seulement s’il est débloqué', () => {
    const s = defaultSave();
    expect(toggleAccessory(s, 'smg', 'poignee')).toBe(false);
    s.weapons.smg = { xp: 10_000, equipped: {} };
    expect(toggleAccessory(s, 'smg', 'chg_etendu')).toBe(true);
    expect(toggleAccessory(s, 'smg', 'chg_tambour')).toBe(true); // même emplacement : remplace
    expect(equippedAccessories(s, 'smg')).toEqual(['chg_tambour']);
    expect(toggleAccessory(s, 'smg', 'chg_tambour')).toBe(true); // retire
    expect(equippedAccessories(s, 'smg')).toEqual([]);
  });
});

describe('mode zombie : sauvegarde', () => {
  it('aller-retour JSON', () => {
    const s = defaultSave();
    s.classes[2] = { name: 'Corbeau', fig: 'tireur', weapon: 'precision', perk: 'tireur' };
    s.weapons.precision = { xp: 999, equipped: { optique: 'lunette' } };
    s.goals = ['boss1'];
    s.records.bestTime = 412;
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });

  it('données corrompues ou invalides : valeurs par défaut', () => {
    expect(parseSave(null)).toEqual(defaultSave());
    expect(parseSave('{pas du json')).toEqual(defaultSave());
    const bad = parseSave(JSON.stringify({ v: 1, classes: [{ name: 'X', fig: 'alien', weapon: 'laser', perk: 'medecin' }], weapons: { laser: { xp: 5 }, smg: { xp: 50, equipped: { bouche: 'lunette' } } }, goals: ['nope'], selected: 9 }));
    expect(bad.classes).toHaveLength(CLASS_SLOTS);
    expect(bad.classes[0]).toBeNull();
    expect(bad.weapons).toEqual({ smg: { xp: 50, equipped: {} } });
    expect(bad.goals).toEqual([]);
    expect(bad.selected).toBe(0);
  });
});

describe('mode zombie : power-ups', () => {
  it('au moins 12 power-ups, trois choix distincts', () => {
    expect(POWER_IDS.length).toBeGreaterThanOrEqual(12);
    const rng = mulberry32(1);
    for (let i = 0; i < 50; i++) {
      const c = drawChoices(rng, {}, new Set(), 3);
      expect(c).toHaveLength(3);
      expect(new Set(c.map((x) => JSON.stringify(x))).size).toBe(3);
    }
  });

  it('empilement jusqu’au max, puis plus proposé', () => {
    const lv: Levels = {};
    const evos = new Set<never>();
    for (let i = 0; i < 10; i++) applyChoice(lv, evos, { kind: 'power', id: 'cadence' });
    expect(lv.cadence).toBe(POWERS.cadence.max);
    const rng = mulberry32(3);
    for (let i = 0; i < 40; i++) expect(drawChoices(rng, lv, evos)).not.toContainEqual({ kind: 'power', id: 'cadence' });
  });

  it('les stats suivent les niveaux', () => {
    const lo = { weapon: 'smg' as const, weaponLevel: 1, accessories: [], perk: 'medecin' as const };
    const base = computeStats(lo, {});
    const up = computeStats(lo, { cadence: 2, degats: 1, multitir: 1, pv: 2 });
    expect(up.rate).toBeCloseTo(base.rate * 1.24);
    expect(up.dmg).toBeCloseTo(base.dmg * 1.15);
    expect(up.pellets).toBe(base.pellets + 1);
    expect(up.maxHp).toBe(base.maxHp + 40);
    expect(computeStats({ ...lo, weapon: 'pompe' }, { multitir: 1 }).pellets).toBe(WEAPONS.pompe.pellets + 2);
    expect(computeStats({ ...lo, accessories: ['poignee'] }, {}).spread).toBeCloseTo(base.spread * 0.6);
    expect(computeStats({ ...lo, weaponLevel: 5 }, {}).dmg).toBeCloseTo(base.dmg * 1.12);
  });

  it('évolution proposée en premier quand ses deux power-ups sont au max', () => {
    const lv: Levels = { explosif: POWERS.explosif.max, grenades: POWERS.grenades.max };
    expect(readyEvolutions(lv, new Set())).toEqual(['bombardement']);
    expect(drawChoices(mulberry32(5), lv, new Set())[0]).toEqual({ kind: 'evo', id: 'bombardement' });
    expect(readyEvolutions(lv, new Set(['bombardement']))).toEqual([]);
    for (const e of Object.values(EVOLUTIONS)) for (const p of e.from) expect(POWER_IDS).toContain(p);
  });

  it('tout au max : la carte Ration complète', () => {
    const lv: Levels = Object.fromEntries(POWER_IDS.map((p) => [p, POWERS[p].max]));
    const evos = new Set(Object.keys(EVOLUTIONS) as (keyof typeof EVOLUTIONS)[]);
    expect(drawChoices(mulberry32(1), lv, evos)).toEqual([{ kind: 'soin' }]);
  });
});

describe('mode zombie : vagues', () => {
  it('de plus en plus nombreux et variés, plafond respecté', () => {
    expect(targetCount(0)).toBeLessThan(targetCount(300));
    expect(targetCount(10_000)).toBe(250);
    expect(hpMul(600)).toBeGreaterThan(hpMul(60));
    expect(typeWeights(10).map(([t]) => t)).toEqual(['marcheur']);
    expect(typeWeights(400).map(([t]) => t)).toEqual(['marcheur', 'coureur', 'cracheur', 'brute', 'kamikaze']);
    expect(pickType(0, 0.999)).toBe('marcheur');
  });

  it('boss toutes les 3 minutes, hordes et élites programmées', () => {
    expect(bossTimes(RUN_TIME)).toEqual([180, 360, 540]);
    expect(waveEvents(179, 181)).toContainEqual({ kind: 'boss', tier: 1 });
    expect(waveEvents(59, 61)).toContainEqual({ kind: 'elite' });
    expect(waveEvents(89, 91).some((e) => e.kind === 'horde')).toBe(true);
    // Chaque événement tombe une seule fois.
    let bosses = 0;
    for (let t = 0; t < RUN_TIME; t += 0.5) bosses += waveEvents(t, t + 0.5).filter((e) => e.kind === 'boss').length;
    expect(bosses).toBe(3);
  });

  it('XP de personnage : besoin croissant', () => {
    expect(xpToNext(1)).toBe(5);
    expect(xpToNext(10)).toBeGreaterThan(xpToNext(5));
  });
});

describe('mode zombie : simulation', () => {
  it('une partie déterministe se joue sans erreur et respecte le plafond', () => {
    const w = simulate('fusil_assaut', 1, 42, 240);
    expect(w.time).toBeGreaterThan(30);
    expect(w.killCount).toBeGreaterThan(50);
    expect(w.level).toBeGreaterThan(3);
    expect(w.zombies.filter((z) => z.active).length).toBeLessThanOrEqual(250);
    expect(w.alive).toBe(w.zombies.filter((z) => z.active).length);
    const again = simulate('fusil_assaut', 1, 42, 240);
    expect(again.killCount).toBe(w.killCount);
  });

  it('le soldat tire tout seul sur le zombie le plus proche', () => {
    const w = new World({ weapon: 'pistolet', weaponLevel: 1, accessories: [], perk: 'medecin' }, mulberry32(9));
    for (let i = 0; i < 40 && !w.zombies.some((z) => z.active); i++) w.update(0.05);
    const z = w.zombies.find((z) => z.active)!;
    z.x = w.px + 150;
    z.y = w.py;
    for (const o of w.zombies) if (o !== z) o.active = false;
    w.alive = 1;
    const hp = z.hp;
    for (let i = 0; i < 30 && z.active && z.hp === hp; i++) w.update(0.016);
    expect(z.hp < hp || !z.active).toBe(true);
  });
});
