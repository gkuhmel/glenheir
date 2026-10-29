export interface ClockAdvance {
  /** Nombre d'heures de jeu à simuler. */
  hours: number;
  /** Nouvel instant réel jusqu'auquel la simulation est à jour. */
  syncedAtRealMs: number;
  /** Heures perdues à cause du plafond de rattrapage. */
  droppedHours: number;
}

/**
 * Calcule combien d'heures de jeu simuler entre `syncedAtRealMs` (instant réel
 * jusqu'auquel la simulation est à jour) et `nowRealMs`. Le reste fractionnaire
 * d'heure est conservé dans le nouvel instant de synchronisation.
 *
 * Au-delà de `capHours`, le surplus est perdu sans pénalité. Si l'horloge de
 * l'appareil recule, rien n'est simulé et on se resynchronise sur `nowRealMs`.
 */
export function advanceClock(
  syncedAtRealMs: number,
  nowRealMs: number,
  realMsPerHour: number,
  capHours: number,
): ClockAdvance {
  const elapsed = nowRealMs - syncedAtRealMs;
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    return { hours: 0, syncedAtRealMs: nowRealMs, droppedHours: 0 };
  }
  const due = Math.floor(elapsed / realMsPerHour);
  if (due > capHours) {
    return { hours: capHours, syncedAtRealMs: nowRealMs, droppedHours: due - capHours };
  }
  return { hours: due, syncedAtRealMs: syncedAtRealMs + due * realMsPerHour, droppedHours: 0 };
}
