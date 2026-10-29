import { describe, expect, it } from 'vitest';
import { createInitialState } from './state';
import { runTicks, tick } from './tick';
import { HOURS_PER_YEAR } from './time';

describe('tick', () => {
  it('avance d’une heure de jeu', () => {
    const state = createInitialState();
    tick(state);
    expect(state.time.hour).toBe(1);
  });

  it('signale les changements de jour, de saison et d’année', () => {
    const state = createInitialState();
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
    const a = createInitialState();
    const b = createInitialState();
    expect(runTicks(a, 500)).toEqual(runTicks(b, 500));
    expect(a).toEqual(b);
  });
});
