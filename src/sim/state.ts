import { ECONOMY } from '../data/balance';

/**
 * Source de vérité unique de la partie. Objet sérialisable en JSON :
 * pas de classes, pas de fonctions. Enrichi à partir de l'étape 2.
 */
export interface GameState {
  time: {
    /** Heures de jeu écoulées depuis le début de partie (1er mars an 1, 8 h). */
    hour: number;
  };
  cash: number;
  renown: number;
}

export function createInitialState(): GameState {
  return {
    time: { hour: 0 },
    cash: ECONOMY.startingCash,
    renown: ECONOMY.startingRenown,
  };
}
