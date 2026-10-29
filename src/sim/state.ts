import { ECONOMY, STARTING_STAFF } from '../data/balance';
import type { Journal } from './journal';

export type StaffRole = 'worker' | 'distiller' | 'cellarMaster' | 'guide';

export interface Employee {
  id: number;
  role: StaffRole;
  /** Compétence, de 1 à 5. */
  level: number;
}

/** Un emprunt, remboursé par mensualités constantes. */
export interface Loan {
  id: number;
  /** Capital restant dû. */
  principal: number;
  monthlyPayment: number;
  monthsLeft: number;
}

export interface Finance {
  cash: number;
  loans: Loan[];
  /** Mois consécutifs commencés avec une trésorerie négative. */
  negativeMonths: number;
  /** Partie perdue par faillite (l'écran de fin arrive à l'étape 8). */
  bankrupt: boolean;
}

/**
 * Source de vérité unique de la partie. Objet sérialisable en JSON :
 * pas de classes, pas de fonctions.
 */
export interface GameState {
  /** État du générateur aléatoire de la partie. */
  rngState: number;
  time: {
    /** Heures de jeu écoulées depuis le début de partie (1er mars an 1, 8 h). */
    hour: number;
  };
  finance: Finance;
  renown: number;
  staff: Employee[];
  journal: Journal;
  /** Prochain identifiant libre (employés, prêts…). */
  nextId: number;
}

export function createInitialState(seed: number): GameState {
  const staff = STARTING_STAFF.map((employee, i) => ({ id: i + 1, ...employee }));
  return {
    rngState: seed >>> 0,
    time: { hour: 0 },
    finance: { cash: ECONOMY.startingCash, loans: [], negativeMonths: 0, bankrupt: false },
    renown: ECONOMY.startingRenown,
    staff,
    journal: { entries: [], monthly: [] },
    nextId: staff.length + 1,
  };
}
