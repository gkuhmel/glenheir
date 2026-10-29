import type { GameState } from '../sim/state';
import { migrate, SAVE_VERSION } from './migrations';

/** Ce qui est réellement écrit sur le disque. */
export interface SaveEnvelope {
  version: number;
  /** Instant réel (ms) jusqu'auquel la simulation est à jour. */
  syncedAtRealMs: number;
  state: GameState;
}

export function createEnvelope(state: GameState, syncedAtRealMs: number): SaveEnvelope {
  return { version: SAVE_VERSION, syncedAtRealMs, state };
}

export function serializeSave(envelope: SaveEnvelope): string {
  return JSON.stringify(envelope);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function assertGameState(value: unknown): asserts value is GameState {
  if (!isRecord(value)) throw new Error('état absent');
  if (!isRecord(value.time) || !isFiniteNumber(value.time.hour) || value.time.hour < 0) {
    throw new Error('heure de jeu invalide');
  }
  if (!isFiniteNumber(value.rngState)) throw new Error('générateur aléatoire invalide');
  const finance = value.finance;
  if (!isRecord(finance) || !isFiniteNumber(finance.cash) || !Array.isArray(finance.loans)) {
    throw new Error('finances invalides');
  }
  if (!isFiniteNumber(value.renown)) throw new Error('renommée invalide');
  if (!Array.isArray(value.staff)) throw new Error('personnel invalide');
  const journal = value.journal;
  if (!isRecord(journal) || !Array.isArray(journal.entries) || !Array.isArray(journal.monthly)) {
    throw new Error('journal invalide');
  }
  if (!isFiniteNumber(value.nextId)) throw new Error('identifiants invalides');
  const building = value.building;
  if (!isRecord(building) || !Array.isArray(building.rooms))
    throw new Error('distillerie invalide');
  if (!Array.isArray(value.warehouses)) throw new Error('chais invalides');
  if (!Array.isArray(value.machines) || !Array.isArray(value.fields))
    throw new Error('production invalide');
  const stocks = value.stocks;
  if (
    !isRecord(stocks) ||
    !isRecord(stocks.barley) ||
    !isRecord(stocks.malt) ||
    !isRecord(stocks.newMake)
  ) {
    throw new Error('stocks invalides');
  }
  if (value.terroir !== 'speyside' && value.terroir !== 'islay')
    throw new Error('terroir invalide');
}

/** Lit une sauvegarde texte, applique les migrations et valide le résultat. */
export function parseSave(text: string): SaveEnvelope {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('texte illisible');
  }
  if (!isRecord(raw)) throw new Error('format inconnu');
  if (!Number.isInteger(raw.version) || (raw.version as number) < 1) {
    throw new Error('version absente');
  }
  if (!isFiniteNumber(raw.syncedAtRealMs)) throw new Error('horodatage absent');
  const state = migrate(raw.state, raw.version as number);
  assertGameState(state);
  return { version: SAVE_VERSION, syncedAtRealMs: raw.syncedAtRealMs, state };
}
