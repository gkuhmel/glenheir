import { describe, expect, it } from 'vitest';
import { CASKS, GIN, MARKET, WAREHOUSE } from '../../data/balance';
import { executeCommand } from '../commands';
import { baseProfile } from '../profile';
import { createInitialState, type GameState } from '../state';
import { runTicks } from '../tick';
import { HOURS_PER_YEAR } from '../time';
import { caskCapacityLpa, caskProfile, qualityEstimate, type Cask } from './warehouse';

/** Chai restauré, du new make en réserve. */
function cellar(newMake = 2_000): GameState {
  const state = createInitialState(5);
  state.finance.cash = 1_000_000;
  executeCommand(state, { type: 'chooseTerroir', terroir: 'speyside' });
  executeCommand(state, { type: 'restoreWarehouse', warehouseId: state.warehouses[0]!.id });
  state.stocks.newMake.amount = newMake;
  state.stocks.newMake.profile = { ...baseProfile(), quality: 45 };
  return state;
}

const fill = (state: GameState, place: number, caskType: Cask['type'] = 'exBourbon') =>
  executeCommand(state, {
    type: 'fillCask',
    warehouseId: state.warehouses[0]!.id,
    place,
    caskType,
  });

describe('mise en fût', () => {
  it('remplit un fût de 200 L à 63,5 % et paie le fût', () => {
    const state = cellar();
    expect(fill(state, 0).ok).toBe(true);
    const cask = state.casks[0]!;
    expect(cask.lpa).toBe(caskCapacityLpa('exBourbon'));
    expect(cask.lpa).toBe(127);
    expect(state.stocks.newMake.amount).toBe(2_000 - 127);
    expect(state.finance.cash).toBe(1_000_000 - 6_000 - CASKS.types.exBourbon.price);
  });

  it('accepte un fût partiel, mais pas presque vide', () => {
    const state = cellar(60);
    expect(fill(state, 0).ok).toBe(true);
    expect(state.casks[0]!.lpa).toBe(60);
    state.stocks.newMake.amount = 10;
    expect(fill(state, 1)).toEqual({ ok: false, error: 'notEnoughStock' });
  });

  it('refuse une place occupée, hors du chai ou un chai en ruine', () => {
    const state = cellar();
    fill(state, 0);
    expect(fill(state, 0)).toEqual({ ok: false, error: 'placeTaken' });
    expect(fill(state, 40)).toEqual({ ok: false, error: 'placeInvalid' });
    const ruined = createInitialState(1);
    ruined.stocks.newMake.amount = 500;
    expect(
      executeCommand(ruined, {
        type: 'fillCask',
        warehouseId: ruined.warehouses[0]!.id,
        place: 0,
        caskType: 'sherry',
      }),
    ).toEqual({ ok: false, error: 'warehouseRuined' });
  });
});

