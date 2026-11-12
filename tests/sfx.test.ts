import { describe, expect, it } from 'vitest';
import { SFX_IDS, synth } from '../src/audio/synth';

describe('effets sonores synthétisés', () => {
  it('chaque son se calcule : court, audible, sans saturation ni valeur invalide', () => {
    for (const id of SFX_IDS) {
      const d = synth(id, 44100);
      expect(d.length / 44100, id).toBeLessThanOrEqual(1.5);
      let peak = 0;
      for (const v of d) {
        expect(Number.isFinite(v), id).toBe(true);
        peak = Math.max(peak, Math.abs(v));
      }
      expect(peak, id).toBeGreaterThan(0.1);
      expect(peak, id).toBeLessThanOrEqual(1);
      // Fin adoucie : pas de clic à l'arrêt.
      expect(Math.abs(d[d.length - 1]), id).toBeLessThan(0.01);
    }
  });

  it('déterministe : même son, mêmes échantillons', () => {
    expect(synth('frag', 22050)).toEqual(synth('frag', 22050));
  });
});
