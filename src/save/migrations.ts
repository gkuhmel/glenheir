/** Une migration transforme l'état sauvegardé de la version N vers N + 1. */
export type Migration = (state: unknown) => unknown;

/** Version actuelle du format de sauvegarde. */
export const SAVE_VERSION = 2;

/**
 * Migrations indexées par version de départ : `migrations[1]` transforme un
 * état v1 en v2. À compléter à chaque changement de forme de `GameState`.
 */
export const migrations: Record<number, Migration> = {
  // v1 → v2 (étape 2) : finances, personnel, journal et générateur aléatoire.
  1: (state) => {
    const old = state as { time: { hour: number }; cash: number; renown: number };
    return {
      rngState: 0x2545f491,
      time: old.time,
      finance: { cash: old.cash, loans: [], negativeMonths: 0, bankrupt: false },
      renown: old.renown,
      staff: [{ id: 1, role: 'worker', level: 1 }],
      journal: { entries: [], monthly: [] },
      nextId: 2,
    };
  },
};

export function migrate(
  state: unknown,
  fromVersion: number,
  toVersion: number = SAVE_VERSION,
  table: Record<number, Migration> = migrations,
): unknown {
  if (fromVersion > toVersion) {
    throw new Error(`sauvegarde plus récente que le jeu (v${fromVersion} > v${toVersion})`);
  }
  let current = state;
  for (let version = fromVersion; version < toVersion; version++) {
    const step = table[version];
    if (!step) throw new Error(`aucune migration depuis la v${version}`);
    current = step(current);
  }
  return current;
}
