import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { computeStandings } from "@/engine/standings";
import { rankTeams } from "@/engine/tiebreakers";
import { tallyStandings } from "@/engine/standings";
import { DEFAULT_STANDINGS_CONFIG, type StandingsConfig, type Team } from "@/engine/types";
import { makeTeams, played } from "./helpers";

const config = DEFAULT_STANDINGS_CONFIG;
const order = (
  teams: Team[],
  matches: ReturnType<typeof played>[],
  cfg: StandingsConfig = config,
) => computeStandings(teams, matches, cfg).map((r) => r.teamId);

describe("tiebreaker chain", () => {
  it("head-to-head beats goal difference for two tied teams", () => {
    // a and b both on 3 points; b has the better goal difference but a won the meeting.
    const teams = makeTeams("a", "b", "c");
    const matches = [played("a", "b", 1, 0), played("b", "c", 5, 0)];
    expect(order(teams, matches)).toEqual(["a", "b", "c"]);
  });

  it("three-way cycle with identical scores falls through to overall goal difference", () => {
    // a > b > c > a, all 1-0, so the mini-table is level. Results against d separate them.
    const teams = makeTeams("a", "b", "c", "d");
    const matches = [
      played("a", "b", 1, 0),
      played("b", "c", 1, 0),
      played("c", "a", 1, 0),
      played("a", "d", 1, 0),
      played("b", "d", 3, 0),
      played("c", "d", 2, 0),
    ];
    expect(order(teams, matches)).toEqual(["b", "c", "a", "d"]);
  });

  it("three-way tie split by the mini-table even when overall goal difference disagrees", () => {
    // a, b, c all on 6 points. Mini-table: b beat a 1-0, a beat c 1-0, c beat b 4-0.
    // Mini-table points are level (3 each); mini goal difference: c +3, a 0, b -3.
    // Overall goal difference (thanks to big wins over d and e) would rank b first.
    const teams = makeTeams("a", "b", "c", "d", "e");
    const matches = [
      played("b", "a", 1, 0),
      played("a", "c", 1, 0),
      played("c", "b", 4, 0),
      played("a", "d", 1, 0),
      played("b", "d", 9, 0),
      played("c", "d", 1, 0),
      played("d", "e", 0, 0),
    ];
    expect(order(teams, matches).slice(0, 3)).toEqual(["c", "a", "b"]);
  });

  it("re-applies head-to-head recursively to the tiers a wider mini-table leaves", () => {
    // All four teams on 4 points with 0 goal difference. The 4-way mini-table (here, the whole
    // table) splits them on goals into {b, c} (2 scored) and {a, d} (1 scored). Each pair is then
    // ordered by its own meeting: c beat b, a beat d. Without recursion, wins and seed would give
    // b, c, a, d.
    const teams = makeTeams("a", "b", "c", "d");
    const matches = [
      played("a", "b", 0, 1),
      played("a", "c", 0, 0),
      played("a", "d", 1, 0),
      played("b", "c", 1, 2),
      played("b", "d", 0, 0),
      played("c", "d", 0, 1),
    ];
    expect(order(teams, matches)).toEqual(["c", "b", "a", "d"]);
  });

  it("falls back to seed, then alphabetical, and always yields a total order", () => {
    const teams: Team[] = [
      { id: "x", name: "Zebras", seed: 2 },
      { id: "y", name: "Ants", seed: 1 },
    ];
    expect(order(teams, [])).toEqual(["y", "x"]);
    const noSeed = { ...config, tiebreakers: config.tiebreakers.filter((t) => t !== "seed") };
    const sameSeed = teams.map((t) => ({ ...t, seed: 1 }));
    expect(order(sameSeed, [], noSeed)).toEqual(["y", "x"]);
    expect(order(sameSeed, [], { ...config, tiebreakers: [] })).toEqual(["x", "y"]);
  });

  it("supports wins and goalsFor criteria and custom chains", () => {
    const teams = makeTeams("a", "b", "c");
    // Without "points" in the chain: a and b both have 1 win, a scored more goals.
    const matches = [played("a", "c", 4, 0), played("b", "a", 1, 0), played("c", "b", 0, 0)];
    const winsFirst: StandingsConfig = { ...config, tiebreakers: ["wins", "goalsFor"] };
    expect(order(teams, matches, winsFirst)).toEqual(["a", "b", "c"]);
    const goalsFirst: StandingsConfig = { ...config, tiebreakers: ["goalsFor"] };
    expect(order(teams, matches, goalsFirst)).toEqual(["a", "b", "c"]);
  });

  it("rankTeams exposes the raw ordering", () => {
    const teams = makeTeams("a", "b");
    const matches = [played("b", "a", 2, 0)];
    expect(rankTeams(teams, tallyStandings(teams, matches, config), matches, config)).toEqual([
      "b",
      "a",
    ]);
  });

  describe("properties", () => {
    const teams = makeTeams("a", "b", "c", "d", "e");
    const ids = teams.map((t) => t.id);
    const matchArb = fc
      .tuple(fc.constantFrom(...ids), fc.constantFrom(...ids), fc.nat(3), fc.nat(3))
      .filter(([h, a]) => h !== a)
      .map(([h, a, hs, as]) => played(h, a, hs, as));

    it("ranks are a permutation and the order does not depend on input order", () => {
      fc.assert(
        fc.property(fc.array(matchArb, { maxLength: 20 }), fc.integer(), (matches, salt) => {
          const table = computeStandings(teams, matches, config);
          expect(table.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
          const shuffledTeams = [...teams].sort(
            (x, y) => ((x.id.charCodeAt(0) * salt) % 7) - ((y.id.charCodeAt(0) * salt) % 7),
          );
          const reversed = [...matches].reverse();
          expect(computeStandings(shuffledTeams, reversed, config).map((r) => r.teamId)).toEqual(
            table.map((r) => r.teamId),
          );
        }),
      );
    });

    it("points are always non-increasing down the table", () => {
      fc.assert(
        fc.property(fc.array(matchArb, { maxLength: 20 }), (matches) => {
          const table = computeStandings(teams, matches, config);
          for (let i = 1; i < table.length; i++)
            expect(table[i - 1]!.points).toBeGreaterThanOrEqual(table[i]!.points);
        }),
      );
    });
  });
});
