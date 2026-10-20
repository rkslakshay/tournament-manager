import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { propagate } from "@/engine/propagation";
import { createMatch } from "@/engine/match";
import { generateSingleElimination } from "@/engine/single-elimination";
import type { Match, Source } from "@/engine/types";
import { seededTeams, seedOf, withScore } from "./helpers";

const get = (ms: Match[], id: string) => ms.find((m) => m.id === id) as Match;
const run = (ms: Match[]) => propagate(ms).matches;
const team = (teamId: string): Source => ({ type: "team", teamId });
const winner = (matchId: string): Source => ({ type: "winner", matchId });
const loser = (matchId: string): Source => ({ type: "loser", matchId });
const bye: Source = { type: "bye" };

function sourced(
  id: string,
  homeSource: Source,
  awaySource: Source,
  extra: Partial<Match> = {},
): Match {
  return {
    ...createMatch({ id, stageId: "s", round: 1, position: 1, homeSource, awaySource }),
    ...extra,
  };
}

/** Play every playable match with the given rule until nothing is left. */
function playOut(matches: Match[], homeWins: (m: Match) => boolean): Match[] {
  let ms = run(matches);
  for (;;) {
    const next = ms.find((m) => m.status === "SCHEDULED");
    if (!next) return ms;
    const home = homeWins(next);
    ms = run(withScore(ms, next.id, home ? 1 : 0, home ? 0 : 1));
  }
}

function reopen(ms: Match[], id: string): Match[] {
  return ms.map((m) =>
    m.id === id
      ? { ...m, status: "SCHEDULED" as const, homeScore: null, awayScore: null, winnerTeamId: null }
      : m,
  );
}

