import type { Rng } from './rng';

export type Noise2D = (x: number, y: number) => number;

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Bruit de valeur 2D lissé, à valeurs dans [0, 1], tiré du générateur fourni. */
export function createValueNoise(rng: Rng, size = 256): Noise2D {
  const values = Array.from({ length: size }, () => rng.next());
  const perm = Array.from({ length: size }, (_, i) => i);
  for (let i = size - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [perm[i], perm[j]] = [perm[j] as number, perm[i] as number];
  }
  const mask = size - 1;
  const at = (ix: number, iy: number) =>
    values[perm[((perm[ix & mask] as number) + iy) & mask] as number] as number;

  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const tx = smooth(x - ix);
    const ty = smooth(y - iy);
    return lerp(
      lerp(at(ix, iy), at(ix + 1, iy), tx),
      lerp(at(ix, iy + 1), at(ix + 1, iy + 1), tx),
      ty,
    );
  };
}

/** Somme de plusieurs octaves de bruit (relief plus naturel), dans [0, 1]. */
export function fbm(noise: Noise2D, x: number, y: number, octaves = 4): number {
  let sum = 0;
  let amplitude = 1;
  let total = 0;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * frequency, y * frequency) * amplitude;
    total += amplitude;
    amplitude /= 2;
    frequency *= 2;
  }
  return sum / total;
}
