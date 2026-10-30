import { describe, expect, it } from 'vitest';
import { baseProfile } from '../sim/profile';
import type { Bottling } from '../sim/systems/bottling';
import { bottlingName, tastingNote } from './tasting';

const bottling = (overrides: Partial<Bottling> = {}): Bottling => ({
  id: 7,
  ageYears: 12,
  casks: 1,
  singleCaskId: 41,
  caskTypes: ['sherry'],
  profile: { ...baseProfile(), fruity: 45, spicy: 30, quality: 70 },
  caskFactor: 1.2,
  bottled: 400,
  stock: 400,
  bottledHour: 0,
  noteSeed: 1234,
  ...overrides,
});

describe('notes de dégustation', () => {
  it('rédige nez, bouche et finale, toujours la même pour une mise en bouteille', () => {
    const note = tastingNote(bottling());
    expect(note.nose).toMatch(/^Nez : /);
    expect(note.palate).toMatch(/^Bouche /);
    expect(note.finish).toMatch(/^Finale longue et persistante/);
    expect(tastingNote(bottling())).toEqual(note);
    expect(tastingNote(bottling({ noteSeed: 99 }))).not.toEqual(note);
  });

  it('parle du fût et des arômes dominants', () => {
    const note = tastingNote(bottling());
    const sherry = ['raisins secs', 'figue', 'cerise noire', 'fruits confits'];
    expect(sherry.some((w) => note.nose.includes(w))).toBe(true);
    const peated = tastingNote(
      bottling({
        profile: {
          ...baseProfile(),
          peaty: 60,
          fruity: 5,
          sweet: 5,
          spicy: 5,
          floral: 5,
          quality: 40,
        },
      }),
    );
    const smoke = [
      'fumée de tourbe',
      'feu de bois',
      'iode et embruns',
      'algues',
      'cendres chaudes',
    ];
    expect(smoke.some((w) => peated.nose.includes(w))).toBe(true);
    expect(peated.finish).toMatch(/^Finale courte/);
  });

  it('nomme la mise en bouteille', () => {
    expect(bottlingName(bottling())).toBe('Glenheir 12 ans · Single Cask n° 41');
    expect(bottlingName(bottling({ singleCaskId: null, casks: 3 }))).toBe(
      'Glenheir 12 ans · Assemblage de 3 fûts',
    );
  });
});