describe("propagate", () => {
  it("advances winners into the next round", () => {
    let ms = run(generateSingleElimination(seededTeams(8)));
    ms = run(withScore(ms, "r1m1", 2, 0));
    expect(get(ms, "r2m1")).toMatchObject({
      homeTeamId: "s1",
      awayTeamId: null,
      status: "PENDING",
    });
    ms = run(withScore(ms, "r1m2", 0, 1));
    expect(get(ms, "r2m1")).toMatchObject({
      homeTeamId: "s1",
      awayTeamId: "s5",
      status: "SCHEDULED",
    });
  });

  it("advances bye winners immediately", () => {
    const ms = run(generateSingleElimination(seededTeams(6)));
    expect(get(ms, "r2m1").homeTeamId).toBe("s1");
    expect(get(ms, "r2m2").homeTeamId).toBe("s2");
  });

  it("routes semi-final losers into the third-place match", () => {
    let ms = run(generateSingleElimination(seededTeams(4), { thirdPlaceMatch: true }));
    ms = run(withScore(withScore(ms, "r1m1", 1, 0), "r1m2", 0, 3));
    expect(get(ms, "3rd")).toMatchObject({
      homeTeamId: "s4",
      awayTeamId: "s2",
      status: "SCHEDULED",
    });
    expect(get(ms, "r2m1")).toMatchObject({ homeTeamId: "s1", awayTeamId: "s3" });
  });

  it("re-resolves unplayed downstream matches when a result is edited", () => {
    const ms = run(withScore(run(generateSingleElimination(seededTeams(4))), "r1m1", 1, 0));
    expect(get(ms, "r2m1").homeTeamId).toBe("s1");
    const result = propagate(withScore(ms, "r1m1", 0, 1));
    expect(get(result.matches, "r2m1").homeTeamId).toBe("s4");
    expect(result.invalidated).toEqual([]);
  });

  it("reports and resets downstream matches that already have results", () => {
    let ms = run(generateSingleElimination(seededTeams(4), { thirdPlaceMatch: true }));
    ms = run(withScore(withScore(ms, "r1m1", 1, 0), "r1m2", 1, 0));
    ms = run(withScore(withScore(ms, "r2m1", 2, 1), "3rd", 0, 1));
    const result = propagate(withScore(ms, "r1m1", 0, 1));
    expect(result.invalidated).toEqual(["r2m1", "3rd"]);
    expect(get(result.matches, "r2m1")).toMatchObject({
      homeTeamId: "s4",
      awayTeamId: "s2",
      status: "SCHEDULED",
      homeScore: null,
      winnerTeamId: null,
    });
    expect(get(result.matches, "3rd")).toMatchObject({
      homeTeamId: "s1",
      awayTeamId: "s3",
      status: "SCHEDULED",
    });
  });

  it("cascades invalidation when an upstream reset makes a participant unknown", () => {
    const ms = playOut(generateSingleElimination(seededTeams(8)), () => true);
    expect(get(ms, "r3m1").status).toBe("FINISHED");
    const result = propagate(reopen(ms, "r1m1"));
    expect(result.invalidated).toEqual(["r2m1", "r3m1"]);
    expect(get(result.matches, "r2m1")).toMatchObject({
      homeTeamId: null,
      awayTeamId: "s4",
      status: "PENDING",
    });
    expect(get(result.matches, "r3m1")).toMatchObject({
      homeTeamId: null,
      awayTeamId: "s2",
      status: "PENDING",
    });
  });

  it("treats a LIVE downstream match whose participants change as invalidated", () => {
    let ms = run(
      withScore(
        withScore(run(generateSingleElimination(seededTeams(4))), "r1m1", 1, 0),
        "r1m2",
        1,
        0,
      ),
    );
    ms = ms.map((m) => (m.id === "r2m1" ? { ...m, status: "LIVE" as const } : m));
    const result = propagate(withScore(ms, "r1m2", 0, 1));
    expect(result.invalidated).toEqual(["r2m1"]);
    expect(get(result.matches, "r2m1")).toMatchObject({ awayTeamId: "s3", status: "SCHEDULED" });
  });

  it("keeps LIVE matches whose participants are unchanged", () => {
    let ms = run(
      withScore(
        withScore(run(generateSingleElimination(seededTeams(4))), "r1m1", 1, 0),
        "r1m2",
        1,
        0,
      ),
    );
    ms = ms.map((m) => (m.id === "r2m1" ? { ...m, status: "LIVE" as const } : m));
    expect(get(run(ms), "r2m1").status).toBe("LIVE");
  });

  it("turns a loser-of-bye into a bye, and a double bye into a match that is not needed", () => {
    const ms = run([
      sourced("b1", team("x"), bye),
      sourced("b2", team("y"), bye),
      sourced("l1", loser("b1"), loser("b2")),
      sourced("l2", winner("l1"), team("z")),
    ]);
    expect(get(ms, "b1")).toMatchObject({ status: "FINISHED", winnerTeamId: "x" });
    expect(get(ms, "l1")).toMatchObject({
      status: "FINISHED",
      homeTeamId: null,
      awayTeamId: null,
      winnerTeamId: null,
    });
    expect(get(ms, "l2")).toMatchObject({
      status: "FINISHED",
      homeTeamId: null,
      awayTeamId: "z",
      winnerTeamId: "z",
    });
  });

  it("re-opens an auto-finished match when its bye slot becomes a real team", () => {
    const ms = run([sourced("g", { type: "groupRank", group: "A", rank: 2 }, team("z"))]);
    const asBye = propagate(ms, { groupRankings: { A: ["a1"] } }).matches;
    expect(get(asBye, "g")).toMatchObject({ status: "FINISHED", winnerTeamId: "z" });
    const real = propagate(asBye, { groupRankings: { A: ["a1", "a2"] } });
    expect(get(real.matches, "g")).toMatchObject({
      status: "SCHEDULED",
      homeTeamId: "a2",
      winnerTeamId: null,
    });
    expect(real.invalidated).toEqual([]);
  });

  it("waits when one slot is a bye and the other is still unknown", () => {
    const ms = run([sourced("a", team("x"), team("y")), sourced("b", winner("a"), bye)]);
    expect(get(ms, "b")).toMatchObject({ status: "PENDING", homeTeamId: null });
  });

  it("does not advance anyone from a drawn knockout match without a winner", () => {
    const drawn = {
      status: "FINISHED" as const,
      homeTeamId: "x",
      awayTeamId: "y",
      homeScore: 1,
      awayScore: 1,
    };
    const result = propagate([
      sourced("a", team("x"), team("y"), drawn),
      sourced("b", winner("a"), loser("a")),
    ]);
    expect(result.invalidated).toEqual([]);
    expect(get(result.matches, "a")).toMatchObject(drawn);
    expect(get(result.matches, "b")).toMatchObject({
      status: "PENDING",
      homeTeamId: null,
      awayTeamId: null,
    });
  });

  it("resolves group-rank sources only for groups whose ranking is supplied", () => {
    const ko = sourced(
      "k",
      { type: "groupRank", group: "A", rank: 1 },
      { type: "groupRank", group: "B", rank: 2 },
    );
    expect(propagate([ko], { groupRankings: { A: ["a1", "a2"] } }).matches[0]).toMatchObject({
      homeTeamId: "a1",
      awayTeamId: null,
      status: "PENDING",
    });
    expect(
      propagate([ko], { groupRankings: { A: ["a1", "a2"], B: ["b1", "b2"] } }).matches[0],
    ).toMatchObject({
      homeTeamId: "a1",
      awayTeamId: "b2",
      status: "SCHEDULED",
    });
    expect(propagate([ko], { groupRankings: { A: ["a1"], B: ["b1"] } }).matches[0]).toMatchObject({
      status: "FINISHED",
      winnerTeamId: "a1",
    });
  });

  it("leaves matches without sources (round robin) untouched", () => {
    const rr = createMatch({
      id: "rr",
      stageId: "s",
      round: 1,
      position: 1,
      homeTeamId: "a",
      awayTeamId: "b",
    });
    expect(run([rr])).toEqual([rr]);
  });

  it("skips the grand-final reset unless the losers-bracket champion wins the first final", () => {
    const gf1 = sourced("gf1", team("w"), team("l"), { bracket: "GRAND_FINAL" });
    const gf2 = sourced("gf2", loser("gf1"), winner("gf1"), { bracket: "GRAND_FINAL", round: 2 });
    const base = run([gf1, gf2]);
    expect(get(base, "gf2").status).toBe("PENDING");
    const holds = run(withScore(base, "gf1", 2, 0));
    expect(get(holds, "gf2")).toMatchObject({
      status: "FINISHED",
      homeTeamId: null,
      awayTeamId: null,
      winnerTeamId: null,
    });
    const upset = run(withScore(base, "gf1", 0, 2));
    expect(get(upset, "gf2")).toMatchObject({
      status: "SCHEDULED",
      homeTeamId: "w",
      awayTeamId: "l",
    });
  });

  it("throws on unknown match references and on cycles", () => {
    expect(() => propagate([sourced("a", winner("nope"), team("x"))])).toThrow(/unknown match/i);
    expect(() =>
      propagate([sourced("a", winner("b"), team("x")), sourced("b", winner("a"), team("y"))]),
    ).toThrow(/cycle/i);
  });

  describe("properties", () => {
    const sizes = fc.integer({ min: 2, max: 40 });

    it("is idempotent at every stage of a randomly played bracket", () => {
      fc.assert(
        fc.property(sizes, fc.array(fc.boolean(), { minLength: 1, maxLength: 64 }), (n, coins) => {
          let ms = generateSingleElimination(seededTeams(n), { thirdPlaceMatch: true });
          for (let i = 0; ; i++) {
            const once = propagate(ms);
            const twice = propagate(once.matches);
            expect(twice.matches).toEqual(once.matches);
            expect(twice.invalidated).toEqual([]);
            const next = once.matches.find((m) => m.status === "SCHEDULED");
            if (!next) break;
            const homeWins = coins[i % coins.length];
            ms = withScore(once.matches, next.id, homeWins ? 1 : 0, homeWins ? 0 : 1);
          }
        }),
      );
    });

    it("finishes every match and crowns seed 1 over seed 2 when favourites always win", () => {
      fc.assert(
        fc.property(sizes, (n) => {
          const ms = playOut(
            generateSingleElimination(seededTeams(n)),
            (m) => seedOf(m.homeTeamId) < seedOf(m.awayTeamId),
          );
          expect(ms.every((m) => m.status === "FINISHED")).toBe(true);
          const final = ms.reduce((a, b) => (b.round > a.round ? b : a));
          expect([final.homeTeamId, final.awayTeamId].sort()).toEqual(["s1", "s2"]);
          expect(final.winnerTeamId).toBe("s1");
        }),
      );
    });

    it("preserves input order", () => {
      fc.assert(
        fc.property(sizes, (n) => {
          const input = generateSingleElimination(seededTeams(n));
          expect(propagate(input).matches.map((m) => m.id)).toEqual(input.map((m) => m.id));
        }),
      );
    });
  });
});
