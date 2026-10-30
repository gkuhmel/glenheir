import { roundMoney, totalsSince, type Category } from './journal';
import type { GameState } from './state';
import type { SimEvent } from './tick';

/** Résumé d'une période de rattrapage, pour l'écran « Pendant ton absence ». */
export interface AbsenceSummary {
  hours: number;
  income: number;
  expenses: number;
  byCategory: Partial<Record<Category, number>>;
  /** Événements à signaler au joueur (prêts soldés, risque de faillite…). */
  notable: SimEvent[];
  /** Production de la période : orge récoltée et malt en tonnes, new make en LPA. */
  produced: { barley: number; malt: number; newMake: number; gin: number };
}

const NOTABLE: ReadonlySet<SimEvent['type']> = new Set([
  'seasonStarted',
  'yearStarted',
  'loanRepaid',
  'bankruptcyWarning',
  'bankrupt',
  'fieldRipe',
  'caskMatured',
  'employeeQuit',
  'bottled',
  'levelUp',
  'trainingDone',
]);

const round = (value: number) => Math.round(value * 10) / 10;

export function summarizeAbsence(
  state: GameState,
  fromHour: number,
  events: SimEvent[],
): AbsenceSummary {
  // Les transactions de l'heure de départ ont eu lieu avant l'absence.
  const byCategory = totalsSince(state, fromHour + 1);
  let income = 0;
  let expenses = 0;
  for (const amount of Object.values(byCategory)) {
    if (amount > 0) income += amount;
    else expenses += amount;
  }
  return {
    hours: state.time.hour - fromHour,
    income: roundMoney(income),
    expenses: roundMoney(expenses),
    byCategory,
    notable: events.filter((e) => NOTABLE.has(e.type)),
    produced: {
      barley: round(events.reduce((sum, e) => sum + (e.type === 'harvested' ? e.tonnes : 0), 0)),
      malt: round(events.reduce((sum, e) => sum + (e.type === 'malted' ? e.tonnes : 0), 0)),
      newMake: round(events.reduce((sum, e) => sum + (e.type === 'distilled' ? e.lpa : 0), 0)),
      gin: events.reduce((sum, e) => sum + (e.type === 'ginBottled' ? e.bottles : 0), 0),
    },
  };
}
