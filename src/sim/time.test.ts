import { describe, expect, it } from 'vitest';
import { TIME } from '../data/balance';
import { HOURS_PER_SEASON, HOURS_PER_YEAR, seasonOfMonth, toGameDate } from './time';

const DAY = TIME.hoursPerDay;
/** Heures écoulées depuis le début de partie (1er mars an 1, 8 h) jusqu'à une date de l'an 1. */
const at = (dayOffset: number, hour = 8) => dayOffset * DAY + hour - TIME.startHour;

describe('calendrier', () => {
  it('commence le 1er mars de l’an 1 à 8 h, au printemps', () => {
    expect(toGameDate(0)).toEqual({ year: 1, month: 3, day: 1, hour: 8, season: 'spring' });
  });

  it('compte 30 jours par mois', () => {
    expect(toGameDate(at(29, 23))).toMatchObject({ month: 3, day: 30, hour: 23 });
    expect(toGameDate(at(30, 0))).toMatchObject({ month: 4, day: 1, hour: 0 });
  });

  it('une saison dure 90 jours et 24 h réelles', () => {
    expect(HOURS_PER_SEASON).toBe(90 * DAY);
    expect((HOURS_PER_SEASON * TIME.realMsPerGameHour) / 3_600_000).toBe(24);
    expect(toGameDate(at(90, 0))).toMatchObject({ month: 6, day: 1, season: 'summer' });
    expect(toGameDate(at(180, 0))).toMatchObject({ month: 9, season: 'autumn' });
    expect(toGameDate(at(270, 0))).toMatchObject({ month: 12, season: 'winter' });
  });

  it('passe le 1er janvier sans changer d’année d’exploitation', () => {
    expect(toGameDate(at(300, 0))).toMatchObject({ year: 1, month: 1, day: 1, season: 'winter' });
  });

  it('change d’année d’exploitation le 1er mars', () => {
    expect(toGameDate(at(359, 23))).toMatchObject({ year: 1, month: 2, day: 30 });
    expect(toGameDate(at(360, 0))).toMatchObject({ year: 2, month: 3, day: 1, hour: 0 });
    expect(HOURS_PER_YEAR).toBe(360 * DAY);
  });

  it('associe chaque mois à sa saison', () => {
    const seasons = Array.from({ length: 12 }, (_, i) => seasonOfMonth(i + 1));
    expect(seasons).toEqual([
      'winter',
      'winter',
      'spring',
      'spring',
      'spring',
      'summer',
      'summer',
      'summer',
      'autumn',
      'autumn',
      'autumn',
      'winter',
    ]);
  });
});
