import { describe, expect, it } from 'vitest';
import { TIME } from '../data/balance';
import { createInitialState } from '../sim/state';
import { GameLoop } from './loop';

const HOUR = TIME.realMsPerGameHour;

function setup(syncedAt = 0) {
  const clock = { now: syncedAt };
  const loop = new GameLoop(createInitialState(1), syncedAt, () => clock.now);
  return { clock, loop };
}

describe('GameLoop', () => {
  it('avance d’une heure de jeu toutes les 40 s réelles', () => {
    const { clock, loop } = setup();
    clock.now = 39_000;
    loop.update();
    expect(loop.state.time.hour).toBe(0);
    clock.now = 3 * HOUR + 1;
    loop.update();
    expect(loop.state.time.hour).toBe(3);
  });

  it('rattrape le temps passé app fermée, plafonné à 720 heures', () => {
    const { clock, loop } = setup();
    clock.now = 2 * HOUR;
    loop.update();
    // Une journée réelle hors-ligne : seules 8 h réelles sont rattrapées.
    clock.now += 24 * 3_600_000;
    expect(loop.update().hours).toBe(720);
    expect(loop.state.time.hour).toBe(722);
  });

  it('accélère en mode debug sans compter deux fois le temps passé', () => {
    const { clock, loop } = setup();
    clock.now = 1.5 * HOUR;
    loop.setSpeed(100);
    expect(loop.state.time.hour).toBe(1);
    clock.now += HOUR;
    loop.update();
    expect(loop.state.time.hour).toBe(1 + 100);
  });

  it('prévient les abonnés à chaque avancée', () => {
    const { loop } = setup();
    const calls: number[] = [];
    loop.onTick((_, hours) => calls.push(hours));
    loop.advance(24);
    expect(calls).toEqual([24]);
  });
});
