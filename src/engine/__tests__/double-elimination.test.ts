import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { generateDoubleElimination, losersDropPosition } from "@/engine/double-elimination";
import { propagate } from "@/engine/propagation";
import type { Match } from "@/engine/types";
import { seededTeams, seedOf, withScore } from "./helpers";

const get = (ms: Match[], id: string) => ms.find((m) => m.id === id) as Match;
const pair = (m: Match) => [m.homeTeamId, m.awayTeamId].sort().join("|");

/** Play the bracket out; `homeWins` picks each result. */
function playOut(matches: Match[], homeWins: (m: Match, i: number) => boolean): Match[] {
  let ms = propagate(matches).matches;
  for (let i = 0; ; i++) {
    const next = ms.find((m) => m.status === "SCHEDULED");
    if (!next) return ms;
    const home = homeWins(next, i);
    ms = propagate(withScore(ms, next.id, home ? 1 : 0, home ? 0 : 1)).matches;
  }
}

function champion(ms: Match[]): string | null {
  const gf2 = ms.find((m) => m.id === "gf2");
  if (gf2 && gf2.winnerTeamId !== null) return gf2.winnerTeamId;
  return get(ms, "gf1").winnerTeamId;
}

describe("generateDoubleElimination", () => {
  it("builds winners, losers and grand-final matches for 8 teams", () => {
    const ms = generateDoubleElimination(seededTeams(8));
    const count = (b: string) => ms.filter((m) => m.bracket === b).length;
    expect([count("WINNERS"), count("LOSERS"), count("GRAND_FINAL")]).toEqual([7, 6, 2]);
    expect(ms.filter((m) => m.bracket === "LOSERS").map((m) => m.id)).toEqual([
      "l1m1",
      "l1m2",
      "l2m1",
      "l2m2",
      "l3m1",
      "l4m1",
    ]);
  });

  it("routes losers: round-one losers pair up, later losers drop in reversed", () => {
    const ms = generateDoubleElimination(seededTeams(8));
    expect(get(ms, "l1m1")).toMatchObject({
      homeSource: { type: "loser", matchId: "w1m1" },
      awaySource: { type: "loser", matchId: "w1m2" },
    });
    expect(get(ms, "l2m1")).toMatchObject({
      homeSource: { type: "winner", matchId: "l1m1" },
      awaySource: { type: "loser", matchId: "w2m2" },
    });
    expect(get(ms, "l2m2").awaySource).toEqual({ type: "loser", matchId: "w2m1" });
    expect(get(ms, "l3m1")).toMatchObject({
      homeSource: { type: "winner", matchId: "l2m1" },
      awaySource: { type: "winner", matchId: "l2m2" },
    });
    expect(get(ms, "l4m1")).toMatchObject({
      homeSource: { type: "winner", matchId: "l3m1" },
      awaySource: { type: "loser", matchId: "w3m1" },
    });
    expect(get(ms, "gf1")).toMatchObject({
      round: 1,
      homeSource: { type: "winner", matchId: "w3m1" },
      awaySource: { type: "winner", matchId: "l4m1" },
    });
    expect(get(ms, "gf2")).toMatchObject({
      round: 2,
      homeSource: { type: "loser", matchId: "gf1" },
      awaySource: { type: "winner", matchId: "gf1" },
    });
  });

  it("handles 2 teams: the loser of the only match goes straight to the grand final", () => {
    const ms = generateDoubleElimination(seededTeams(2));
    expect(ms.map((m) => m.id)).toEqual(["w1m1", "gf1", "gf2"]);
    expect(get(ms, "gf1")).toMatchObject({
      homeSource: { type: "winner", matchId: "w1m1" },
      awaySource: { type: "loser", matchId: "w1m1" },
    });
  });

  it("can drop the bracket reset and applies an id prefix", () => {
    const ms = generateDoubleElimination(seededTeams(4), {
      grandFinalReset: false,
      idPrefix: "t-",
      stageId: "t-de",
    });
    expect(ms.some((m) => m.id === "t-gf2")).toBe(false);
    expect(ms.every((m) => m.id.startsWith("t-") && m.stageId === "t-de")).toBe(true);
  });

  it("rejects fewer than 2 teams", () => {
    expect(() => generateDoubleElimination(seededTeams(1))).toThrow(/at least 2/);
  });

  it("plays the reset only when the losers-bracket champion wins the first final", () => {
    const toFinal = playOut(
      generateDoubleElimination(seededTeams(4)),
      (m) => m.bracket !== "GRAND_FINAL" && seedOf(m.homeTeamId) < seedOf(m.awayTeamId),
    );
    // Favourites win until the final; then the away side (losers-bracket champion) wins
    // both finals, so the reset is played.
    const gf1 = get(toFinal, "gf1");
    expect(gf1).toMatchObject({ homeTeamId: "s1", winnerTeamId: gf1.awayTeamId });
    expect(get(toFinal, "gf2")).toMatchObject({
      status: "FINISHED",
      homeTeamId: "s1",
      awayTeamId: gf1.awayTeamId,
      homeScore: 0,
    });
    expect(champion(toFinal)).toBe(gf1.awayTeamId);
    const favourites = playOut(
      generateDoubleElimination(seededTeams(4)),
      (m) => seedOf(m.homeTeamId) < seedOf(m.awayTeamId),
    );
    expect(champion(favourites)).toBe("s1");
    expect(get(favourites, "gf2")).toMatchObject({
      status: "FINISHED",
      homeTeamId: null,
      awayTeamId: null,
    });
  });

  describe("losersDropPosition", () => {
    it("cycles reverse, swap halves, identity, reverse halves", () => {
      const at = (r: number) => [1, 2, 3, 4].map((q) => losersDropPosition(q, 4, r));
      expect(at(2)).toEqual([4, 3, 2, 1]);
      expect(at(3)).toEqual([3, 4, 1, 2]);
      expect(at(4)).toEqual([1, 2, 3, 4]);
      expect(at(5)).toEqual([2, 1, 4, 3]);
      expect(losersDropPosition(1, 1, 3)).toBe(1);
    });

    it("property: is a permutation of 1..m", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 6 }), fc.integer({ min: 2, max: 9 }), (k, r) => {
          const m = 2 ** k;
          const out = Array.from({ length: m }, (_, i) => losersDropPosition(i + 1, m, r));
          expect([...out].sort((a, b) => a - b)).toEqual(
            Array.from({ length: m }, (_, i) => i + 1),
          );
        }),
      );
    });
  });

  describe("properties", () => {
    const sizes = fc.integer({ min: 2, max: 40 });
    const coins = fc.array(fc.boolean(), { minLength: 1, maxLength: 50 });

    it("has unique ids and N-1 winners, N-2 losers and 2 grand-final matches", () => {
      fc.assert(
        fc.property(sizes, (n) => {
          const ms = generateDoubleElimination(seededTeams(n));
          let size = 1;
          while (size < n) size *= 2;
          expect(new Set(ms.map((m) => m.id)).size).toBe(ms.length);
          expect(ms.filter((m) => m.bracket === "WINNERS")).toHaveLength(size - 1);
          expect(ms.filter((m) => m.bracket === "LOSERS")).toHaveLength(size - 2);
          expect(ms.filter((m) => m.bracket === "GRAND_FINAL")).toHaveLength(2);
        }),
      );
    });

    it("eliminates every team except the champion after exactly two losses", () => {
      fc.assert(
        fc.property(sizes, coins, (n, flips) => {
          const ms = playOut(
            generateDoubleElimination(seededTeams(n)),
            (_, i) => flips[i % flips.length] as boolean,
          );
          expect(ms.every((m) => m.status === "FINISHED")).toBe(true);
          const losses = new Map<string, number>();
          for (const m of ms) {
            if (m.homeScore === null || m.homeTeamId === null || m.awayTeamId === null) continue;
            const loser = m.winnerTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
            losses.set(loser, (losses.get(loser) ?? 0) + 1);
          }
          const champ = champion(ms) as string;
          expect(champ).not.toBeNull();
          for (const t of seededTeams(n)) {
            if (t.id === champ) expect(losses.get(t.id) ?? 0).toBeLessThanOrEqual(1);
            else expect(losses.get(t.id)).toBe(2);
          }
        }),
      );
    });

    // From 8 bracket slots up. With 4 slots there is a single drop-down match, so the winners
    // final loser can always meet their own round-one victim.
    it("never repeats a winners-bracket meeting in the first drop-down round", () => {
      fc.assert(
        fc.property(fc.integer({ min: 5, max: 40 }), coins, (n, flips) => {
          const ms = playOut(
            generateDoubleElimination(seededTeams(n)),
            (_, i) => flips[i % flips.length] as boolean,
          );
          const met = new Set(
            ms.filter((m) => m.bracket === "WINNERS" && m.homeScore !== null).map(pair),
          );
          for (const m of ms.filter(
            (x) => x.bracket === "LOSERS" && x.round === 2 && x.homeScore !== null,
          )) {
            expect(met.has(pair(m))).toBe(false);
          }
        }),
      );
    });

    it("propagation stays idempotent throughout a played double-elimination bracket", () => {
      fc.assert(
        fc.property(sizes, coins, (n, flips) => {
          let ms = generateDoubleElimination(seededTeams(n));
          for (let i = 0; ; i++) {
            const once = propagate(ms).matches;
            expect(propagate(once).matches).toEqual(once);
            const next = once.find((m) => m.status === "SCHEDULED");
            if (!next) break;
            const home = flips[i % flips.length];
            ms = withScore(once, next.id, home ? 1 : 0, home ? 0 : 1);
          }
        }),
      );
    });

    it("crowns seed 1 without a reset when favourites always win", () => {
      fc.assert(
        fc.property(sizes, (n) => {
          const ms = playOut(
            generateDoubleElimination(seededTeams(n)),
            (m) => seedOf(m.homeTeamId) < seedOf(m.awayTeamId),
          );
          expect(champion(ms)).toBe("s1");
          expect(get(ms, "gf1").awayTeamId).toBe("s2");
        }),
      );
    });
  });
});
