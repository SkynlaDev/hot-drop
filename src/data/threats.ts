// Menaces : traits d'escouade annoncés sur la carte (voir GDD « Menaces et archétypes »).

export type Threat = 'blindes' | 'tireurs' | 'essaim' | 'medics' | 'assaut';

export const THREATS: Threat[] = ['blindes', 'tireurs', 'essaim', 'medics', 'assaut'];

export const THREAT_INFO: Record<Threat, { name: string; short: string; color: number; hex: string; effect: string; counters: string }> = {
  blindes: {
    name: 'Blindés', short: 'BL', color: 0x9fb3c0, hex: '#b4c6d2',
    effect: 'Chaque balle subit −4 dégâts (minimum 1)',
    counters: 'Gros calibres, munitions perforantes, explosifs',
  },
  tireurs: {
    name: "Tireurs d'élite", short: 'TI', color: 0x4fc3f7, hex: '#6fd0fa',
    effect: 'Tirs lents mais très puissants, ils tirent en premier',
    counters: 'Fumigène, armure élevée',
  },
  essaim: {
    name: 'Essaim', short: 'ES', color: 0xe8a33d, hex: '#f0b252',
    effect: '5 à 6 ennemis plus faibles',
    counters: 'Explosifs, armes à plusieurs cibles, Rafale',
  },
  medics: {
    name: 'Médics', short: 'MÉ', color: 0x5fbf6a, hex: '#7ddc86',
    effect: 'Toutes les 5 s, chaque ennemi vivant récupère 12 PV',
    counters: 'Dégâts concentrés : critiques, silencieux, gros calibres',
  },
  assaut: {
    name: 'Assaut', short: 'AS', color: 0xe5484d, hex: '#ff6b6b',
    effect: 'Les dégâts ennemis augmentent de 10 % toutes les 5 s',
    counters: 'Gros DPS pour finir vite, soins',
  },
};

export const BOSS_THREATS: Threat[] = ['assaut'];
export const BLINDES_REDUCTION = 4;
export const MEDIC_HEAL = 12;
export const MEDIC_EVERY = 5;
export const ASSAUT_STEP = 0.1;
export const ASSAUT_EVERY = 5;
