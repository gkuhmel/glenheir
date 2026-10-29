import { describe, expect, it } from 'vitest';
import { advanceClock } from './clock';

const HOUR = 40_000;
const CAP = 720;

describe('advanceClock', () => {
  it('ne simule rien avant une heure de jeu complète', () => {
    expect(advanceClock(0, 39_999, HOUR, CAP)).toEqual({
      hours: 0,
      syncedAtRealMs: 0,
      droppedHours: 0,
    });
  });

  it('conserve le reste fractionnaire d’heure', () => {
    const result = advanceClock(1_000, 1_000 + 2.5 * HOUR, HOUR, CAP);
    expect(result.hours).toBe(2);
    expect(result.syncedAtRealMs).toBe(1_000 + 2 * HOUR);
    // Le reste (une demi-heure) compte au rattrapage suivant.
    expect(advanceClock(result.syncedAtRealMs, 1_000 + 3 * HOUR, HOUR, CAP).hours).toBe(1);
  });

  it('plafonne le rattrapage à 8 h réelles (720 heures de jeu)', () => {
    const now = 24 * 3_600_000;
    const result = advanceClock(0, now, HOUR, CAP);
    expect(result.hours).toBe(720);
    expect(result.droppedHours).toBe(2160 - 720);
    expect(result.syncedAtRealMs).toBe(now);
  });

  it('accélère avec une durée d’heure réduite (debug ×100)', () => {
    expect(advanceClock(0, HOUR, HOUR / 100, CAP).hours).toBe(100);
  });

  it('ignore une horloge qui recule', () => {
    expect(advanceClock(10_000, 5_000, HOUR, CAP)).toEqual({
      hours: 0,
      syncedAtRealMs: 5_000,
      droppedHours: 0,
    });
  });
});
