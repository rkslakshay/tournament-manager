/**
 * Seeded pseudo-random numbers (mulberry32). The engine never calls `Math.random`, so any
 * randomness is reproducible from a seed.
 *
 * @example
 * const next = createRng(42);
 * next(); // same value every time for seed 42, in [0, 1)
 */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle driven by a seed. Returns a new array.
 *
 * @example
 * shuffle(["a", "b", "c"], 1); // a deterministic permutation of the input
 */
export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const next = createRng(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
