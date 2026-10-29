/** Réglages de rendu (pas d'équilibrage) : zoom et gestes. */
export const ZOOM = {
  min: 0.35,
  max: 3,
  initial: 0.6,
  /** Sensibilité de la molette / du pincement au trackpad. */
  wheelSensitivity: 0.0015,
} as const;

export const GESTURE = {
  /** Déplacement maximal (px) pour qu'un appui compte comme un tap. */
  tapSlop: 10,
  tapMaxMs: 350,
} as const;

/** Résolution plafonnée pour garder de bonnes performances sur mobile. */
export const MAX_RESOLUTION = 2;

/** Pixels de texture de sol par tuile (le bruit est calculé 4× moins finement). */
export const GROUND_TEXELS_PER_TILE = 16;

/** Palette de la carte : Highlands au printemps. */
export const PALETTE = {
  background: 0x1d2a1a,
  grassDry: [0x76, 0x8f, 0x4c],
  grass: [0x5c, 0x7c, 0x40],
  grassLush: [0x46, 0x6e, 0x36],
  heatherBrown: [0x6a, 0x5e, 0x3f],
  heatherPurple: [0x6c, 0x50, 0x58],
  soil: '#8a7653',
  soilLight: '#a38f68',
  soilEdge: '#5f5038',
  mud: '#3d3628',
  water: 0x2a4245,
  waterMid: 0x34545a,
  waterLight: 0xbfd6d0,
  stone: [0x8d877a, 0x958f81, 0x857f72, 0x9c9587],
  stoneDark: 0x3c3830,
  stoneLight: 0xc4bdac,
  mortar: 0x5f584c,
  pine: [0x24402a, 0x2f5233, 0x416a3d],
  birch: [0x557f39, 0x6e9846, 0x8db35e],
  gorse: 0x3c5a2e,
  gorseFlower: 0xe6c547,
  heather: [0x8a5a80, 0x9c6a90, 0x6c4a64],
  flower: [0xf1ebdb, 0xe8cf5a, 0xd9a3c2],
  tuft: 0x3d5a2f,
  reed: 0x6f7f3c,
  reedTip: 0x6a4a2c,
  shadow: 0x0d120b,
  highlight: 0xe2b85c,
  gridLine: 0x1d2a1a,
} as const;
