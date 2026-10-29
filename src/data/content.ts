import { ROOM_COSTS } from './balance';

/** Types de salles de la distillerie. */
export type RoomType = keyof typeof ROOM_COSTS;

export const ROOM_TYPES = Object.keys(ROOM_COSTS) as RoomType[];

/** Salles en ruine au rez-de-chaussée au début de partie, de gauche à droite. */
export const STARTING_RUINS: readonly RoomType[] = [
  'malting',
  'mashing',
  'fermentation',
  'stillHouse',
  'reception',
];
