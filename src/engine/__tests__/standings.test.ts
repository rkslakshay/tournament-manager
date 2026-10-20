import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { computeStandings, tallyStandings } from "@/engine/standings";
import { createMatch } from "@/engine/match";
import { DEFAULT_STANDINGS_CONFIG } from "@/engine/types";
import { makeTeams, played } from "./helpers";

const config = DEFAULT_STANDINGS_CONFIG;

describe("tallyStandings", () => {
  it("counts played, W/D/L, goals and points", () => {
    const teams = makeTeams("a", "b", "c");
    const rows = tallyStandings(
      teams,
      [played("a", "b", 2, 0), played("b", "c", 1, 1), played("c", "a", 3, 1)],
      config,
    );
    expect(rows.get("a")).toMatchObject({
      played: 2,
      won: 1,
      drawn: 0,
      lost: 1,
      goalsFor: 3,
      goalsAgainst: 3,
      goalDifference: 0,
      points: 3,
    });
    expect(rows.get("b")).toMatchObject({
      played: 2,
      won: 0,
      drawn: 1,
      lost: 1,
      goalsFor: 1,
      goalsAgainst: 3,
      goalDifference: -2,
      points: 1,
    });
    expect(rows.get("c")).toMatchObject({
      played: 2,
      won: 1,
      drawn: 1,
      lost: 0,
      goalsFor: 4,
      goalsAgainst: 2,
      goalDifference: 2,
      points: 4,
    });
  });

  it("ignores unfinished matches, byes and teams outside the table", () => {
    const teams = makeTeams("a", "b");
    const scheduled = createMatch({
      id: "x",
      stageId: "s",
      round: 1,
      position: 1,
      homeTeamId: "a",
      awayTeamId: "b",
    });
    const bye = {
      ...createMatch({ id: "y", stageId: "s", round: 1, position: 2, homeTeamId: "a" }),
      status: "FINISHED" as const,
      winnerTeamId: "a",
    };
    const live = { ...scheduled, id: "z", status: "LIVE" as const, homeScore: 1, awayScore: 0 };
    const rows = tallyStandings(teams, [scheduled, bye, live, played("a", "zz", 5, 0)], config);
    expect(rows.get("a")?.played).toBe(0);
    expect(rows.get("b")?.played).toBe(0);
  });

  it("uses configurable points", () => {
    const teams = makeTeams("a", "b", "c");
    const custom = { ...config, pointsForWin: 2, pointsForDraw: 1, pointsForLoss: -1 };
    const rows = tallyStandings(teams, [played("a", "b", 1, 0), played("b", "c", 2, 2)], custom);
    expect(rows.get("a")?.points).toBe(2);
    expect(rows.get("b")?.points).toBe(0);
    expect(rows.get("c")?.points).toBe(1);
  });
});

describe("computeStandings", () => {
  it("returns one row per team with ranks 1..n ordered by points", () => {
    const teams = makeTeams("a", "b", "c");
    const table = computeStandings(
      teams,
      [played("a", "b", 0, 1), played("b", "c", 2, 0), played("a", "c", 1, 0)],
      config,
    );
    expect(table.map((r) => r.teamId)).toEqual(["b", "a", "c"]);
    expect(table.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("returns all teams on zero when nothing has been played, ordered by seed", () => {
    const table = computeStandings(makeTeams("c", "a", "b"), [], config);
    expect(table.map((r) => r.teamId)).toEqual(["c", "a", "b"]);
    expect(table.every((r) => r.played === 0 && r.points === 0)).toBe(true);
  });

  it("property: totals are consistent for random results", () => {
    const teams = makeTeams("a", "b", "c", "d", "e");
    const ids = teams.map((t) => t.id);
    const matchArb = fc
      .tuple(fc.constantFrom(...ids), fc.constantFrom(...ids), fc.nat(6), fc.nat(6))
      .filter(([h, a]) => h !== a)
      .map(([h, a, hs, as]) => played(h, a, hs, as));
    fc.assert(
      fc.property(fc.array(matchArb, { maxLength: 30 }), (matches) => {
        const table = computeStandings(teams, matches, config);
        const sum = (
          k: "played" | "won" | "lost" | "drawn" | "goalsFor" | "goalsAgainst" | "goalDifference",
        ) => table.reduce((acc, r) => acc + r[k], 0);
        expect(sum("played")).toBe(matches.length * 2);
        expect(sum("won")).toBe(sum("lost"));
        expect(sum("goalsFor")).toBe(sum("goalsAgainst"));
        expect(sum("goalDifference")).toBe(0);
        for (const r of table) {
          expect(r.won + r.drawn + r.lost).toBe(r.played);
          expect(r.points).toBe(3 * r.won + r.drawn);
        }
        for (let i = 1; i < table.length; i++)
          expect(table[i - 1]!.points).toBeGreaterThanOrEqual(table[i]!.points);
      }),
    );
  });
});