describe('vieillissement', () => {
  it('donne un whisky cohérent après 3 ans en ex-bourbon', () => {
    const state = cellar();
    fill(state, 1); // hauteur moyenne
    const events = runTicks(state, 3 * HOURS_PER_YEAR);
    const cask = state.casks[0]!;
    const profile = caskProfile(cask);
    // Le bois a apporté du doux, du fruité et du boisé ; la qualité a monté sans plafonner.
    expect(profile.sweet).toBeGreaterThan(25);
    expect(profile.woody).toBeGreaterThan(3);
    expect(profile.quality).toBeGreaterThan(50);
    expect(profile.quality).toBeLessThan(70);
    // Part des anges : 2 % par an.
    expect(cask.lpa).toBeCloseTo(127 * 0.98 ** 3, 1);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'caskMatured', caskId: cask.id, years: 3 }),
    );
  });

  it('vieillit plus vite en haut, mieux en bas', () => {
    const state = cellar();
    fill(state, 0); // en bas
    fill(state, 2); // en haut
    runTicks(state, 2 * HOURS_PER_YEAR);
    const [bottom, top] = state.casks;
    expect(top!.maturedHours).toBeGreaterThan(bottom!.maturedHours);
    const quality = (c: Cask) => caskProfile(c).quality;
    expect(Math.abs(quality(bottom!) - quality(top!))).toBeLessThan(10);
  });

  it('marque plus vite en chêne neuf, puis se dégrade passé 8 ans', () => {
    const state = cellar();
    fill(state, 1, 'newOak');
    fill(state, 4, 'exBourbon');
    executeCommand(state, { type: 'debugAgeCasks', years: 2 });
    const [oak, bourbon] = state.casks;
    expect(caskProfile(oak!).woody).toBeGreaterThan(caskProfile(bourbon!).woody);
    const peak = caskProfile(oak!).quality;
    executeCommand(state, { type: 'debugAgeCasks', years: 10 });
    expect(caskProfile(oak!).quality).toBeLessThan(peak);
  });

  it('réduit de moitié l’effet d’un fût de réemploi', () => {
    const state = cellar();
    fill(state, 1);
    fill(state, 4);
    state.casks[1]!.fill = 2;
    executeCommand(state, { type: 'debugAgeCasks', years: 5 });
    const [first, refill] = state.casks;
    const gain = (c: Cask) => caskProfile(c).sweet - c.spirit.sweet;
    expect(gain(refill!)).toBeCloseTo(gain(first!) / 2, 1);
  });

  it('perd moins à Islay (part des anges de 1,5 %)', () => {
    const state = createInitialState(5);
    state.finance.cash = 100_000;
    executeCommand(state, { type: 'chooseTerroir', terroir: 'islay' });
    executeCommand(state, { type: 'restoreWarehouse', warehouseId: state.warehouses[0]!.id });
    state.stocks.newMake.amount = 500;
    fill(state, 0);
    runTicks(state, HOURS_PER_YEAR);
    expect(state.casks[0]!.lpa).toBeCloseTo(127 * 0.985, 1);
  });

  it('estime la qualité à ±15 près sans maître de chai', () => {
    const state = cellar();
    fill(state, 1);
    executeCommand(state, { type: 'debugAgeCasks', years: 3 });
    const cask = state.casks[0]!;
    const { low, high } = qualityEstimate(cask);
    const real = caskProfile(cask).quality;
    expect(high - low).toBeLessThanOrEqual(2 * CASKS.estimateSpread);
    expect(real).toBeGreaterThanOrEqual(low);
    expect(real).toBeLessThanOrEqual(high);
  });
});

describe('chai', () => {
  it('s’agrandit de 20 places, 4 fois au plus', () => {
    const state = cellar();
    const id = state.warehouses[0]!.id;
    for (let i = 0; i < WAREHOUSE.maxExtensions; i++) {
      expect(executeCommand(state, { type: 'extendWarehouse', warehouseId: id }).ok).toBe(true);
    }
    expect(state.warehouses[0]!.places).toBe(120);
    expect(executeCommand(state, { type: 'extendWarehouse', warehouseId: id })).toEqual({
      ok: false,
      error: 'warehouseFull',
    });
  });
});

describe('gin', () => {
  function workshop(): GameState {
    const state = cellar();
    executeCommand(state, { type: 'buySlot', col: 6, level: 0 });
    const slot = state.building.rooms.find((r) => r.col === 6)!;
    executeCommand(state, { type: 'buildRoom', roomId: slot.id, roomType: 'ginWorkshop' });
    return state;
  }

  it('produit 200 bouteilles par jour à partir du new make et des botaniques', () => {
    const state = workshop();
    const gin = state.machines.find((m) => m.kind === 'gin')!;
    executeCommand(state, { type: 'setOrders', roomId: gin.roomId, orders: 2 });
    const cash = state.finance.cash;
    runTicks(state, 48);
    expect(state.stocks.gin).toBe(400);
    expect(state.stocks.newMake.amount).toBeCloseTo(2_000 - 2 * 200 * GIN.lpaPerBottle);
    expect(cash - state.finance.cash).toBe(2 * 200 * GIN.botanicalsPerBottle);
  });

  it('se vend aux cavistes avec l’accise, dans la limite mensuelle', () => {
    const state = workshop();
    state.stocks.gin = 500;
    const cash = state.finance.cash;
    expect(executeCommand(state, { type: 'sellGin', bottles: 300 }).ok).toBe(true);
    expect(state.finance.cash - cash).toBe(300 * (GIN.price - 9));
    expect(executeCommand(state, { type: 'sellGin', bottles: 1 })).toEqual({
      ok: false,
      error: 'retailCapReached',
    });
    // Le plafond se renouvelle le mois suivant.
    runTicks(state, 30 * 24);
    expect(executeCommand(state, { type: 'sellGin', bottles: 100 }).ok).toBe(true);
    expect(MARKET.retailMonthlyBottles).toBe(300);
  });
});
