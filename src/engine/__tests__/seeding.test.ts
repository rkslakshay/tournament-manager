import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { bracketSize, firstRoundPairs, seedBracket } from "@/engine/seeding";

const powers = fc.integer({ min: 0, max: 7 }).map((k) => 2 ** k);

describe("bracketSize", () => {
  it("is the next power of two at or above the team count", () => {
    expect([2, 3, 4, 5, 8, 9, 12, 16, 17, 128].map(bracketSize)).toEqual([
      2, 4, 4, 8, 8, 16, 16, 16, 32, 128,
    ]);
  });

  it("rejects fewer than 2 teams", () => {
    expect(() => bracketSize(1)).toThrow(/at least 2/);
  });
});

describe("seedBracket", () => {
  it("returns the standard order for 2, 4 and 8", () => {
    expect(seedBracket(2)).toEqual([1, 2]);
    expect(seedBracket(4)).toEqual([1, 4, 2, 3]);
    expect(seedBracket(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("rejects sizes that are not powers of two", () => {
    expect(() => seedBracket(6)).toThrow(/power of two/);
    expect(() => seedBracket(0)).toThrow(/power of two/);
  });

  it("property: is a permutation of 1..size with first-round pairs summing to size + 1", () => {
    fc.assert(
      fc.property(powers, (size) => {
        const order = seedBracket(size);
        expect([...order].sort((a, b) => a - b)).toEqual(
          Array.from({ length: size }, (_, i) => i + 1),
        );
        if (size === 1) return;
        for (let i = 0; i < size; i += 2) expect(order[i]! + order[i + 1]!).toBe(size + 1);
      }),
    );
  });

  it("property: the top 2^k seeds land in different blocks of size size / 2^k", () => {
    fc.assert(
      fc.property(powers, (size) => {
        const order = seedBracket(size);
        for (let blocks = 1; blocks <= size; blocks *= 2) {
          const blockSize = size / blocks;
          const blockOf = (seed: number) => Math.floor(order.indexOf(seed) / blockSize);
          const used = new Set(Array.from({ length: blocks }, (_, i) => blockOf(i + 1)));
          expect(used.size).toBe(blocks);
        }
      }),
    );
  });

  it("seeds 1 and 2 can only meet in the final", () => {
    const order = seedBracket(16);
    expect(order.indexOf(1) < 8).not.toBe(order.indexOf(2) < 8);
  });
});

describe("firstRoundPairs", () => {
  it("gives byes (null) to the highest seeds", () => {
    expect(firstRoundPairs(5)).toEqual([
      [1, null],
      [4, 5],
      [2, null],
      [3, null],
    ]);
  });

  it("property: the byes are exactly seeds 1..(size - n), and no match has two byes", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 128 }), (n) => {
        const pairs = firstRoundPairs(n);
        const size = bracketSize(n);
        expect(pairs).toHaveLength(size / 2);
        const withBye = pairs.filter(([, away]) => away === null).map(([home]) => home);
        expect(withBye.sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(
          Array.from({ length: size - n }, (_, i) => i + 1),
        );
        for (const [home] of pairs) expect(home).not.toBeNull();
      }),
    );
  });
});
