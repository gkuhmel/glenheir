import { describe, expect, it } from 'vitest';
import { BARLEY_VARIETIES, FIELDS } from '../../data/balance';
import { executeCommand } from '../commands';
import { createInitialState } from '../state';
import { runTicks } from '../tick';
import { toGameDate } from '../time';
import { growth } from './fields';

describe('champs', () => {
  it('donne 2 parcelles en friche au départ', () => {
    const state = createInitialState(1);
    expect(state.fields).toHaveLength(2);
    expect(state.fields.every((f) => f.crop === null)).toBe(true);
  });

  it('sème au printemps contre le prix de la semence', () => {
    const state = createInitialState(1);
    const field = state.fields[0]!;
    const result = executeCommand(state, {
      type: 'sowField',
      fieldId: field.id,
      variety: 'goldenPromise',
    });
    expect(result.ok).toBe(true);
    expect(state.finance.cash).toBe(50_000 - BARLEY_VARIETIES.goldenPromise.seedCostPerHectare);
    expect(toGameDate(field.crop!.ripeHour)).toMatchObject({ month: 8, day: 15, year: 1 });
    expect(
      executeCommand(state, { type: 'sowField', fieldId: field.id, variety: 'concerto' }),
    ).toEqual({
      ok: false,
      error: 'fieldBusy',
    });
  });

  it('refuse de semer hors saison', () => {
    const state = createInitialState(1);
    runTicks(state, 24 * 30 * 3); // 1er juin
    expect(
      executeCommand(state, {
        type: 'sowField',
        fieldId: state.fields[0]!.id,
        variety: 'concerto',
      }),
    ).toEqual({
      ok: false,
      error: 'notSowingSeason',
    });
  });

  it('pousse, mûrit le 15 août et se récolte avec la météo de l’année', () => {
    const state = createInitialState(1);
    const field = state.fields[0]!;
    executeCommand(state, { type: 'sowField', fieldId: field.id, variety: 'concerto' });
    expect(executeCommand(state, { type: 'harvestField', fieldId: field.id })).toEqual({
      ok: false,
      error: 'notRipe',
    });
    const crop = field.crop!;
    runTicks(state, crop.ripeHour - state.time.hour);
    expect(growth(crop, state.time.hour)).toBe(1);
    const result = executeCommand(state, { type: 'harvestField', fieldId: field.id });
    expect(result.ok).toBe(true);
    const tonnes = state.stocks.barley.amount;
    expect(tonnes).toBeGreaterThanOrEqual(6 * (1 - FIELDS.weatherSpread));
    expect(tonnes).toBeLessThanOrEqual(6 * (1 + FIELDS.weatherSpread));
    expect(field.crop).toBeNull();
  });

  it('récolte d’office au 1er septembre, sans perte', () => {
    const state = createInitialState(1);
    executeCommand(state, { type: 'sowField', fieldId: state.fields[0]!.id, variety: 'bere' });
    const events = runTicks(state, 24 * 30 * 6); // jusqu'au 1er septembre
    expect(events.filter((e) => e.type === 'harvested')).toHaveLength(1);
    expect(state.stocks.barley.amount).toBeGreaterThan(0);
    // Orge ancienne : +10 épicé, +8 qualité.
    expect(state.stocks.barley.profile.spicy).toBe(25);
    expect(state.stocks.barley.profile.quality).toBe(48);
  });

  it('rend 20 % de moins à Islay', () => {
    const yieldFor = (terroir: 'speyside' | 'islay') => {
      const state = createInitialState(7);
      executeCommand(state, { type: 'chooseTerroir', terroir });
      executeCommand(state, {
        type: 'sowField',
        fieldId: state.fields[0]!.id,
        variety: 'concerto',
      });
      runTicks(state, 24 * 30 * 6);
      return state.stocks.barley.amount;
    };
    expect(yieldFor('islay') / yieldFor('speyside')).toBeCloseTo(0.8, 2);
  });
});
