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

/** Prénoms et noms des candidats (noms propres, non traduits). */
export const FIRST_NAMES = [
  'Alasdair',
  'Angus',
  'Callum',
  'Catriona',
  'Duncan',
  'Eilidh',
  'Euan',
  'Fiona',
  'Fraser',
  'Hamish',
  'Iona',
  'Isla',
  'Kirsty',
  'Lachlan',
  'Morag',
  'Mhairi',
  'Niall',
  'Rhona',
  'Rory',
  'Shona',
  'Struan',
  'Torquil',
  'Ewan',
  'Ailsa',
] as const;

export const LAST_NAMES = [
  'Buchanan',
  'Cameron',
  'Campbell',
  'Douglas',
  'Ferguson',
  'Fraser',
  'Gordon',
  'Grant',
  'MacDonald',
  'MacGregor',
  'MacKay',
  'MacKenzie',
  'MacLean',
  'Munro',
  'Murray',
  'Ross',
  'Sinclair',
  'Stewart',
  'Sutherland',
  'Urquhart',
] as const;
