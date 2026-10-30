import { describe, expect, it } from 'vitest';
import { MARKET, PRODUCTION } from '../../data/balance';
import { executeCommand } from '../commands';
import { createInitialState, type GameState } from '../state';
import { runTicks } from '../tick';
import type { FermentationMachine, Machine, StillMachine } from './production';

/** Distillerie restaurée, alambics remis en état, de l'orge en stock. */
function readyDistillery(barley = 4): GameState {
  const state = createInitialState(3);
  state.finance.cash = 1_000_000;
  executeCommand(state, { type: 'chooseTerroir', terroir: 'speyside' });
  for (const room of state.building.rooms)
    executeCommand(state, { type: 'restoreRoom', roomId: room.id });
  const still = machine<StillMachine>(state, 'distillation');
  executeCommand(state, { type: 'restoreStills', roomId: still.roomId });
  executeCommand(state, { type: 'buyBarley', tonnes: barley });
  return state;
}

function machine<T extends Machine>(state: GameState, kind: Machine['kind']): T {
  return state.machines.find((m) => m.kind === kind) as T;
}

const DAY = 24;

describe('production', () => {
  it('installe une machine par salle de production', () => {
    const state = createInitialState(1);
    expect(state.machines.map((m) => m.kind)).toEqual([
      'malting',
      'mashing',
      'fermentation',
      'distillation',
    ]);
    expect(machine<StillMachine>(state, 'distillation').stills).toBe('ruined');
  });

  it('ne fait rien dans une salle en ruine', () => {
    const state = createInitialState(1);
    state.stocks.barley.amount = 4;
    executeCommand(state, {
      type: 'setOrders',
      roomId: machine(state, 'malting').roomId,
      orders: 1,
    });
    runTicks(state, 10 * DAY);
    expect(state.stocks.malt.amount).toBe(0);
  });

  it('malte 4 t d’orge en 5 jours, avec la tourbe choisie', () => {
    const state = readyDistillery();
    const malting = machine(state, 'malting');
    executeCommand(state, { type: 'setPeat', roomId: malting.roomId, peat: 'heavy' });
    const cash = state.finance.cash;
    executeCommand(state, { type: 'setOrders', roomId: malting.roomId, orders: 1 });
    runTicks(state, 5 * DAY);
    expect(state.stocks.malt.amount).toBeCloseTo(3.2);
    expect(state.stocks.malt.profile.peaty).toBe(55);
    expect(cash - state.finance.cash).toBe(4 * PRODUCTION.malting.peat.heavy.costPerTonne);
  });

  it('ne fait pas payer la tourbe à Islay', () => {
    const state = createInitialState(3);
    state.finance.cash = 1_000_000;
    executeCommand(state, { type: 'chooseTerroir', terroir: 'islay' });
    executeCommand(state, { type: 'restoreRoom', roomId: state.building.rooms[0]!.id });
    executeCommand(state, { type: 'buyBarley', tonnes: 4 });
    const malting = machine(state, 'malting');
    executeCommand(state, { type: 'setPeat', roomId: malting.roomId, peat: 'heavy' });
    const cash = state.finance.cash;
    executeCommand(state, { type: 'setOrders', roomId: malting.roomId, orders: 1 });
    runTicks(state, 2);
    expect(state.finance.cash).toBe(cash);
  });

  it('mène l’orge jusqu’au new make, étape par étape', () => {
    const state = readyDistillery(1.25);
    for (const kind of ['malting', 'mashing', 'distillation'] as const) {
      executeCommand(state, {
        type: 'setOrders',
        roomId: machine(state, kind).roomId,
        orders: 'continuous',
      });
    }
    const events = runTicks(state, 15 * DAY);
    const types = events.map((e) => e.type);
    expect(types).toContain('malted');
    expect(types).toContain('mashed');
    expect(types).toContain('distilled');
    // 1,25 t d'orge → 1 t de malt → 5 000 L de moût → 400 LPA (coupe moyenne).
    expect(state.stocks.newMake.amount).toBeCloseTo(400, 0);
    // Eau de Speyside (+10 fruité) et alambics à col court (+6 épicé, +4 doux).
    expect(state.stocks.newMake.profile).toMatchObject({ fruity: 30, spicy: 21, sweet: 24 });
    expect(state.journal.entries.some((e) => e.category === 'energy')).toBe(true);
  });

  it('fermente plus longtemps pour plus de fruité et un peu moins de volume', () => {
    const state = readyDistillery(1.25);
    const fermentation = machine<FermentationMachine>(state, 'fermentation');
    executeCommand(state, { type: 'setLongFermentation', roomId: fermentation.roomId, long: true });
    for (const kind of ['malting', 'mashing'] as const) {
      executeCommand(state, { type: 'setOrders', roomId: machine(state, kind).roomId, orders: 1 });
    }
    runTicks(state, 7 * DAY);
    const vessel = fermentation.vessels[0]!;
    expect(vessel.amount).toBe(4_750);
    expect(vessel.duration).toBe(4 * DAY);
    expect(vessel.profile.fruity).toBe(40);
  });

  it('règle la largeur des coupes : étroite = moins de volume, plus de qualité', () => {
    const run = (cut: 'narrow' | 'wide') => {
      const state = readyDistillery(1.25);
      executeCommand(state, { type: 'setCut', roomId: machine(state, 'distillation').roomId, cut });
      for (const kind of ['malting', 'mashing', 'distillation'] as const) {
        executeCommand(state, {
          type: 'setOrders',
          roomId: machine(state, kind).roomId,
          orders: 'continuous',
        });
      }
      runTicks(state, 15 * DAY);
      return state.stocks.newMake;
    };
    const narrow = run('narrow');
    const wide = run('wide');
    expect(narrow.amount).toBeCloseTo(300, 0);
    expect(wide.amount).toBeCloseTo(500, 0);
    expect(narrow.profile.quality - wide.profile.quality).toBe(20);
  });

  it('arrête la machine quand ses lots programmés sont faits', () => {
    const state = readyDistillery(12);
    const malting = machine(state, 'malting');
    executeCommand(state, { type: 'setOrders', roomId: malting.roomId, orders: 2 });
    runTicks(state, 20 * DAY);
    expect(state.stocks.malt.amount).toBeCloseTo(6.4);
    expect(state.stocks.barley.amount).toBeCloseTo(4);
  });

  it('exige de restaurer ou d’acheter les alambics', () => {
    const state = createInitialState(1);
    state.finance.cash = 1_000_000;
    const still = machine<StillMachine>(state, 'distillation');
    expect(executeCommand(state, { type: 'restoreStills', roomId: still.roomId })).toEqual({
      ok: false,
      error: 'roomRuined',
    });
    executeCommand(state, { type: 'restoreRoom', roomId: still.roomId });
    executeCommand(state, { type: 'restoreStills', roomId: still.roomId });
    expect(still.stills).toBe('small');
    expect(executeCommand(state, { type: 'buyStills', roomId: still.roomId })).toEqual({
      ok: false,
      error: 'stillsPresent',
    });
  });
});

