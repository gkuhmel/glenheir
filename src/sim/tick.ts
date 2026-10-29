import type { GameState } from './state';
import { toGameDate, type Season } from './time';

export type SimEvent =
  | { type: 'dayStarted'; hour: number }
  | { type: 'seasonStarted'; hour: number; season: Season }
  | { type: 'yearStarted'; hour: number; year: number };

/**
 * Avance l'état d'une heure de jeu (modifie `state` en place) et renvoie les
 * événements produits. Les systèmes de simulation s'y brancheront à l'étape 2,
 * dans un ordre fixe.
 */
export function tick(state: GameState): SimEvent[] {
  state.time.hour += 1;
  const hour = state.time.hour;
  const date = toGameDate(hour);
  const events: SimEvent[] = [];
  if (date.hour === 0) {
    events.push({ type: 'dayStarted', hour });
    if (date.day === 1 && toGameDate(hour - 1).season !== date.season) {
      events.push({ type: 'seasonStarted', hour, season: date.season });
    }
    if (toGameDate(hour - 1).year !== date.year) {
      events.push({ type: 'yearStarted', hour, year: date.year });
    }
  }
  return events;
}

/** Applique `count` ticks d'affilée et renvoie tous les événements produits. */
export function runTicks(state: GameState, count: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < count; i++) events.push(...tick(state));
  return events;
}
