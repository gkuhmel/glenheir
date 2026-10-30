import { describe, expect, it } from 'vitest';
import { BOTTLING, EXCISE, MARKET } from '../../data/balance';
import { executeCommand } from '../commands';
import { createInitialState, type GameState } from '../state';
import { runTicks } from '../tick';
import { agePrice, whiskyUnitPrice } from './bottling';
import { syncMachines } from './production';
import { newEmployee } from './staff';
import { caskProfile } from './warehouse';

/** Chai restauré avec les fûts hérités, une salle d'embouteillage en état. */
function cellar(): GameState {
  const state = createInitialState(9);
  state.finance.cash = 1_000_000;
  executeCommand(state, { type: 'chooseTerroir', terroir: 'speyside' });
  executeCommand(state, { type: 'restoreWarehouse', warehouseId: state.warehouses[0]!.id });
  const room = state.building.rooms.find((r) => r.type === 'reception')!;
  room.type = 'bottling';
  room.ruined = false;
  syncMachines(state);
  // Les fûts hérités ne se mettent pas en bouteille : on s'en sert ici comme de fûts ordinaires.
  for (const cask of state.casks) delete cask.inherited;
  return state;
}

const bourbon = (state: GameState, years: number) =>
  state.casks.find(
    (c) => c.type === 'exBourbon' && Math.round((state.time.hour - c.filledHour) / 8640) === years,
  )!;

describe('mise en bouteille', () => {
  it('met un fût en bouteille sur la chaîne : 0,28 LPA par bouteille, £3 l’une', () => {
    const state = cellar();
    const cask = bourbon(state, 8);
    const bottles = Math.floor(cask.lpa / BOTTLING.lpaPerBottle);
    const profile = caskProfile(cask);
    const cash = state.finance.cash;
    expect(executeCommand(state, { type: 'bottle', caskIds: [cask.id] }).ok).toBe(true);
    expect(state.casks.some((c) => c.id === cask.id)).toBe(false);
    expect(state.finance.cash).toBeCloseTo(cash - bottles * BOTTLING.costPerBottle, 2);
    expect(executeCommand(state, { type: 'bottle', caskIds: [bourbon(state, 10).id] })).toEqual({
      ok: false,
      error: 'bottlingBusy',
    });
    runTicks(state, 24);
    expect(state.bottlings).toHaveLength(1);
    const bottling = state.bottlings[0]!;
    expect(bottling).toMatchObject({ ageYears: 8, singleCaskId: cask.id, stock: bottles });
    expect(bottling.profile.quality).toBeCloseTo(profile.quality, 5);
  });

  it('refuse les fûts du grand-oncle, promis au courtier', () => {
    const state = cellar();
    state.casks[0]!.inherited = true;
    expect(executeCommand(state, { type: 'bottle', caskIds: [state.casks[0]!.id] })).toEqual({
      ok: false,
      error: 'inheritedCask',
    });
  });

  it('attend un ouvrier pour faire tourner la chaîne', () => {
    const state = cellar();
    state.staff = [];
    executeCommand(state, { type: 'bottle', caskIds: [bourbon(state, 8).id] });
    runTicks(state, 48);
    expect(state.bottlings).toHaveLength(0);
  });

  it('refuse sans salle d’embouteillage, ou un fût trop jeune', () => {
    const state = createInitialState(9);
    expect(executeCommand(state, { type: 'bottle', caskIds: [state.casks[0]!.id] })).toEqual({
      ok: false,
      error: 'noBottlingRoom',
    });
    const young = cellar();
    young.stocks.newMake.amount = 500;
    executeCommand(young, {
      type: 'fillCask',
      warehouseId: young.warehouses[0]!.id,
      place: 20,
      caskType: 'exBourbon',
    });
    expect(executeCommand(young, { type: 'bottle', caskIds: [young.casks.at(-1)!.id] })).toEqual({
      ok: false,
      error: 'caskTooYoung',
    });
  });

  it('assemble plusieurs fûts avec un maître de chai : âge du plus jeune, profil moyen', () => {
    const state = cellar();
    const ids = [bourbon(state, 8).id, bourbon(state, 15).id];
    expect(executeCommand(state, { type: 'bottle', caskIds: ids })).toEqual({
      ok: false,
      error: 'needCellarMaster',
    });
    state.staff.push(newEmployee(state.nextId++, { role: 'cellarMaster', level: 1, name: 'T' }));
    expect(executeCommand(state, { type: 'bottle', caskIds: ids }).ok).toBe(true);
    runTicks(state, 48);
    expect(state.bottlings[0]).toMatchObject({ ageYears: 8, casks: 2, singleCaskId: null });
  });
});

