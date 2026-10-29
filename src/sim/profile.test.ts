import { describe, expect, it } from 'vitest';
import { addToLot, applyModifier, baseProfile, blend, emptyLot, takeFromLot } from './profile';

describe('profil aromatique', () => {
  it('applique des modificateurs bornés entre 0 et 100', () => {
    const p = applyModifier(baseProfile(), { peaty: 55, quality: 80, woody: -10 });
    expect(p.peaty).toBe(55);
    expect(p.quality).toBe(100);
    expect(p.woody).toBe(0);
  });

  it('mélange deux lots au prorata des quantités', () => {
    const a = { ...baseProfile(), peaty: 0 };
    const b = { ...baseProfile(), peaty: 60 };
    expect(blend(a, 3, b, 1).peaty).toBe(15);
  });

  it('ajoute et prélève dans un lot', () => {
    const lot = emptyLot();
    addToLot(lot, 4, { ...baseProfile(), sweet: 30 });
    addToLot(lot, 4, { ...baseProfile(), sweet: 10 });
    expect(lot).toMatchObject({ amount: 8, profile: { sweet: 20 } });
    expect(takeFromLot(lot, 10).amount).toBe(8);
    expect(lot.amount).toBe(0);
  });
});
