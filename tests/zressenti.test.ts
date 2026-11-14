import { describe, expect, it } from 'vitest';
import { GaitTracker, MAX_FPS, MIN_FPS, WALK_FRAMES, walkFps } from '../src/zombie/gait';
import { HORDE_FALL, HORDE_HOLD, VoiceLimiter, groanRate, intensity, layerGains } from '../src/zombie/mix';
import { MUSIC_RATE, TRACKS, renderTrack, trackLength } from '../src/zombie/music';
import { ZSFX_IDS, zsynth } from '../src/zombie/zsynth';

describe('mode zombie, marche', () => {
  it('cadence liée à la vitesse, bornée, nulle à l’arrêt', () => {
    expect(walkFps(0, 64, 1.25)).toBe(0);
    expect(walkFps(3, 64, 1.25)).toBe(0);
    const marcheur = walkFps(54, 64, 1.25);
    const coureur = walkFps(118, 64, 1.2);
    expect(coureur).toBeGreaterThan(marcheur);
    expect(walkFps(10000, 64, 1)).toBe(MAX_FPS);
    // Le Colosse, lent et grand, reste au plancher : il ne se fige pas.
    expect(walkFps(44, 128, 1.6)).toBe(MIN_FPS);
  });

  it('les images avancent avec la distance parcourue, pas avec le temps', () => {
    const g = new GaitTracker(2);
    g.step(0, 7, 0, 0, 1 / 60, 64, 1.25);
    const f0 = g.step(0, 7, 0, 0, 1 / 60, 64, 1.25);
    // Immobile : la même image.
    for (let k = 0; k < 60; k++) expect(g.step(0, 7, 0, 0, 1 / 60, 64, 1.25)).toBe(f0);
    // En marche : l'image change, et reste dans la feuille.
    const seen = new Set<number>();
    for (let k = 0; k < 120; k++) {
      const f = g.step(0, 7, k * 1, 0, 1 / 60, 64, 1.25);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(WALK_FRAMES);
      seen.add(f);
    }
    expect(seen.size).toBe(WALK_FRAMES);
  });

  it('une téléportation ou un nouveau zombie dans la case ne fait pas courir les jambes', () => {
    const g = new GaitTracker(1);
    g.step(0, 1, 0, 0, 1 / 60, 64, 1);
    g.step(0, 1, 2000, 0, 1 / 60, 64, 1);
    expect(g.speed(0)).toBe(0);
    g.step(0, 2, 0, 0, 1 / 60, 64, 1);
    expect(g.speed(0)).toBe(0);
    // Deux zombies différents ne partent pas de la même image.
    const a = new GaitTracker(2);
    expect(a.step(0, 1, 0, 0, 0.016, 64, 1)).not.toBe(a.step(1, 2, 0, 0, 0.016, 64, 1));
  });
});

describe('mode zombie, musique et sons', () => {
  const calm = { zombies: 20, boss: false, sinceHorde: Infinity, hpFrac: 1 };

  it('intensité : calme au début, au maximum pendant une horde et avec le Colosse, puis redescend', () => {
    expect(layerGains(intensity(calm)).menace).toBe(0);
    expect(layerGains(intensity({ ...calm, sinceHorde: 2 })).menace).toBe(1);
    expect(layerGains(intensity({ ...calm, boss: true })).menace).toBe(1);
    const after = intensity({ ...calm, sinceHorde: HORDE_HOLD + HORDE_FALL / 2 });
    expect(after).toBeLessThan(1);
    expect(after).toBeGreaterThan(intensity(calm));
    expect(intensity({ ...calm, sinceHorde: HORDE_HOLD + HORDE_FALL + 1 })).toBe(intensity(calm));
    // La foule fait monter, sans déclencher les tambours à elle seule.
    expect(intensity({ ...calm, zombies: 250 })).toBeGreaterThan(intensity(calm));
    expect(layerGains(intensity({ ...calm, zombies: 250 })).menace).toBeLessThan(0.5);
    // Toujours la couche de base.
    expect(layerGains(1).tension).toBeGreaterThan(0.8);
  });

  it('grognements : aucun sans zombie, et une cadence plafonnée même à 250', () => {
    expect(groanRate(0)).toBe(0);
    expect(groanRate(10)).toBeGreaterThan(0);
    expect(groanRate(250)).toBeLessThanOrEqual(1.1);
    expect(groanRate(250)).toBeGreaterThanOrEqual(groanRate(100));
  });

  it('limiteur de voix : plafond par catégorie, écart minimal, plafond global', () => {
    const l = new VoiceLimiter(2, { groan: { max: 2, gap: 0.3 }, roar: { max: 1, gap: 1 } });
    expect(l.tryStart('groan', 0)).toBe(true);
    expect(l.tryStart('groan', 0.1)).toBe(false); // trop tôt
    expect(l.tryStart('groan', 0.4)).toBe(true);
    expect(l.tryStart('groan', 1)).toBe(false); // déjà deux
    l.end('groan');
    expect(l.tryStart('groan', 1.1)).toBe(true);
    expect(l.tryStart('roar', 1.1)).toBe(false); // plafond global (2)
    l.end('groan');
    expect(l.tryStart('roar', 1.2)).toBe(true);
    expect(l.playing()).toBe(2);
    l.end('roar');
    l.end('roar'); // en trop : ignoré
    expect(l.playing('roar')).toBe(0);
  });

  it('boucles : « tension » et « menace » de même longueur, raccord sans claquement, sans saturation', () => {
    expect(trackLength('tension')).toBe(trackLength('menace'));
    for (const t of TRACKS) {
      const d = renderTrack(t);
      expect(d.length, t).toBe(trackLength(t));
      expect(d.length / MUSIC_RATE, t).toBeGreaterThan(15);
      expect(d.length / MUSIC_RATE, t).toBeLessThan(40);
      let peak = 0;
      let rms = 0;
      let finite = true;
      for (const v of d) {
        if (!Number.isFinite(v)) finite = false;
        peak = Math.max(peak, Math.abs(v));
        rms += v * v;
      }
      expect(finite, t).toBe(true);
      rms = Math.sqrt(rms / d.length);
      expect(peak, t).toBeLessThanOrEqual(1);
      expect(rms, t).toBeGreaterThan(0.03);
      // Raccord : le saut entre la fin et le début ressemble à un pas ordinaire.
      expect(Math.abs(d[0] - d[d.length - 1]), t).toBeLessThan(0.25);
    }
  });

  it('bruitages du mode : courts, audibles, finis', () => {
    for (const id of ZSFX_IDS) {
      const d = zsynth(id, 22050);
      expect(d.length / 22050, id).toBeLessThanOrEqual(2.1);
      let peak = 0;
      let finite = true;
      for (const v of d) {
        if (!Number.isFinite(v)) finite = false;
        peak = Math.max(peak, Math.abs(v));
      }
      expect(finite, id).toBe(true);
      expect(peak, id).toBeGreaterThan(0.2);
      expect(peak, id).toBeLessThanOrEqual(1);
      expect(Math.abs(d[d.length - 1]), id).toBeLessThan(0.02);
    }
    expect(zsynth('groan1', 22050)).toEqual(zsynth('groan1', 22050));
  });
});