describe('prix et demande', () => {
  it('fixe le prix de base selon l’âge (interpolé entre 3, 8, 12 et 18 ans)', () => {
    expect(agePrice(3)).toBe(35);
    expect(agePrice(10)).toBeCloseTo(67.5);
    expect(agePrice(30)).toBe(180);
    const state = createInitialState(1);
    const bottling = {
      ageYears: 3,
      caskFactor: 1,
      profile: { ...caskProfile(state.casks[0]!), quality: 50 },
    };
    expect(whiskyUnitPrice(state, bottling, 'retail')).toBeCloseTo(35);
    expect(whiskyUnitPrice(state, bottling, 'export')).toBeCloseTo(35 * MARKET.export.priceFactor);
    state.renown = 100;
    expect(whiskyUnitPrice(state, bottling, 'retail')).toBeCloseTo(35 * 1.5);
  });

  it('vendre beaucoup d’un coup fait baisser le prix moyen ; la demande revient', () => {
    const sell = (state: GameState, bottles: number) => {
      const before = state.finance.cash;
      executeCommand(state, {
        type: 'sellWhisky',
        bottlingId: state.bottlings[0]!.id,
        channel: 'retail',
        bottles,
      });
      return (state.finance.cash - before + bottles * EXCISE.perUkBottle) / bottles;
    };
    const ready = () => {
      const state = cellar();
      executeCommand(state, {
        type: 'bottle',
        caskIds: [state.casks.find((c) => c.type === 'sherry')!.id],
      });
      runTicks(state, 48);
      return state;
    };
    const a = ready();
    const first = sell(a, 1);
    const b = ready();
    const bulk = sell(b, 600);
    expect(bulk).toBeLessThan(first * 0.8);
    // Après un mois, le canal a retrouvé l'essentiel de sa demande.
    runTicks(b, 30 * 24);
    expect(sell(b, 1)).toBeGreaterThan(first * 0.85);
  });

  it('un bon whisky fait monter la renommée ; l’export s’ouvre à 30', () => {
    const state = cellar();
    executeCommand(state, {
      type: 'bottle',
      caskIds: [state.casks.find((c) => c.type === 'sherry')!.id],
    });
    runTicks(state, 48);
    const bottling = state.bottlings[0]!;
    expect(
      executeCommand(state, {
        type: 'sellWhisky',
        bottlingId: bottling.id,
        channel: 'export',
        bottles: 1,
      }),
    ).toEqual({ ok: false, error: 'renownTooLow' });
    executeCommand(state, {
      type: 'sellWhisky',
      bottlingId: bottling.id,
      channel: 'retail',
      bottles: 100,
    });
    const quality = bottling.profile.quality;
    expect(quality).toBeGreaterThan(60);
    expect(state.renown).toBeCloseTo(100 * (quality - 55) * 0.002, 5);
    state.renown = 30;
    const cash = state.finance.cash;
    expect(
      executeCommand(state, {
        type: 'sellWhisky',
        bottlingId: bottling.id,
        channel: 'export',
        bottles: 10,
      }).ok,
    ).toBe(true);
    // Pas d'accise à l'export.
    expect(state.journal.entries.at(-1)).toMatchObject({ category: 'sales', channel: 'export' });
    expect(state.finance.cash).toBeGreaterThan(cash);
  });
});
