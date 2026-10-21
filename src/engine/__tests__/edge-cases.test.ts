import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { generateDoubleElimination } from "@/engine/double-elimination";
import { assignGroups, generateGroupKnockout } from "@/engine/group-knockout";
import { propagate } from "@/engine/propagation";
import { generateRoundRobin } from "@/engine/round-robin";
import { scheduleMatches } from "@/engine/scheduler";
import { generateSingleElimination } from "@/engine/single-elimination";
import { computeStandings } from "@/engine/standings";
import { DEFAULT_STANDINGS_CONFIG, type Match, type Team } from "@/engine/types";
import { makeTeams, played, seededTeams, seedOf, withScore } from "./helpers";

const config = DEFAULT_STANDINGS_CONFIG;
const ids = (n: number) => seededTeams(n).map((t) => t.id);

/** Play every playable match; `homeWins` picks each result. */
function playOut(matches: Match[], homeWins: (m: Match) => boolean): Match[] {
  let ms = propagate(matches).matches;
  for (;;) {
    const next = ms.find((m) => m.status === "SCHEDULED");
    if (!next) return ms;
    const home = homeWins(next);
    ms = propagate(withScore(ms, next.id, home ? 1 : 0, home ? 0 : 1)).matches;
  }
}

function lossesByTeam(ms: Match[]): Map<string, number> {
  const losses = new Map<string, number>();
  for (const m of ms) {
    if (m.homeScore === null || m.homeTeamId === null || m.awayTeamId === null) continue;
    const loser = m.winnerTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
    losses.set(loser, (losses.get(loser) ?? 0) + 1);
  }
  return losses;
}

const favourite = (m: Match) => seedOf(m.homeTeamId) < seedOf(m.awayTeamId);

describe("team counts at the edges", () => {
  it.each([2, 3, 5, 17])(
    "round robin with %i teams: every pair once, rounds as documented",
    (n) => {
      const { fixtures, rounds, byes } = generateRoundRobin(ids(n));
      expect(fixtures).toHaveLength((n * (n - 1)) / 2);
      expect(rounds).toBe(n % 2 === 0 ? n - 1 : n);
      expect(byes).toHaveLength(n % 2 === 0 ? 0 : n);
    },
  );

  it("round robin at the 128-team maximum", () => {
    const { fixtures, rounds } = generateRoundRobin(ids(128));
    expect(rounds).toBe(127);
    expect(new Set(fixtures.map((f) => [f.homeTeamId, f.awayTeamId].sort().join())).size).toBe(
      8128,
    );
  });

  it.each([2, 3, 5, 17, 128])(
    "single elimination with %i teams finishes with seed 1 champion",
    (n) => {
      const ms = playOut(
        generateSingleElimination(seededTeams(n), { thirdPlaceMatch: true }),
        favourite,
      );
      expect(ms.every((m) => m.status === "FINISHED")).toBe(true);
      const finalRound = Math.max(...ms.map((m) => m.round));
      expect(ms.find((m) => m.round === finalRound && m.position === 1)?.winnerTeamId).toBe("s1");
    },
  );

  it.each([2, 3, 5, 17, 128])(
    "double elimination with %i teams: everyone but the champion loses twice",
    (n) => {
      const ms = playOut(generateDoubleElimination(seededTeams(n)), favourite);
      expect(ms.every((m) => m.status === "FINISHED")).toBe(true);
      const losses = lossesByTeam(ms);
      for (const team of ids(n)) expect(losses.get(team) ?? 0).toBe(team === "s1" ? 0 : 2);
    },
  );

  it("groups + knockout with 17 teams in 4 groups: one group of 5, advancers capped by the smallest group", () => {
    const sizes = Object.values(assignGroups(seededTeams(17), 4)).map((g) => g.length);
    expect(sizes.sort()).toEqual([4, 4, 4, 5]);
    expect(() => generateGroupKnockout(seededTeams(17), { groups: 4, advancePerGroup: 5 })).toThrow(
      /between 1 and 4/,
    );
    const { stages } = generateGroupKnockout(seededTeams(17), { groups: 4, advancePerGroup: 4 });
    expect(stages.at(-1)!.matches.filter((m) => m.round === 1)).toHaveLength(8);
  });

  it("scheduler with no slots reports every open match", () => {
    const ms = propagate(generateSingleElimination(seededTeams(4))).matches;
    expect(scheduleMatches(ms, { venues: ["v"], slots: 0, minRestSlots: 0 })).toEqual({
      assignments: [],
      unscheduled: ms.map((m) => m.id),
    });
  });
});

describe("bad team input", () => {
  const dupes: Team[] = [
    { id: "a", name: "A", seed: 1 },
    { id: "b", name: "B", seed: 2 },
    { id: "a", name: "A again", seed: 3 },
  ];

  it("rejects duplicate team ids in every bracket generator", () => {
    expect(() => generateSingleElimination(dupes)).toThrow(/duplicate/i);
    expect(() => generateDoubleElimination(dupes)).toThrow(/duplicate/i);
    expect(() =>
      generateGroupKnockout([...dupes, { id: "c", name: "C", seed: 4 }], {
        groups: 2,
        advancePerGroup: 1,
      }),
    ).toThrow(/duplicate/i);
  });

  it("produces the same bracket for duplicate seeds whatever the input order", () => {
    const teams: Team[] = ["d", "a", "c", "b", "e"].map((id) => ({ id, name: id, seed: 1 }));
    fc.assert(
      fc.property(fc.shuffledSubarray(teams, { minLength: 5, maxLength: 5 }), (shuffled) => {
        expect(generateSingleElimination(shuffled)).toEqual(generateSingleElimination(teams));
        expect(generateDoubleElimination(shuffled)).toEqual(generateDoubleElimination(teams));
        expect(assignGroups(shuffled, 2)).toEqual(assignGroups(teams, 2));
      }),
    );
  });
});

