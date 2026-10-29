import type { GameState } from '../sim/state';
import { createEnvelope, parseSave, serializeSave, type SaveEnvelope } from './envelope';
import { MAIN_SLOT, type SaveStorage } from './storage';

export type LoadResult =
  | { status: 'empty' }
  | { status: 'loaded'; save: SaveEnvelope }
  | { status: 'corrupt'; error: string };

/**
 * Charge la partie. Une sauvegarde illisible est mise de côté dans un
 * emplacement `<slot>-corrupt` pour ne jamais être écrasée sans trace.
 */
export async function loadGame(storage: SaveStorage, slot = MAIN_SLOT): Promise<LoadResult> {
  const text = await storage.read(slot);
  if (text === null) return { status: 'empty' };
  try {
    return { status: 'loaded', save: parseSave(text) };
  } catch (error) {
    await storage.write(`${slot}-corrupt`, text);
    return { status: 'corrupt', error: error instanceof Error ? error.message : String(error) };
  }
}

export async function saveGame(
  storage: SaveStorage,
  state: GameState,
  syncedAtRealMs: number,
  slot = MAIN_SLOT,
): Promise<void> {
  await storage.write(slot, serializeSave(createEnvelope(state, syncedAtRealMs)));
}
