import { describe, expect, it } from 'vitest';
import { BUILDING, ROOM_COSTS, WAREHOUSE } from '../../data/balance';
import { executeCommand } from '../commands';
import { createInitialState, type GameState } from '../state';
import { runTicks } from '../tick';
import { HOURS_PER_MONTH } from '../time';
import {
  buildCost,
  isPurchasable,
  propertyValue,
  purchasableCells,
  roomAt,
  roomGroups,
  slotCost,
  stairColumn,
} from './building';

function richState(): GameState {
  const state = createInitialState(1);
  state.finance.cash = 1_000_000;
  return state;
}

const ground = (state: GameState, col: number) => roomAt(state.building, col, 0)!;

describe('distillerie de départ', () => {
  it('compte 5 salles en ruine au rez-de-chaussée et un chai en ruine', () => {
    const state = createInitialState(1);
    expect(state.building.rooms.map((r) => [r.type, r.col, r.level, r.ruined])).toEqual([
      ['malting', 1, 0, true],
      ['mashing', 2, 0, true],
      ['fermentation', 3, 0, true],
      ['stillHouse', 4, 0, true],
      ['reception', 5, 0, true],
    ]);
    expect(state.warehouses).toEqual([{ id: expect.any(Number), ruined: true, places: 40 }]);
  });

  it('donne des identifiants uniques', () => {
    const state = createInitialState(1);
    const ids = [...state.staff, ...state.building.rooms, ...state.warehouses, ...state.fields].map(
      (x) => x.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(state.nextId).toBe(Math.max(...ids) + 1);
  });
});

describe('restauration', () => {
  it('restaure une salle contre son prix', () => {
    const state = createInitialState(1);
    const malting = ground(state, 1);
    const result = executeCommand(state, { type: 'restoreRoom', roomId: malting.id });
    expect(result.ok).toBe(true);
    expect(malting.ruined).toBe(false);
    expect(state.finance.cash).toBe(50_000 - ROOM_COSTS.malting);
    expect(state.journal.entries.at(-1)).toMatchObject({ category: 'investment', amount: -8_000 });
  });

  it('refuse sans trésorerie suffisante ou si la salle est déjà restaurée', () => {
    const state = createInitialState(1);
    state.finance.cash = 1_000;
    const room = ground(state, 1);
    expect(executeCommand(state, { type: 'restoreRoom', roomId: room.id })).toEqual({
      ok: false,
      error: 'notEnoughCash',
    });
    state.finance.cash = 100_000;
    executeCommand(state, { type: 'restoreRoom', roomId: room.id });
    expect(executeCommand(state, { type: 'restoreRoom', roomId: room.id })).toEqual({
      ok: false,
      error: 'roomNotRuined',
    });
  });

  it('restaure le chai', () => {
    const state = createInitialState(1);
    const id = state.warehouses[0]!.id;
    executeCommand(state, { type: 'restoreWarehouse', warehouseId: id });
    expect(state.warehouses[0]!.ruined).toBe(false);
    expect(state.finance.cash).toBe(50_000 - WAREHOUSE.restoreCost);
  });
});

describe('agrandissement', () => {
  it('propose les emplacements voisins, l’étage et la cave', () => {
    const state = createInitialState(1);
    const cells = purchasableCells(state.building);
    expect(cells).toContainEqual({ col: 0, level: 0 });
    expect(cells).toContainEqual({ col: 6, level: 0 });
    expect(cells).toContainEqual({ col: 3, level: 1 });
    expect(cells).toContainEqual({ col: 3, level: -1 });
    expect(isPurchasable(state.building, { col: 7, level: 0 })).toBe(false);
    expect(isPurchasable(state.building, { col: 0, level: 1 })).toBe(false);
  });

  it('fait monter le prix de chaque emplacement de 25 %', () => {
    const state = richState();
    expect(slotCost(state.building)).toBe(BUILDING.slotBaseCost);
    executeCommand(state, { type: 'buySlot', col: 6, level: 0 });
    expect(slotCost(state.building)).toBe(5_000);
    executeCommand(state, { type: 'buySlot', col: 7, level: 0 });
    expect(slotCost(state.building)).toBe(6_250);
    expect(executeCommand(state, { type: 'buySlot', col: 8, level: 0 })).toEqual({
      ok: false,
      error: 'slotNotPurchasable',
    });
  });

  it('construit une salle neuve à 1,5 fois le prix de restauration', () => {
    const state = richState();
    executeCommand(state, { type: 'buySlot', col: 2, level: 1 });
    const slot = roomAt(state.building, 2, 1)!;
    expect(slot.type).toBeNull();
    const before = state.finance.cash;
    executeCommand(state, { type: 'buildRoom', roomId: slot.id, roomType: 'cafe' });
    expect(slot).toMatchObject({ type: 'cafe', ruined: false });
    expect(before - state.finance.cash).toBe(buildCost('cafe'));
    expect(buildCost('cafe')).toBe(9_000);
    expect(executeCommand(state, { type: 'buildRoom', roomId: slot.id, roomType: 'shop' })).toEqual(
      {
        ok: false,
        error: 'slotNotEmpty',
      },
    );
  });

  it('place l’escalier dans la première colonne commune à deux niveaux', () => {
    const state = richState();
    expect(stairColumn(state.building, 0)).toBeNull();
    executeCommand(state, { type: 'buySlot', col: 4, level: 1 });
    executeCommand(state, { type: 'buySlot', col: 2, level: 1 });
    expect(stairColumn(state.building, 0)).toBe(2);
    executeCommand(state, { type: 'buySlot', col: 3, level: -1 });
    expect(stairColumn(state.building, -1)).toBe(3);
  });
});

describe('fusion des salles', () => {
  it('fusionne jusqu’à 3 salles identiques voisines et restaurées', () => {
    const state = richState();
    for (const col of [6, 7, 0]) {
      executeCommand(state, { type: 'buySlot', col, level: 0 });
    }
    // Les colonnes 6 et 7 deviennent deux boutiques voisines ; l’accueil (5) est restauré seul.
    for (const col of [6, 7]) {
      executeCommand(state, { type: 'buildRoom', roomId: ground(state, col).id, roomType: 'shop' });
    }
    executeCommand(state, { type: 'restoreRoom', roomId: ground(state, 5).id });
    expect(roomGroups(state.building)).toEqual([
      { type: 'reception', level: 0, cols: [5], roomIds: [ground(state, 5).id], efficiency: 1 },
      {
        type: 'shop',
        level: 0,
        cols: [6, 7],
        roomIds: [ground(state, 6).id, ground(state, 7).id],
        efficiency: 1.1,
      },
    ]);
  });

  it('ne fusionne pas une salle en ruine', () => {
    const state = richState();
    executeCommand(state, { type: 'buySlot', col: 6, level: 0 });
    executeCommand(state, {
      type: 'buildRoom',
      roomId: ground(state, 6).id,
      roomType: 'reception',
    });
    expect(roomGroups(state.building)).toHaveLength(1);
  });
});

describe('entretien', () => {
  it('prélève 1 % par mois de la valeur des salles restaurées', () => {
    const state = createInitialState(1);
    state.staff = [];
    executeCommand(state, { type: 'restoreRoom', roomId: ground(state, 4).id });
    executeCommand(state, { type: 'restoreWarehouse', warehouseId: state.warehouses[0]!.id });
    expect(propertyValue(state.building, state.warehouses)).toBe(18_000);
    const before = state.finance.cash;
    const events = runTicks(state, HOURS_PER_MONTH);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'maintenancePaid', amount: 180 }),
    );
    expect(before - state.finance.cash).toBe(180);
  });
});
