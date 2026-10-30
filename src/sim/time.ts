import { TIME } from '../data/balance';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface GameDate {
  /** Année d'exploitation, à partir de 1 ; change chaque 1er mars. */
  year: number;
  /** Mois calendaire, 1 = janvier. */
  month: number;
  /** Jour du mois, 1 à 30. */
  day: number;
  /** Heure de la journée, 0 à 23. */
  hour: number;
  season: Season;
}

const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

export const HOURS_PER_MONTH = TIME.hoursPerDay * TIME.daysPerMonth;
export const HOURS_PER_YEAR = HOURS_PER_MONTH * TIME.monthsPerYear;
export const HOURS_PER_SEASON = HOURS_PER_YEAR / SEASONS.length;

/** Décalage (en heures) entre le 1er janvier 0 h et le début de partie. */
const START_OFFSET =
  (TIME.startMonth - 1) * HOURS_PER_MONTH + (TIME.startDay - 1) * TIME.hoursPerDay + TIME.startHour;
/** Décalage entre le 1er janvier 0 h et le début d'une année d'exploitation. */
const YEAR_START_OFFSET = (TIME.startMonth - 1) * HOURS_PER_MONTH;

/** Saison d'un mois calendaire : printemps = mars à mai, etc. */
export function seasonOfMonth(month: number): Season {
  const index = Math.floor(((((month - 3) % 12) + 12) % 12) / 3);
  return SEASONS[index] as Season;
}

/** Convertit un nombre d'heures de jeu écoulées en date de calendrier. */
export function toGameDate(elapsedHours: number): GameDate {
  const absolute = START_OFFSET + Math.floor(elapsedHours);
  // Modulo positif : les fûts vieillis par l'outil de test ont une date de remplissage négative.
  const inYear = ((absolute % HOURS_PER_YEAR) + HOURS_PER_YEAR) % HOURS_PER_YEAR;
  const month = Math.floor(inYear / HOURS_PER_MONTH) + 1;
  const day = Math.floor((inYear % HOURS_PER_MONTH) / TIME.hoursPerDay) + 1;
  const hour = inYear % TIME.hoursPerDay;
  const year = Math.floor((absolute - YEAR_START_OFFSET) / HOURS_PER_YEAR) + 1;
  return { year, month, day, hour, season: seasonOfMonth(month) };
}

/**
 * Numéro du mois calendaire depuis le début de partie (0 = mars de l'an 1).
 * Sert à regrouper le journal et à déclencher les échéances mensuelles.
 */
export function monthIndex(elapsedHours: number): number {
  return Math.floor(
    (START_OFFSET - YEAR_START_OFFSET + Math.floor(elapsedHours)) / HOURS_PER_MONTH,
  );
}

/** Heure de jeu (écoulée) du prochain jour donné à minuit, strictement après `fromHour`. */
export function nextDateHour(fromHour: number, month: number, day: number): number {
  const absolute = START_OFFSET + Math.floor(fromHour);
  const yearStart = Math.floor(absolute / HOURS_PER_YEAR) * HOURS_PER_YEAR;
  let target = yearStart + (month - 1) * HOURS_PER_MONTH + (day - 1) * TIME.hoursPerDay;
  if (target <= absolute) target += HOURS_PER_YEAR;
  return target - START_OFFSET;
}