describe("standings corner cases", () => {
  it("all draws: everyone level on points, ordered by seed", () => {
    const teams = makeTeams("c", "a", "b", "d");
    const pairs: Array<[string, string]> = [
      ["c", "a"],
      ["c", "b"],
      ["c", "d"],
      ["a", "b"],
      ["a", "d"],
      ["b", "d"],
    ];
    const table = computeStandings(
      teams,
      pairs.map(([h, a]) => played(h, a, 0, 0)),
      config,
    );
    expect(table.map((r) => [r.teamId, r.played, r.drawn, r.points])).toEqual([
      ["c", 3, 3, 3],
      ["a", 3, 3, 3],
      ["b", 3, 3, 3],
      ["d", 3, 3, 3],
    ]);
  });

  it("perfect 4-way cycle with identical scores falls through to seed", () => {
    // a > b > c > d > a, all 1-0, and the two cross games drawn 0-0: every team W1 D1 L1, GD 0.
    const teams = makeTeams("a", "b", "c", "d");
    const matches = [
      played("a", "b", 1, 0),
      played("b", "c", 1, 0),
      played("c", "d", 1, 0),
      played("d", "a", 1, 0),
      played("a", "c", 0, 0),
      played("b", "d", 0, 0),
    ];
    const table = computeStandings(teams, matches, config);
    expect(table.map((r) => r.points)).toEqual([4, 4, 4, 4]);
    expect(table.map((r) => r.teamId)).toEqual(["a", "b", "c", "d"]);
  });

  it("3-way cycle without seed in the chain falls back to names, then ids", () => {
    const teams: Team[] = [
      { id: "z", name: "Same", seed: 1 },
      { id: "y", name: "Same", seed: 2 },
      { id: "x", name: "Alpha", seed: 3 },
    ];
    const matches = [played("z", "y", 1, 0), played("y", "x", 1, 0), played("x", "z", 1, 0)];
    const table = computeStandings(teams, matches, {
      ...config,
      tiebreakers: ["points", "headToHead", "alphabetical"],
    });
    expect(table.map((r) => r.teamId)).toEqual(["x", "y", "z"]);
  });
});

describe("deep edits in a double-elimination bracket", () => {
  it("flipping a round-one result after the whole bracket is played resets every affected match and replays cleanly", () => {
    const full = playOut(generateDoubleElimination(seededTeams(8)), favourite);
    const flipped = full.map((m) =>
      m.id === "w1m1" ? { ...m, homeScore: 0, awayScore: 1, winnerTeamId: m.awayTeamId } : m,
    );
    const { matches, invalidated } = propagate(flipped);

    // Seed 8 now advances in the winners bracket and seed 1 drops: their paths are invalidated,
    // all the way to the grand final.
    expect(invalidated).toEqual(expect.arrayContaining(["w2m1", "w3m1", "l1m1", "gf1"]));
    for (const id of invalidated) {
      const m = matches.find((x) => x.id === id)!;
      expect(m.homeScore).toBeNull();
      expect(m.status).not.toBe("FINISHED");
    }
    // Untouched results stay.
    expect(matches.find((m) => m.id === "w1m2")).toEqual(full.find((m) => m.id === "w1m2"));
    // The grand-final reset can no longer be "not needed".
    expect(matches.find((m) => m.id === "gf2")!.status).toBe("PENDING");
    // Propagation is stable, and replaying still eliminates everyone after two losses.
    expect(propagate(matches).invalidated).toEqual([]);
    const replayed = playOut(matches, favourite);
    const losses = lossesByTeam(replayed);
    const champion =
      replayed.find((m) => m.id === "gf2")!.winnerTeamId ??
      replayed.find((m) => m.id === "gf1")!.winnerTeamId;
    for (const team of ids(8))
      expect(losses.get(team) ?? 0).toBe(team === champion ? (losses.get(team) ?? 0) : 2);
    expect(losses.get(champion as string) ?? 0).toBeLessThanOrEqual(1);
  });

  it("editing the first grand final so the losers champion wins brings the reset match back", () => {
    const full = playOut(generateDoubleElimination(seededTeams(4)), favourite);
    expect(full.find((m) => m.id === "gf2")).toMatchObject({
      status: "FINISHED",
      homeTeamId: null,
    });
    const gf1 = full.find((m) => m.id === "gf1")!;
    const upset = full.map((m) =>
      m.id === "gf1" ? { ...m, homeScore: 0, awayScore: 1, winnerTeamId: gf1.awayTeamId } : m,
    );
    const { matches, invalidated } = propagate(upset);
    expect(invalidated).toEqual([]);
    expect(matches.find((m) => m.id === "gf2")).toMatchObject({
      status: "SCHEDULED",
      homeTeamId: "s1",
      awayTeamId: gf1.awayTeamId,
    });
  });
});
