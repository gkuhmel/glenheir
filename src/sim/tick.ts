import type { Rng } from './rng';
import { createRng } from './rng';
import type { GameState } from './state';
import { runMonthlyFinance } from './systems/finance';
import { toGameDate, type Season } from './time';

export type SimEvent =
  | { type: 'dayStarted'; hour: number }
  | { type: 'monthStarted'; hour: number; month: number }
  | { type: 'seasonStarted'; hour: number; season: Season }
  | { type: 'yearStarted'; hour: number; year: number }
  | { type: 'salariesPaid'; hour: number; amount: number }
  | { type: 'loanTaken'; hour: number; loanId: number; amount: number }
  | { type: 'loanPaid'; hour: number; loanId: number; amount: number }
  | { type: 'loanRepaid'; hour: number; loanId: number }
  | { type: 'bankruptcyWarning'; hour: number; monthsLeft: number }
  | { type: 'bankrupt'; hour: number };

/**
 * Avance l'état d'une heure de jeu (modifie `state` en place) et renvoie les
 * événements produits. Les systèmes s'appliquent toujours dans le même ordre.
 */
export function tick(state: GameState, rng: Rng): SimEvent[] {
  void rng; // Utilisé par les systèmes aléatoires (météo, événements) des étapes suivantes.
  state.time.hour += 1;
  const hour = state.time.hour;
  const date = toGameDate(hour);
  const events: SimEvent[] = [];
  if (date.hour !== 0) return events;

  events.push({ type: 'dayStarted', hour });
  const previous = toGameDate(hour - 1);
  if (date.year !== previous.year) events.push({ type: 'yearStarted', hour, year: date.year });
  if (date.season !== previous.season) {
    events.push({ type: 'seasonStarted', hour, season: date.season });
  }
  if (date.day === 1) {
    events.push({ type: 'monthStarted', hour, month: date.month });
    events.push(...runMonthlyFinance(state));
  }
  return events;
}

/**
 * Applique `count` ticks d'affilée avec le générateur de la partie, dont l'état
 * est reporté dans `state` pour que la suite reprenne au même point.
 */
export function runTicks(state: GameState, count: number): SimEvent[] {
  const rng = createRng(state.rngState);
  const events: SimEvent[] = [];
  for (let i = 0; i < count; i++) events.push(...tick(state, rng));
  state.rngState = rng.state;
  return events;
}
