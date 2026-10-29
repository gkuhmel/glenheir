import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('rng', () => {
  it('rejoue la même suite avec la même graine', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 20 }, a.next)).toEqual(Array.from({ length: 20 }, b.next));
  });

  it('donne des suites différentes avec des graines différentes', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('reprend la suite à partir de son état', () => {
    const a = createRng(7);
    a.next();
    a.next();
    const b = createRng(a.state);
    expect(b.next()).toBe(a.next());
  });

  it('reste dans les bornes', () => {
    const rng = createRng(3);
    for (let i = 0; i < 1000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const n = rng.int(2, 5);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it('couvre toutes les valeurs entières', () => {
    const rng = createRng(9);
    const seen = new Set(Array.from({ length: 200 }, () => rng.int(1, 6)));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
