// Biomes : chaque run en tire 3, visités dans l'ordre choisi au briefing (voir GDD « Structure d'une run »).
import type { Family } from './items';
import type { Threat } from './threats';

export type BiomeId = 'banlieue' | 'industrie' | 'port' | 'foret' | 'base';

export interface Biome {
  id: BiomeId;
  name: string;
  /** Menaces plus fréquentes sur la carte de ce biome. */
  threats: Threat[];
  /** Familles de butin favorisées (utilisées par les lieux spécialisés). */
  families: Family[];
  places: string[];
  /** Fond de carte, puis taches de terrain. */
  ground: number;
  tones: number[];
  water: number;
}

export const BIOMES: Record<BiomeId, Biome> = {
  banlieue: {
    id: 'banlieue', name: 'Banlieue en ruine', threats: ['essaim', 'medics'], families: ['rempart', 'rafale'],
    places: ['Supermarché', 'École', 'Poste de secours', 'Mairie', 'Motel', 'Garage', 'Église', 'Pavillons', 'Gymnase', 'Station-service', 'Parking', 'Pharmacie', 'Lavomatic', 'Cité', 'Stade', 'Caserne de pompiers', 'Gare', 'Hôpital', 'Centre commercial', 'Château d\'eau'],
    ground: 0x1f211b, tones: [0x2a2a22, 0x25261f, 0x2e2c24, 0x232820], water: 0x22343a,
  },
  industrie: {
    id: 'industrie', name: 'Zone industrielle', threats: ['blindes', 'tireurs'], families: ['demolition', 'precision'],
    places: ['Usine', 'Carrière', 'Armurerie', 'Silo', 'Dépôt', 'Fonderie', 'Raffinerie', 'Centrale', 'Entrepôt', 'Chantier', 'Casse auto', 'Cimenterie', 'Hangar', 'Gare de triage', 'Château d\'eau', 'Station d\'épuration', 'Atelier', 'Laboratoire', 'Transformateur', 'Pont'],
    ground: 0x1d1e1c, tones: [0x2b2a26, 0x262624, 0x302c25, 0x23241f], water: 0x26323a,
  },
  port: {
    id: 'port', name: 'Port', threats: ['tireurs', 'assaut'], families: ['rafale', 'precision'],
    places: ['Docks', 'Entrepôt', 'Dépôt de munitions', 'Grues', 'Capitainerie', 'Phare', 'Conserverie', 'Cale sèche', 'Terminal', 'Douanes', 'Chantier naval', 'Criée', 'Silo à grain', 'Marina', 'Jetée', 'Cuves', 'Hangar', 'Gare maritime', 'Ponton', 'Caserne'],
    ground: 0x1b2022, tones: [0x232a2c, 0x262b28, 0x1f2729, 0x2a2d29], water: 0x1d3442,
  },
  foret: {
    id: 'foret', name: 'Forêt', threats: ['essaim', 'tireurs'], families: ['precision', 'demolition'],
    places: ['Scierie', 'Ferme', 'Stand de tir', 'Clairière', 'Refuge', 'Maison forestière', 'Moulin', 'Carrière', 'Tour de guet', 'Camp', 'Pont', 'Grange', 'Chapelle', 'Relais de chasse', 'Barrage', 'Village', 'Antenne', 'Bunker', 'Cabane', 'Étang'],
    ground: 0x18210f, tones: [0x1f2c17, 0x243318, 0x1c2814, 0x283520], water: 0x1f333a,
  },
  base: {
    id: 'base', name: 'Base aérienne', threats: ['assaut', 'blindes'], families: ['rafale', 'rempart'],
    places: ['Hangar', 'Caserne', 'Tour de contrôle', 'Piste', 'Radar', 'Dépôt de carburant', 'Infirmerie', 'Armurerie', 'Mess', 'Poste de garde', 'Héliport', 'Bunker', 'Atelier', 'Antenne', 'Hangar à drones', 'Soute', 'QG', 'Château d\'eau', 'Stand de tir', 'Parking'],
    ground: 0x1e201b, tones: [0x2a2b24, 0x272822, 0x2d2c25, 0x22251e], water: 0x22343a,
  },
};

export const BIOME_IDS = Object.keys(BIOMES) as BiomeId[];
