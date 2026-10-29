import { BUILDING } from '../../data/balance';

/** Dimensions de la vue en coupe, en pixels du monde. */
export const ROOM = {
  width: 300,
  height: 210,
  /** Épaisseur des planchers. */
  floor: 16,
  /** Épaisseur des murs extérieurs. */
  wall: 16,
};

/** Hauteur réservée au-dessus de l'étage pour les toits, la pagode et la cheminée. */
export const SKY = 230;
/** Paysage de part et d'autre du bâtiment. */
export const MARGIN = 480;
/** Terre sous la cave. */
export const SOIL = 150;

export const WORLD = {
  width: MARGIN * 2 + BUILDING.columns * ROOM.width,
  height: SKY + (BUILDING.maxLevel - BUILDING.minLevel + 1) * ROOM.height + SOIL,
};

/** Haut d'une case du niveau donné (1 = étage, 0 = rez-de-chaussée, -1 = cave). */
export const levelTop = (level: number): number => SKY + (BUILDING.maxLevel - level) * ROOM.height;

/** Sol sur lequel marchent les personnages d'un niveau. */
export const floorY = (level: number): number => levelTop(level) + ROOM.height - ROOM.floor;

export const colX = (col: number): number => MARGIN + col * ROOM.width;

/** Niveau du terrain naturel, au pied du rez-de-chaussée. */
export const GROUND_Y = levelTop(0) + ROOM.height;

/** Escalier entre un niveau et celui du dessus : du bas (gauche) vers le haut (droite). */
export const STAIR = { bottomX: 34, topX: 186 };
