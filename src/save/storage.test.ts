import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../sim/state';
import { loadGame, saveGame } from './game-save';
import { SAVE_VERSION } from './migrations';
import {
  createIndexedDbStorage,
  createLocalStorage,
  createMemoryStorage,
  openStorage,
  type SaveStorage,
} from './storage';

class FakeLocalStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const backends: [string, () => Promise<SaveStorage>][] = [
  ['IndexedDB', () => createIndexedDbStorage(new IDBFactory())],
  ['localStorage', async () => createLocalStorage(new FakeLocalStorage())],
  ['mémoire', async () => createMemoryStorage()],
];

describe.each(backends)('stockage %s', (_, create) => {
  it('lit, écrit et efface un emplacement', async () => {
    const storage = await create();
    expect(await storage.read('main')).toBeNull();
    await storage.write('main', 'abc');
    expect(await storage.read('main')).toBe('abc');
    await storage.remove('main');
    expect(await storage.read('main')).toBeNull();
  });

  it('sauvegarde puis recharge une partie', async () => {
    const storage = await create();
    const state = createInitialState(1);
    state.time.hour = 42;
    await saveGame(storage, state, 1234);
    const result = await loadGame(storage);
    expect(result).toEqual({
      status: 'loaded',
      save: { version: SAVE_VERSION, syncedAtRealMs: 1234, state },
    });
  });
});

describe('chargement', () => {
  it('signale une partie absente', async () => {
    expect(await loadGame(createMemoryStorage())).toEqual({ status: 'empty' });
  });

  it('met de côté une sauvegarde corrompue', async () => {
    const storage = createMemoryStorage();
    await storage.write('main', '{oups');
    const result = await loadGame(storage);
    expect(result.status).toBe('corrupt');
    expect(await storage.read('main-corrupt')).toBe('{oups');
  });

  it('préfère IndexedDB quand il existe', async () => {
    expect((await openStorage()).backend).toBe('indexeddb');
  });
});
