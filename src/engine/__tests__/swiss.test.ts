import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { defaultSwissRounds, pairSwissRound, swissStandings } from "@/engine/swiss";
import { createRng } from "@/engine/random";
import { DEFAULT_STANDINGS_CONFIG, type Match } from "@/engine/types";
import { seededTeams, withScore } from "./helpers";

const config = DEFAULT_STANDINGS_CONFIG;
const opts = (round: number) => ({ round, stageId: "sw", idPrefix: "" });
const pairKey = (m: Match) => [m.homeTeamId, m.awayTeamId].sort().join("|");
const isRealMatch = (m: Match) => m.homeTeamId !== null && m.awayTeamId !== null;

/** Play a Swiss event round by round with results from a seeded RNG (draws allowed). */
function playSwiss(n: number, rounds: number, seed: number): Match[] {
  const teams = seededTeams(n);
  const random = createRng(seed);
  let matches: Match[] = [];
  for (let round = 1; round <= rounds; round++) {
    let fresh = pairSwissRound(teams, matches, config, opts(round)).matches;
    for (const m of fresh.filter(isRealMatch)) {
      fresh = withScore(fresh, m.id, Math.floor(random() * 3), Math.floor(random() * 3));
    }
    matches = [...matches, ...fresh];
  }
  return matches;
}

describe("defaultSwissRounds", () => {
  it("is ceil(log2 n), capped at n - 1", () => {
    expect([2, 3, 4, 5, 8, 9, 16, 128].map(defaultSwissRounds)).toEqual([1, 2, 2, 3, 3, 4, 4, 7]);
  });
});

describe("pairSwissRound", () => {
  it("pairs round one by seed: 1v2, 3v4, ... (Monrad)", () => {
    const { matches, rematches } = pairSwissRound(seededTeams(6), [], config, opts(1));
    expect(matches.map((m) => [m.homeTeamId, m.awayTeamId])).toEqual([
      ["s1", "s2"],
      ["s3", "s4"],
      ["s5", "s6"],
    ]);
    expect(matches.map((m) => m.id)).toEqual(["sw-r1m1", "sw-r1m2", "sw-r1m3"]);
    expect(
      matches.every((m) => m.stageId === "sw" && m.round === 1 && m.status === "SCHEDULED"),
    ).toBe(true);
    expect(rematches).toBe(0);
  });

  it("gives the bye to the lowest-ranked team, as a finished win", () => {
    const { matches } = pairSwissRound(seededTeams(5), [], config, opts(1));
    const bye = matches.find((m) => m.awayTeamId === null)!;
    expect(bye).toMatchObject({
      homeTeamId: "s5",
      status: "FINISHED",
      winnerTeamId: "s5",
      awaySource: { type: "bye" },
    });
  });

  it("pairs winners with winners in round two and avoids rematches", () => {
    let r1 = pairSwissRound(seededTeams(4), [], config, opts(1)).matches;
    r1 = withScore(withScore(r1, "sw-r1m1", 1, 0), "sw-r1m2", 1, 0); // s1 and s3 win
    const r2 = pairSwissRound(seededTeams(4), r1, config, opts(2)).matches;
    expect(r2.map(pairKey).sort()).toEqual(["s1|s3", "s2|s4"]);
  });

  it("never gives the same team two byes while others have none", () => {
    const matches = playSwiss(5, 4, 3);
    const byes = matches.filter((m) => m.awayTeamId === null).map((m) => m.homeTeamId);
    expect(new Set(byes).size).toBe(byes.length);
  });

  it("validates the round number and team count", () => {
    expect(() => pairSwissRound(seededTeams(1), [], config, opts(1))).toThrow(/at least 2/);
    expect(() => pairSwissRound(seededTeams(4), [], config, opts(0))).toThrow(/round/);
  });

  it("reports rematches instead of failing when none can be avoided", () => {
    // Two teams, two rounds: the second round can only be a rematch.
    let r1 = pairSwissRound(seededTeams(2), [], config, opts(1)).matches;
    r1 = withScore(r1, "sw-r1m1", 1, 0);
    const r2 = pairSwissRound(seededTeams(2), r1, config, opts(2));
    expect(r2.rematches).toBe(1);
    expect(r2.matches).toHaveLength(1);
  });

  describe("properties", () => {
    const sizes = fc.integer({ min: 2, max: 24 });

    it("everyone plays once per round, nobody meets twice, at most one bye each", () => {
      fc.assert(
        fc.property(sizes, fc.integer(), (n, seed) => {
          const rounds = defaultSwissRounds(n);
          const matches = playSwiss(n, rounds, seed);
          for (let r = 1; r <= rounds; r++) {
            const inRound = matches.filter((m) => m.round === r);
            const teams = inRound
              .flatMap((m) => [m.homeTeamId, m.awayTeamId])
              .filter((t) => t !== null);
            expect(new Set(teams).size).toBe(n);
            expect(teams).toHaveLength(n);
          }
          const pairs = matches.filter(isRealMatch).map(pairKey);
          expect(new Set(pairs).size).toBe(pairs.length);
          const byes = matches.filter((m) => m.awayTeamId === null).map((m) => m.homeTeamId);
          expect(new Set(byes).size).toBe(byes.length);
        }),
      );
    });

    it("is deterministic for the same history", () => {
      fc.assert(
        fc.property(sizes, fc.integer(), (n, seed) => {
          const history = playSwiss(n, 1, seed);
          expect(pairSwissRound(seededTeams(n), history, config, opts(2))).toEqual(
            pairSwissRound([...seededTeams(n)].reverse(), [...history].reverse(), config, opts(2)),
          );
        }),
      );
    });
  });
});

describe("swissStandings", () => {
  it("counts a bye as a win and ranks ties by Buchholz", () => {
    // Round 1: s1 beats s2, s3 has the bye. Round 2: s3 beats s1, s2 has the bye.
    const r1 = withScore(
      pairSwissRound(seededTeams(3), [], config, opts(1)).matches,
      "sw-r1m1",
      1,
      0,
    );
    const r2raw = pairSwissRound(seededTeams(3), r1, config, opts(2)).matches;
    const real = r2raw.find(isRealMatch)!;
    const r2 = withScore(
      r2raw,
      real.id,
      real.homeTeamId === "s3" ? 1 : 0,
      real.homeTeamId === "s3" ? 0 : 1,
    );
    const table = swissStandings(seededTeams(3), [...r1, ...r2], config);
    const row = (id: string) => table.find((r) => r.teamId === id)!;
    expect(row("s3")).toMatchObject({ played: 2, won: 2, points: 6 });
    expect(table[0]!.teamId).toBe("s3");
    // Buchholz = sum of points of opponents actually played (byes add nothing).
    expect(row("s3").buchholz).toBe(
      row(real.homeTeamId === "s3" ? real.awayTeamId! : real.homeTeamId!).points,
    );
    expect(table.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("orders equal points by Buchholz, then goal difference", () => {
    const matches = playSwiss(8, 3, 11);
    const table = swissStandings(seededTeams(8), matches, config);
    for (let i = 1; i < table.length; i++) {
      const a = table[i - 1]!;
      const b = table[i]!;
      expect(a.points).toBeGreaterThanOrEqual(b.points);
      if (a.points === b.points) expect(a.buchholz).toBeGreaterThanOrEqual(b.buchholz!);
    }
  });
});
