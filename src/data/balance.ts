// Tous les chiffres d'équilibrage du jeu. Ne jamais les écrire en dur ailleurs.

export const TIME = {
  /** 1 heure de jeu = 40 s réelles (1 saison = 24 h réelles). */
  realMsPerGameHour: 40_000,
  hoursPerDay: 24,
  daysPerMonth: 30,
  monthsPerYear: 12,
  /** Mois de départ (1 = janvier) : la partie commence au printemps. */
  startMonth: 3,
  startDay: 1,
  startHour: 8,
  /** Rattrapage hors-ligne plafonné à 8 h réelles (le reste est perdu). */
  offlineCapRealMs: 8 * 60 * 60 * 1000,
} as const;

export const ECONOMY = {
  startingCash: 50_000,
  startingRenown: 0,
} as const;

export const MAP = {
  cols: 64,
  rows: 64,
  /** Taille d'une tuile en pixels logiques. */
  tileSize: 32,
} as const;

export const SAVE = {
  autosaveIntervalMs: 30_000,
} as const;

export const DEBUG = {
  speeds: [1, 10, 100],
} as const;
