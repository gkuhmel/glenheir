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
  /** Extension : +20 places, le bâtiment s'allonge. */
  extensionPlaces: 20,
  extensionCost: 5_000,
  maxExtensions: 4,
  /** Fûts empilés sur 3 hauteurs (bas, milieu, haut). */
  tiers: 3,
} as const;

/** Fûts et vieillissement. */
export const CASKS = {
  /** Le new make est réduit à 63,5 % avant la mise en fût. */
  fillStrength: 0.635,
  /** Remplissage minimal d'un fût (part de sa contenance). */
  minFillShare: 0.2,
  /** Un fût de 2e remplissage donne des effets réduits de moitié. */
  refillEffect: 0.5,
  legalAgeYears: 3,
  /** Sans maître de chai, la qualité n'est connue qu'à ±15 près. */
  estimateSpread: 15,
  types: {
    exBourbon: {
      litres: 200,
      price: 150,
      speed: 1,
      /** Années pour atteindre ~63 % de l'effet du fût (courbe 1 − e^(−âge/τ)). */
      tauYears: 7,
      profile: { sweet: 22, fruity: 10, woody: 12 },
      quality: 32,
      priceFactor: 1,
    },
    sherry: {
      litres: 500,
      price: 900,
      speed: 0.9,
      tauYears: 8,
      profile: { spicy: 15, fruity: 14, sweet: 8, woody: 10 },
      quality: 34,
      priceFactor: 1.2,
    },
    newOak: {
      litres: 200,
      price: 400,
      speed: 1.5,
      tauYears: 4,
      profile: { woody: 30, sweet: 10, spicy: 6 },
      quality: 28,
      priceFactor: 1,
    },
  },
  /** Chêne neuf : au-delà de 8 ans, le whisky est surboisé. */
  newOakOverage: { afterYears: 8, qualityPerYear: 4 },
  /** Position dans le chai : en bas plus lent mais meilleur, en haut l'inverse. */
  tiers: [
    { speed: 0.85, quality: 4 },
    { speed: 1, quality: 0 },
    { speed: 1.2, quality: -3 },
  ],
} as const;

/** Gin, produit dans l'atelier gin à partir du new make pendant que le whisky vieillit. */
export const GIN = {
  batchBottles: 200,
  days: 1,
  lpaPerBottle: 0.28,
  botanicalsPerBottle: 1.5,
  /** Vendu aux cavistes britanniques (accise due). */
  price: 28,
} as const;

/** Terroirs choisis au démarrage. Les effets visiteurs et export servent aux étapes 8 et 9. */
export const TERROIRS = {
  speyside: {
    barleyYield: 1,
    /** Eau douce : +10 fruité au brassage. */
    water: { fruity: 10 },
    /** Part payée du prix de la tourbe (Islay : tourbe locale gratuite). */
    peatCostFactor: 1,
    plotPrice: 8_000,
    visitors: 1.2,
    exportTransport: 1,
    peatedPriceBonus: 0,
    angelsShare: 0.02,
  },
  islay: {
    barleyYield: 0.8,
    water: {},
    peatCostFactor: 0,
    plotPrice: 5_000,
    visitors: 0.8,
    exportTransport: 1.1,
    peatedPriceBonus: 0.1,
    angelsShare: 0.015,
  },
} as const;

/** Profil aromatique de départ d'un lot d'orge (6 axes et qualité, de 0 à 100). */
export const BASE_PROFILE = {
  fruity: 20,
  floral: 15,
  peaty: 0,
  spicy: 15,
  woody: 0,
  sweet: 20,
  quality: 40,
} as const;

export const FIELDS = {
  startPlots: 2,
  hectaresPerPlot: 1,
  tonnesPerHectare: 6,
  /** Météo de l'année : rendement ±20 %. */
  weatherSpread: 0.2,
  /** Semis au printemps (mars, avril, mai). */
  sowMonths: [3, 4, 5],
  /** Orge mûre le 15 août, récoltée d'office le 1er septembre si le joueur ne l'a pas fait. */
  ripe: { month: 8, day: 15 },
  autoHarvest: { month: 9, day: 1 },
} as const;

export const BARLEY_VARIETIES = {
  concerto: { yield: 1, seedCostPerHectare: 300, profile: {} },
  goldenPromise: { yield: 0.75, seedCostPerHectare: 500, profile: { sweet: 10, quality: 5 } },
  bere: { yield: 0.55, seedCostPerHectare: 800, profile: { spicy: 10, quality: 8 } },
} as const;

export const MARKET = {
  /** Orge achetée au marché (sans bonus de variété), prix selon la saison. */
  barleyPricePerTonne: 250,
  barleySeason: { spring: 1.1, summer: 1.15, autumn: 0.88, winter: 1 },
  /** New make vendu en vrac aux assembleurs : prix fixe, non taxé, volume illimité. */
  newMakePricePerLpa: 4,
  /** Cavistes britanniques : volume plafonné chaque mois (bouteilles). */
  retailMonthlyBottles: 300,
} as const;

export const PRODUCTION = {
  malting: {
    /** Orge mise à germer par lot et par salle. */
    batchTonnes: 4,
    minTonnes: 0.5,
    maltPerBarley: 0.8,
    days: 5,
    peat: {
      none: { peaty: 0, costPerTonne: 0 },
      light: { peaty: 25, costPerTonne: 40 },
      heavy: { peaty: 55, costPerTonne: 90 },
    },
  },
  mashing: {
    batchTonnes: 1,
    minTonnes: 0.2,
    litresPerTonne: 5_000,
    days: 1,
  },
  fermentation: {
    vesselsPerRoom: 2,
    shortDays: 2,
    longDays: 4,
    /** Fermentation longue : +10 fruité, −5 % de volume. */
    longFruity: 10,
    longVolumeLoss: 0.05,
  },
  distillation: {
    /** 5 000 L de bière de distillation donnent environ 400 L d'alcool pur. */
    lpaPerLitre: 0.08,
    energyPerDay: 120,
    restoreOldStillsCost: 8_000,
    stills: {
      small: { cost: 25_000, litresPerDay: 2_500, profile: { spicy: 6, sweet: 4 } },
      medium: { cost: 60_000, litresPerDay: 5_000, profile: { floral: 6, fruity: 6 } },
    },
    cuts: {
      narrow: { volume: 0.75, quality: 10, profile: {} },
      medium: { volume: 1, quality: 0, profile: {} },
      wide: { volume: 1.25, quality: -10, profile: { spicy: 6, peaty: 3 } },
    },
  },
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
  /** Emprise réservée au chai : il s'allonge vers le sud à chaque extension. */
  warehouse: { x: 41, y: 20.5, width: 4, height: 16 },
  /** Parcelles d'orge (1 ha chacune), au nord de la cour, en tuiles. */
  fields: [
    { x: 26, y: 13, width: 6, height: 7 },
    { x: 33, y: 13, width: 6, height: 7 },
  ],
} as const;

export const SAVE = {
  autosaveIntervalMs: 30_000,
} as const;

export const DEBUG = {
  speeds: [1, 10, 100],
  cashGift: 10_000,
} as const;
