import { describe, expect, it } from 'vitest';
import { executeCommand } from './commands';
import { createInitialState } from './state';
import { summarizeAbsence } from './summary';
import { runTicks } from './tick';
import { HOURS_PER_MONTH } from './time';

describe('résumé d’absence', () => {
  it('additionne les entrées et sorties de la période', () => {
    const state = createInitialState(1);
    executeCommand(state, { type: 'takeLoan', amount: 20_000 });
    const from = state.time.hour;
    const events = runTicks(state, HOURS_PER_MONTH);
    const summary = summarizeAbsence(state, from, events);
    expect(summary.hours).toBe(HOURS_PER_MONTH);
    // Le prêt a été pris avant l'absence : il n'apparaît pas.
    expect(summary.income).toBe(0);
    expect(summary.byCategory.salaries).toBe(-1_800);
    expect(summary.expenses).toBeLessThan(-1_800);
  });

  it('ne retient que les événements marquants', () => {
    const state = createInitialState(1);
    state.finance.cash = 100;
    const events = runTicks(state, HOURS_PER_MONTH);
    const summary = summarizeAbsence(state, 0, events);
    expect(summary.notable.map((e) => e.type)).toEqual(['bankruptcyWarning']);
  });
});
