import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { generateRoundRobin } from "@/engine/round-robin";
import type { Fixture } from "@/engine/types";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`);
const pairKey = (f: Fixture) => [f.homeTeamId, f.awayTeamId].sort().join("|");
const teamCount = fc.integer({ min: 2, max: 24 });
const legs = fc.constantFrom(1 as const, 2 as const);

/** Home/away sequence of a team in one leg, ignoring rounds where it has a bye. */
function venues(fixtures: Fixture[], teamId: string, leg: number): string[] {
  return fixtures
    .filter((f) => f.leg === leg && (f.homeTeamId === teamId || f.awayTeamId === teamId))
    .sort((a, b) => a.round - b.round)
    .map((f) => (f.homeTeamId === teamId ? "H" : "A"));
}

function longestRun(seq: string[]): number {
  let best = 0;
  let run = 0;
  seq.forEach((v, i) => {
    run = i > 0 && seq[i - 1] === v ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

describe("generateRoundRobin", () => {
  it("pairs 4 teams over 3 rounds with 2 matches each", () => {
    const { fixtures, byes, rounds } = generateRoundRobin(ids(4));
    expect(rounds).toBe(3);
    expect(byes).toEqual([]);
    expect(fixtures).toHaveLength(6);
    for (let r = 1; r <= 3; r++) expect(fixtures.filter((f) => f.round === r)).toHaveLength(2);
  });

  it("gives one bye per round for 5 teams and every team exactly one bye", () => {
    const { fixtures, byes, rounds } = generateRoundRobin(ids(5));
    expect(rounds).toBe(5);
    expect(fixtures).toHaveLength(10);
    expect(byes.map((b) => b.round)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(byes.map((b) => b.teamId)).size).toBe(5);
  });

  it("handles the minimum of 2 teams", () => {
    const { fixtures, rounds } = generateRoundRobin(["a", "b"], { legs: 2 });
    expect(rounds).toBe(2);
    expect(fixtures).toEqual([
      { round: 1, leg: 1, homeTeamId: expect.any(String), awayTeamId: expect.any(String) },
      {
        round: 2,
        leg: 2,
        homeTeamId: fixtures[0]!.awayTeamId,
        awayTeamId: fixtures[0]!.homeTeamId,
      },
    ]);
  });

  it("rejects fewer than 2 teams and duplicate ids", () => {
    expect(() => generateRoundRobin(["a"])).toThrow(/at least 2/);
    expect(() => generateRoundRobin(["a", "b", "a"])).toThrow(/duplicate/i);
  });

  it("is deterministic for a seed and shuffles differently for different seeds", () => {
    const teams = ids(10);
    const a = generateRoundRobin(teams, { seed: 42 });
    expect(generateRoundRobin(teams, { seed: 42 })).toEqual(a);
    const seeds = [1, 2, 3, 4, 5].map((seed) =>
      JSON.stringify(generateRoundRobin(teams, { seed })),
    );
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it("keeps the input order when no seed is given", () => {
    const { fixtures } = generateRoundRobin(ids(4));
    expect(
      fixtures.filter((f) => f.round === 1).flatMap((f) => [f.homeTeamId, f.awayTeamId]),
    ).toContain("t4");
    expect(generateRoundRobin(ids(4))).toEqual(generateRoundRobin(ids(4)));
  });

  describe("properties", () => {
    it("every pair meets exactly `legs` times", () => {
      fc.assert(
        fc.property(teamCount, legs, fc.option(fc.integer()), (n, l, seed) => {
          const { fixtures } = generateRoundRobin(ids(n), { legs: l, seed: seed ?? undefined });
          const counts = new Map<string, number>();
          fixtures.forEach((f) => counts.set(pairKey(f), (counts.get(pairKey(f)) ?? 0) + 1));
          expect(counts.size).toBe((n * (n - 1)) / 2);
          for (const c of counts.values()) expect(c).toBe(l);
          for (const f of fixtures) expect(f.homeTeamId).not.toBe(f.awayTeamId);
        }),
      );
    });

    it("no team plays twice in a round, and byes never clash with a match", () => {
      fc.assert(
        fc.property(teamCount, legs, (n, l) => {
          const { fixtures, byes, rounds } = generateRoundRobin(ids(n), { legs: l });
          for (let r = 1; r <= rounds; r++) {
            const playing = fixtures
              .filter((f) => f.round === r)
              .flatMap((f) => [f.homeTeamId, f.awayTeamId]);
            const resting = byes.filter((b) => b.round === r).map((b) => b.teamId);
            expect(new Set([...playing, ...resting]).size).toBe(playing.length + resting.length);
            expect(playing.length + resting.length).toBe(n);
          }
        }),
      );
    });

    it("uses n-1 rounds per leg for even n and n rounds per leg for odd n", () => {
      fc.assert(
        fc.property(teamCount, legs, (n, l) => {
          const { rounds, fixtures, byes } = generateRoundRobin(ids(n), { legs: l });
          expect(rounds).toBe((n % 2 === 0 ? n - 1 : n) * l);
          expect(Math.max(...fixtures.map((f) => f.round))).toBe(rounds);
          expect(byes).toHaveLength(n % 2 === 0 ? 0 : n * l);
        }),
      );
    });

    it("balances home and away: at most 2 in a row and a difference of at most 1 per leg", () => {
      fc.assert(
        fc.property(teamCount, legs, (n, l) => {
          const teams = ids(n);
          const { fixtures } = generateRoundRobin(teams, { legs: l });
          for (const t of teams) {
            for (let leg = 1; leg <= l; leg++) {
              const seq = venues(fixtures, t, leg);
              expect(longestRun(seq)).toBeLessThanOrEqual(2);
              const home = seq.filter((v) => v === "H").length;
              expect(Math.abs(2 * home - seq.length)).toBeLessThanOrEqual(1);
            }
          }
        }),
      );
    });

    it("second leg mirrors the first with home and away swapped", () => {
      fc.assert(
        fc.property(teamCount, (n) => {
          const { fixtures, rounds } = generateRoundRobin(ids(n), { legs: 2 });
          const perLeg = rounds / 2;
          const first = fixtures.filter((f) => f.leg === 1);
          const second = fixtures.filter((f) => f.leg === 2);
          expect(second).toEqual(
            first.map((f) => ({
              round: f.round + perLeg,
              leg: 2,
              homeTeamId: f.awayTeamId,
              awayTeamId: f.homeTeamId,
            })),
          );
        }),
      );
    });
  });
});
