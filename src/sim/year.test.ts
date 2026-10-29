import { describe, expect, it } from 'vitest';
import { executeCommand } from './commands';
import { createInitialState, type GameState } from './state';
import { runTicks, type SimEvent } from './tick';
import { HOURS_PER_YEAR, toGameDate } from './time';
import { loanPayment } from './systems/finance';

/** Partie type scriptée : prêt de £50 000 au départ, puis une année de jeu. */
function playOneYear(seed: number): { state: GameState; events: SimEvent[] } {
  const state = createInitialState(seed);
  executeCommand(state, { type: 'takeLoan', amount: 50_000 });
  // Par tranches irrégulières, comme un joueur qui revient plusieurs fois par jour.
  const events: SimEvent[] = [];
  let remaining = HOURS_PER_YEAR;
  for (const chunk of [7, 300, 720, 1, 2000, 45]) {
    events.push(...runTicks(state, chunk));
    remaining -= chunk;
  }
  events.push(...runTicks(state, remaining));
  return { state, events };
}

describe('une année de jeu', () => {
  it('est reproductible avec la même graine', () => {
    const a = playOneYear(1234);
    const b = playOneYear(1234);
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
  });

  it('aboutit au 1er mars de l’an 2', () => {
    const { state } = playOneYear(1);
    expect(toGameDate(state.time.hour)).toMatchObject({ year: 2, month: 3, day: 1, hour: 8 });
  });

  it('verse 12 salaires et 12 échéances de prêt', () => {
    const { state, events } = playOneYear(1);
    expect(events.filter((e) => e.type === 'monthStarted')).toHaveLength(12);
    expect(events.filter((e) => e.type === 'salariesPaid')).toHaveLength(12);
    expect(events.filter((e) => e.type === 'loanPaid')).toHaveLength(12);
    const expected = 50_000 + 50_000 - 12 * 1_800 - 12 * loanPayment(50_000);
    expect(state.finance.cash).toBeCloseTo(expected, 0);
    expect(state.finance.loans[0]!.monthsLeft).toBe(48);
  });

  it('garde un journal cohérent avec la trésorerie', () => {
    const { state } = playOneYear(1);
    const total = state.journal.entries.reduce((sum, e) => sum + e.amount, 0);
    expect(50_000 + total).toBeCloseTo(state.finance.cash, 2);
  });
});