describe('marché', () => {
  it('vend le new make aux assembleurs, sans accise', () => {
    const state = createInitialState(1);
    state.stocks.newMake.amount = 400;
    const result = executeCommand(state, { type: 'sellNewMake', lpa: 400 });
    expect(result.ok).toBe(true);
    expect(state.finance.cash).toBe(50_000 + 400 * MARKET.newMakePricePerLpa);
    expect(state.journal.entries.at(-1)).toMatchObject({
      category: 'sales',
      channel: 'bulk',
      product: 'newMake',
    });
    expect(executeCommand(state, { type: 'sellNewMake', lpa: 1 })).toEqual({
      ok: false,
      error: 'notEnoughStock',
    });
  });

  it('vend le malt à la distillerie voisine, au prix fixe de la tonne', () => {
    const state = createInitialState(1);
    state.stocks.malt.amount = 3.2;
    expect(executeCommand(state, { type: 'sellMalt', tonnes: 3.2 }).ok).toBe(true);
    expect(state.finance.cash).toBeCloseTo(50_000 + 3.2 * MARKET.maltPricePerTonne, 2);
    expect(state.stocks.malt.amount).toBeCloseTo(0, 6);
    expect(state.journal.entries.at(-1)).toMatchObject({ product: 'malt', channel: 'bulk' });
    expect(executeCommand(state, { type: 'sellMalt', tonnes: 1 })).toEqual({
      ok: false,
      error: 'notEnoughStock',
    });
  });

  it('achète l’orge plus cher au printemps qu’à l’automne', () => {
    const spring = createInitialState(1);
    executeCommand(spring, { type: 'buyBarley', tonnes: 10 });
    const autumn = createInitialState(1);
    runTicks(autumn, 24 * 30 * 6);
    const before = autumn.finance.cash;
    executeCommand(autumn, { type: 'buyBarley', tonnes: 10 });
    expect(50_000 - spring.finance.cash).toBe(2_750);
    expect(before - autumn.finance.cash).toBe(2_200);
  });
});

describe('terroir', () => {
  it('se choisit une seule fois', () => {
    const state = createInitialState(1);
    expect(state.terroirChosen).toBe(false);
    executeCommand(state, { type: 'chooseTerroir', terroir: 'islay' });
    expect(state.terroir).toBe('islay');
    expect(executeCommand(state, { type: 'chooseTerroir', terroir: 'speyside' })).toEqual({
      ok: false,
      error: 'terroirAlreadyChosen',
    });
  });
});
