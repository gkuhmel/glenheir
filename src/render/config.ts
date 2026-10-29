/** Réglages de rendu (pas d'équilibrage) : zoom et gestes. */
export const ZOOM = {
  min: 0.25,
  max: 3,
  initial: 0.7,
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

export const PALETTE = {
  background: 0x1c211b,
  grass: [0x4f6b3a, 0x557241, 0x4a6536, 0x5a7745],
  stone: [0x8a857a, 0x938d80, 0x7f7a70],
  gridLine: 0x1c211b,
  highlight: 0xe8b04a,
} as const;
