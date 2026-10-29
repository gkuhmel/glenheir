/** Stockage clé → texte des sauvegardes, quel que soit le support. */
export interface SaveStorage {
  readonly backend: 'indexeddb' | 'localstorage' | 'memory';
  read(slot: string): Promise<string | null>;
  write(slot: string, text: string): Promise<void>;
  remove(slot: string): Promise<void>;
}

/** Emplacement unique du MVP ; d'autres noms pourront s'ajouter plus tard. */
export const MAIN_SLOT = 'main';

const DB_NAME = 'glenheir';
const STORE = 'saves';
const KEY_PREFIX = 'glenheir:save:';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function createIndexedDbStorage(factory: IDBFactory): Promise<SaveStorage> {
  const open = factory.open(DB_NAME, 1);
  open.onupgradeneeded = () => open.result.createObjectStore(STORE);
  const db = await request(open);
  const run = <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) =>
    request(fn(db.transaction(STORE, mode).objectStore(STORE)));
  return {
    backend: 'indexeddb',
    read: async (slot) => {
      const value = await run('readonly', (s) => s.get(slot));
      return typeof value === 'string' ? value : null;
    },
    write: async (slot, text) => {
      await run('readwrite', (s) => s.put(text, slot));
    },
    remove: async (slot) => {
      await run('readwrite', (s) => s.delete(slot));
    },
  };
}

export function createLocalStorage(storage: Storage): SaveStorage {
  return {
    backend: 'localstorage',
    read: async (slot) => storage.getItem(KEY_PREFIX + slot),
    write: async (slot, text) => storage.setItem(KEY_PREFIX + slot, text),
    remove: async (slot) => storage.removeItem(KEY_PREFIX + slot),
  };
}

export function createMemoryStorage(): SaveStorage {
  const data = new Map<string, string>();
  return {
    backend: 'memory',
    read: async (slot) => data.get(slot) ?? null,
    write: async (slot, text) => void data.set(slot, text),
    remove: async (slot) => void data.delete(slot),
  };
}

/** IndexedDB si possible, sinon localStorage, sinon mémoire (aucune persistance). */
export async function openStorage(): Promise<SaveStorage> {
  try {
    if (typeof indexedDB !== 'undefined') return await createIndexedDbStorage(indexedDB);
  } catch (error) {
    console.warn('IndexedDB indisponible, repli sur localStorage', error);
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY_PREFIX + 'probe', '1');
      localStorage.removeItem(KEY_PREFIX + 'probe');
      return createLocalStorage(localStorage);
    }
  } catch (error) {
    console.warn('localStorage indisponible, sauvegarde en mémoire seulement', error);
  }
  return createMemoryStorage();
}
