import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { createRng, shuffle } from "@/engine/random";

describe("createRng", () => {
  it("is deterministic for a seed and stays in [0, 1)", () => {
    const a = createRng(7);
    const b = createRng(7);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe("shuffle", () => {
  it("returns a permutation without mutating the input", () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), fc.integer(), (xs, seed) => {
        const copy = [...xs];
        const out = shuffle(xs, seed);
        expect(xs).toEqual(copy);
        expect([...out].sort((p, q) => p - q)).toEqual([...xs].sort((p, q) => p - q));
      }),
    );
  });

  it("is deterministic for a seed", () => {
    expect(shuffle([1, 2, 3, 4, 5, 6], 3)).toEqual(shuffle([1, 2, 3, 4, 5, 6], 3));
  });
});
