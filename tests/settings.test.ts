import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, getSettings, nextSpeed, resetSettingsCache, setSettings } from '../src/logic/settings';

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Pick<Storage, 'getItem' | 'setItem'> }).localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => void store.set(k, v),
};

describe('réglages du joueur', () => {
  beforeEach(() => {
    store.clear();
    resetSettingsCache();
  });

  it('valeurs par défaut, puis gardés d’une session à l’autre', () => {
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
    setSettings({ speed: 4, vibration: false });
    resetSettingsCache(); // nouvelle session : relu depuis le stockage
    expect(getSettings()).toEqual({ speed: 4, vibration: false });
  });

  it('valeurs illisibles ignorées ; la vitesse tourne ×1 → ×2 → ×4 → ×1', () => {
    store.set('hotdrop.settings.v1', '{"speed": 3, "vibration": "oui"}');
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
    expect([nextSpeed(1), nextSpeed(2), nextSpeed(4)]).toEqual([2, 4, 1]);
  });
});
