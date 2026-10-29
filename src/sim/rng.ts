/**
 * Générateur aléatoire à graine (mulberry32) : la seule source d'aléatoire du jeu.
 * Son état est un simple entier, sérialisable avec la sauvegarde.
 */
export interface Rng {
  /** Nombre dans [0, 1[. */
  next(): number;
  /** Nombre dans [min, max[. */
  range(min: number, max: number): number;
  /** Entier dans [min, max]. */
  int(min: number, max: number): number;
  /** Vrai avec une probabilité `p`. */
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** État courant, à sauvegarder pour reprendre la même suite. */
  readonly state: number;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error('pick sur une liste vide');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    get state() {
      return s;
    },
  };
}
