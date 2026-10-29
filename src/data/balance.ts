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

export const FINANCE = {
  loan: {
    /** Encours maximal de tous les prêts cumulés. */
    maxOutstanding: 100_000,
    minAmount: 1_000,
    annualRate: 0.06,
    /** Chaque emprunt se rembourse par mensualités constantes sur 5 ans. */
    termMonths: 60,
  },
  /** Entretien mensuel : part de la valeur des bâtiments restaurés (étape 3). */
  maintenanceMonthlyRate: 0.01,
  bankruptcy: {
    /** Mois consécutifs de trésorerie négative avant l'avertissement, puis la faillite. */
    warningMonths: 1,
    defeatMonths: 3,
  },
  /** Mois conservés en détail dans le journal ; au-delà, regroupés par mois et catégorie. */
  journalDetailMonths: 24,
} as const;

/** Droits d'accise sur les ventes au Royaume-Uni (boutique, cavistes). */
export const EXCISE = {
  perUkBottle: 9,
} as const;

/** Salaires mensuels par rôle, du niveau 1 au niveau 5. */
export const SALARIES = {
  worker: [1_800, 2_000, 2_200, 2_400, 2_600],
  distiller: [2_500, 3_125, 3_750, 4_375, 5_000],
  cellarMaster: [3_000, 3_875, 4_750, 5_625, 6_500],
  guide: [1_600, 1_800, 2_000, 2_200, 2_400],
} as const;

/** Personnel au début de partie (jalon 1 « La ruine »). */
export const STARTING_STAFF = [{ role: 'worker', level: 1 }] as const;

/** Distillerie : grille de salles et coûts d'agrandissement. */
export const BUILDING = {
  /** Colonnes de la grille (emplacements de large). */
  columns: 8,
  /** Niveaux : -1 = cave, 0 = rez-de-chaussée, 1 = étage. */
  minLevel: -1,
  maxLevel: 1,
  /** Colonnes des 5 salles en ruine du rez-de-chaussée au départ. */
  startColumn: 1,
  /** Prix du premier emplacement acheté, puis +25 % par emplacement déjà acheté. */
  slotBaseCost: 4_000,
  slotCostGrowth: 1.25,
  /** Une salle construite à neuf coûte 1,5 fois son prix de restauration. */
  newRoomMultiplier: 1.5,
  /** Salles identiques voisines fusionnées au maximum. */
  maxMerge: 3,
  /** Efficacité gagnée par salle supplémentaire dans une fusion. */
  mergeBonus: 0.1,
} as const;

/** Coût de chaque type de salle (restauration, ou construction pour les salles neuves). */
export const ROOM_COSTS = {
  malting: 8_000,
  mashing: 10_000,
  fermentation: 6_000,
  stillHouse: 12_000,
  reception: 20_000,
  ginWorkshop: 7_000,
  tasting: 5_000,
  shop: 6_000,
  cafe: 6_000,
  toilets: 1_500,
  staffRoom: 4_000,
} as const;

/** Chais : bâtiments séparés sur la carte. */
export const WAREHOUSE = {
  restoreCost: 6_000,
  startPlaces: 40,
} as const;

export const OFFLINE = {
  /** Durée minimale de rattrapage (heures de jeu) pour afficher « Pendant ton absence ». */
  summaryMinHours: 24,
} as const;

export const MAP = {
  cols: 64,
  rows: 64,
  /** Taille d'une tuile en pixels logiques. */
  tileSize: 32,
  /** Graine du terrain de départ (ruisseau, chemins, décor). */
  terrainSeed: 1789,
  /** Cour de la distillerie en ruine, en tuiles. */
  courtyard: { x: 25, y: 23, width: 14, height: 11 },
  /** Emprise du premier chai, à l'est de la cour, en tuiles. */
  warehouse: { x: 41, y: 22.5, width: 4, height: 10 },
} as const;

export const SAVE = {
  autosaveIntervalMs: 30_000,
} as const;

export const DEBUG = {
  speeds: [1, 10, 100],
  cashGift: 10_000,
} as const;
