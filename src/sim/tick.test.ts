import { describe, expect, it } from 'vitest';
import { createInitialState } from './state';
import { createRng } from './rng';
import { runTicks, tick } from './tick';
import { HOURS_PER_YEAR } from './time';

describe('tick', () => {
  it('avance d’une heure de jeu', () => {
    const state = createInitialState(1);
    tick(state, createRng(1));
    expect(state.time.hour).toBe(1);
  });

  it('signale les changements de jour, de saison et d’année', () => {
    const state = createInitialState(1);
    const events = runTicks(state, HOURS_PER_YEAR);
    expect(events.filter((e) => e.type === 'dayStarted')).toHaveLength(360);
    expect(
      events
        .filter((e) => e.type === 'seasonStarted')
        .map((e) => e.type === 'seasonStarted' && e.season),
    ).toEqual(['summer', 'autumn', 'winter', 'spring']);
    expect(events.filter((e) => e.type === 'yearStarted')).toEqual([
      { type: 'yearStarted', hour: HOURS_PER_YEAR - 8, year: 2 },
    ]);
  });

  it('est déterministe', () => {
    const a = createInitialState(1);
    const b = createInitialState(1);
    expect(runTicks(a, 500)).toEqual(runTicks(b, 500));
    expect(a).toEqual(b);
  });
});
