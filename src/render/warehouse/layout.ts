import { WAREHOUSE } from '../../data/balance';

/** Dimensions de la vue en coupe du chai, en pixels du monde. */
export const CHAI = {
  /** Largeur d'une rangée de fûts (une colonne de 3 places). */
  colWidth: 80,
  /** Hauteur d'un étage de fûts. */
  tierHeight: 78,
  /** Rayon d'un fond de fût de 200 L (le sherry, plus gros, déborde un peu). */
  caskRadius: 31,
  /** Mur de pignon (avec la porte) à gauche, et mur du fond à droite. */
  endWall: 150,
  /** Espace sous la charpente au-dessus du dernier étage. */
  roof: 210,
  /** Allée de terre battue devant les fûts. */
  aisle: 70,
  /** Terre sous le sol. */
  soil: 200,
  /** Rangées réservées à droite pour le chantier d'agrandissement. */
  extensionCols: 2,
};

/** Ciel et toit d'ardoise vus au-dessus de la coupe. */
export const HALL_TOP = 250;
/** Niveau du sol en terre battue sous les fûts. */
export const RACK_FLOOR = HALL_TOP + CHAI.roof + WAREHOUSE.tiers * CHAI.tierHeight + 14;
/** Ligne où marchent les personnages, dans l'allée. */
export const AISLE_Y = RACK_FLOOR + CHAI.aisle - 18;
export const WORLD_HEIGHT = RACK_FLOOR + CHAI.aisle + CHAI.soil;

export const columnsFor = (places: number): number => Math.ceil(places / WAREHOUSE.tiers);

/** Largeur du chai, chantier d'agrandissement compris s'il est possible. */
export function worldWidth(places: number, canExtend: boolean): number {
  const cols = columnsFor(places) + (canExtend ? CHAI.extensionCols : 0);
  return CHAI.endWall * 2 + cols * CHAI.colWidth;
}

export const columnX = (col: number): number => CHAI.endWall + col * CHAI.colWidth;

/** Centre de la place donnée (colonne = place / 3, étage 0 en bas). */
export function placeCenter(place: number): { x: number; y: number } {
  const col = Math.floor(place / WAREHOUSE.tiers);
  const tier = place % WAREHOUSE.tiers;
  return {
    x: columnX(col) + CHAI.colWidth / 2,
    y: RACK_FLOOR - 8 - tier * CHAI.tierHeight - CHAI.tierHeight / 2,
  };
}

/** Place sous un point du monde, ou null hors des rangées. */
export function placeAt(x: number, y: number, places: number): number | null {
  const col = Math.floor((x - CHAI.endWall) / CHAI.colWidth);
  const tier = Math.floor((RACK_FLOOR - 8 - y) / CHAI.tierHeight);
  if (col < 0 || tier < 0 || tier >= WAREHOUSE.tiers) return null;
  const place = col * WAREHOUSE.tiers + tier;
  return place < places ? place : null;
}
