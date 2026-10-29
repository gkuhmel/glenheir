import { describe, expect, it } from 'vitest';
import { createInitialState } from '../sim/state';
import { runTicks } from '../sim/tick';
import { createEnvelope, parseSave, serializeSave } from './envelope';
import { migrate, SAVE_VERSION } from './migrations';

describe('sauvegarde', () => {
  it('fait l’aller-retour sans perte', () => {
    const state = createInitialState(1);
    runTicks(state, 123);
    const envelope = createEnvelope(state, 1_700_000_000_000);
    expect(parseSave(serializeSave(envelope))).toEqual(envelope);
  });

  it('porte un numéro de version', () => {
    const text = serializeSave(createEnvelope(createInitialState(1), 0));
    expect(JSON.parse(text).version).toBe(SAVE_VERSION);
  });

  it.each([
    ['du texte qui n’est pas du JSON', 'pas du json'],
    ['un tableau', '[]'],
    ['une version absente', JSON.stringify({ syncedAtRealMs: 0, state: createInitialState(1) })],
    ['un horodatage absent', JSON.stringify({ version: 1, state: createInitialState(1) })],
    [
      'une heure négative',
      JSON.stringify({
        version: 1,
        syncedAtRealMs: 0,
        state: { ...createInitialState(1), time: { hour: -1 } },
      }),
    ],
    [
      'une version future',
      JSON.stringify({ version: SAVE_VERSION + 1, syncedAtRealMs: 0, state: {} }),
    ],
  ])('refuse %s', (_, text) => {
    expect(() => parseSave(text)).toThrow();
  });
});

describe('migration v1 → v2', () => {
  it('reprend une partie de l’étape 1 sans la perdre', () => {
    const v1 = JSON.stringify({
      version: 1,
      syncedAtRealMs: 42,
      state: { time: { hour: 500 }, cash: 50_000, renown: 0 },
    });
    const { state, version } = parseSave(v1);
    expect(version).toBe(SAVE_VERSION);
    expect(state.time.hour).toBe(500);
    expect(state.finance).toEqual({ cash: 50_000, loans: [], negativeMonths: 0, bankrupt: false });
    expect(state.staff).toHaveLength(1);
    expect(state.journal).toEqual({ entries: [], monthly: [] });
  });
});

describe('migrations', () => {
  const table = {
    1: (s: unknown) => ({ ...(s as object), gold: 1 }),
    2: (s: unknown) => {
      const { gold, ...rest } = s as { gold: number };
      return { ...rest, cash: gold * 100 };
    },
  };

  it('enchaîne les migrations dans l’ordre', () => {
    expect(migrate({ name: 'x' }, 1, 3, table)).toEqual({ name: 'x', cash: 100 });
  });

  it('ne fait rien quand la version est à jour', () => {
    const state = { a: 1 };
    expect(migrate(state, 3, 3, table)).toBe(state);
  });

  it('échoue s’il manque une étape', () => {
    expect(() => migrate({}, 1, 4, table)).toThrow(/v3/);
  });
});
