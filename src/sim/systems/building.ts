import { BUILDING, ROOM_COSTS, WAREHOUSE } from '../../data/balance';
import { STARTING_RUINS, type RoomType } from '../../data/content';
import { roundMoney } from '../journal';

/** Un emplacement acheté de la distillerie, avec ou sans salle. */
export interface Room {
  id: number;
  col: number;
  /** -1 = cave, 0 = rez-de-chaussée, 1 = étage. */
  level: number;
  /** null : emplacement vide, prêt à recevoir une salle. */
  type: RoomType | null;
  ruined: boolean;
}

export interface Building {
  rooms: Room[];
  /** Emplacements achetés (fait monter le prix du suivant). */
  slotsPurchased: number;
}

export interface Warehouse {
  id: number;
  ruined: boolean;
  places: number;
}

/** Groupe de salles identiques voisines, fusionnées. */
export interface RoomGroup {
  type: RoomType;
  level: number;
  cols: number[];
  roomIds: number[];
  efficiency: number;
}

export interface Cell {
  col: number;
  level: number;
}

export function createStartingBuilding(firstId: number): Building {
  return {
    rooms: STARTING_RUINS.map((type, i) => ({
      id: firstId + i,
      col: BUILDING.startColumn + i,
      level: 0,
      type,
      ruined: true,
    })),
    slotsPurchased: 0,
  };
}

export function createStartingWarehouse(id: number): Warehouse {
  return { id, ruined: true, places: WAREHOUSE.startPlaces };
}

export function roomAt(building: Building, col: number, level: number): Room | undefined {
  return building.rooms.find((r) => r.col === col && r.level === level);
}

const inGrid = ({ col, level }: Cell) =>
  col >= 0 && col < BUILDING.columns && level >= BUILDING.minLevel && level <= BUILDING.maxLevel;

/**
 * Un emplacement s'achète s'il prolonge le bâtiment : au rez-de-chaussée, à côté
 * d'une salle existante ; à l'étage ou en cave, toujours au-dessus ou au-dessous
 * d'une salle du rez-de-chaussée (pas de porte-à-faux).
 */
export function isPurchasable(building: Building, cell: Cell): boolean {
  if (!inGrid(cell) || roomAt(building, cell.col, cell.level)) return false;
  const { col, level } = cell;
  if (level === 0) return !!(roomAt(building, col - 1, 0) || roomAt(building, col + 1, 0));
  return roomAt(building, col, 0) !== undefined;
}

export function purchasableCells(building: Building): Cell[] {
  const cells: Cell[] = [];
  for (let level = BUILDING.maxLevel; level >= BUILDING.minLevel; level--) {
    for (let col = 0; col < BUILDING.columns; col++) {
      if (isPurchasable(building, { col, level })) cells.push({ col, level });
    }
  }
  return cells;
}

export function slotCost(building: Building): number {
  return roundMoney(BUILDING.slotBaseCost * BUILDING.slotCostGrowth ** building.slotsPurchased);
}

export function restoreCost(type: RoomType): number {
  return ROOM_COSTS[type];
}

export function buildCost(type: RoomType): number {
  return roundMoney(ROOM_COSTS[type] * BUILDING.newRoomMultiplier);
}

/** Salles identiques voisines et en état de marche, regroupées par 3 au plus. */
export function roomGroups(building: Building): RoomGroup[] {
  const groups: RoomGroup[] = [];
  const working = building.rooms
    .filter((r) => r.type !== null && !r.ruined)
    .sort((a, b) => b.level - a.level || a.col - b.col);
  for (const room of working) {
    const last = groups.at(-1);
    if (
      last &&
      last.type === room.type &&
      last.level === room.level &&
      last.cols.at(-1) === room.col - 1 &&
      last.cols.length < BUILDING.maxMerge
    ) {
      last.cols.push(room.col);
      last.roomIds.push(room.id);
      last.efficiency = roundMoney(1 + BUILDING.mergeBonus * (last.cols.length - 1));
    } else {
      groups.push({
        type: room.type as RoomType,
        level: room.level,
        cols: [room.col],
        roomIds: [room.id],
        efficiency: 1,
      });
    }
  }
  return groups;
}

/**
 * Valeur des bâtiments en état (base de l'entretien mensuel) : prix de chaque
 * salle restaurée ou construite et des chais restaurés.
 */
export function propertyValue(building: Building, warehouses: readonly Warehouse[]): number {
  const rooms = building.rooms.reduce(
    (sum, r) => (r.type && !r.ruined ? sum + ROOM_COSTS[r.type] : sum),
    0,
  );
  const stores = warehouses.filter((w) => !w.ruined).length * WAREHOUSE.restoreCost;
  return rooms + stores;
}

/**
 * Colonne de l'escalier entre deux niveaux voisins : la première colonne où les
 * deux niveaux ont un emplacement acheté (null si aucune).
 */
export function stairColumn(building: Building, lower: number): number | null {
  for (let col = 0; col < BUILDING.columns; col++) {
    if (roomAt(building, col, lower) && roomAt(building, col, lower + 1)) return col;
  }
  return null;
}
