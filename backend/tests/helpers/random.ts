/**
 * A seeded pseudo-random generator for property style tests.
 *
 * Property tests are only useful if a failure can be reproduced, so this uses a
 * fixed seed rather than `Math.random`. A run that fails on CI fails the same
 * way on a laptop.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in `[min, max]`, inclusive. */
export function randomInt(next: () => number, min: number, max: number): number {
  return min + Math.floor(next() * (max - min + 1));
}
