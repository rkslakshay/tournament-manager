import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildSingleElimination, generateSingleElimination } from "@/engine/single-elimination";
import type { Match, Source, Team } from "@/engine/types";

const seeded = (n: number): Team[] =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, name: `Seed ${i + 1}`, seed: i + 1 }));
const byId = (ms: Match[], id: string) => ms.find((m) => m.id === id) as Match;
const winnerOf = (matchId: string): Source => ({ type: "winner", matchId });

describe("generateSingleElimination", () => {
  it("builds 7 matches over 3 rounds for 8 teams with standard round-one pairs", () => {
    const ms = generateSingleElimination(seeded(8));
    expect(ms).toHaveLength(7);
    const r1 = ms.filter((m) => m.round === 1);
    expect(r1.map((m) => [m.homeTeamId, m.awayTeamId])).toEqual([
      ["s1", "s8"],
      ["s4", "s5"],
      ["s2", "s7"],
      ["s3", "s6"],
    ]);
    expect(r1.every((m) => m.status === "SCHEDULED")).toBe(true);
    expect(byId(ms, "r2m1")).toMatchObject({
      homeSource: winnerOf("r1m1"),
      awaySource: winnerOf("r1m2"),
      status: "PENDING",
    });
    expect(byId(ms, "r3m1")).toMatchObject({
      homeSource: winnerOf("r2m1"),
      awaySource: winnerOf("r2m2"),
    });
  });

  it("orders teams by seed regardless of input order", () => {
    const shuffled = [...seeded(4)].reverse();
    expect(generateSingleElimination(shuffled)).toEqual(generateSingleElimination(seeded(4)));
  });

  it("gives 12 teams four byes to seeds 1-4, finished with the bye team as winner", () => {
    const ms = generateSingleElimination(seeded(12));
    const r1 = ms.filter((m) => m.round === 1);
    expect(r1).toHaveLength(8);
    const byes = r1.filter((m) => m.awaySource?.type === "bye");
    expect(byes.map((m) => m.homeTeamId).sort()).toEqual(["s1", "s2", "s3", "s4"]);
    for (const m of byes)
      expect(m).toMatchObject({
        status: "FINISHED",
        winnerTeamId: m.homeTeamId,
        awayTeamId: null,
        homeScore: null,
      });
    expect(ms).toHaveLength(15);
  });

  it("adds a third-place match fed by the semi-final losers", () => {
    const ms = generateSingleElimination(seeded(8), {
      thirdPlaceMatch: true,
      idPrefix: "t1-",
      stageId: "t1-ko",
    });
    const third = byId(ms, "t1-3rd");
    expect(third).toMatchObject({
      round: 3,
      position: 2,
      stageId: "t1-ko",
      homeSource: { type: "loser", matchId: "t1-r2m1" },
      awaySource: { type: "loser", matchId: "t1-r2m2" },
    });
    expect(ms.every((m) => m.id.startsWith("t1-"))).toBe(true);
  });

  it("skips the third-place match when there are no semi-finals", () => {
    expect(generateSingleElimination(seeded(2), { thirdPlaceMatch: true })).toHaveLength(1);
  });

  it("has a single match for 2 teams", () => {
    expect(generateSingleElimination(seeded(2))).toMatchObject([
      { id: "r1m1", homeTeamId: "s1", awayTeamId: "s2", status: "SCHEDULED" },
    ]);
  });

  it("rejects fewer than 2 teams", () => {
    expect(() => generateSingleElimination(seeded(1))).toThrow(/at least 2/);
  });

  it("leaves round one unresolved for non-team entrants (e.g. group ranks)", () => {
    const entrants: Source[] = [
      { type: "groupRank", group: "A", rank: 1 },
      { type: "groupRank", group: "B", rank: 1 },
      { type: "groupRank", group: "A", rank: 2 },
    ];
    const ms = buildSingleElimination(entrants, {});
    const bye = ms.find((m) => m.awaySource?.type === "bye") as Match;
    expect(bye).toMatchObject({ status: "PENDING", homeTeamId: null, homeSource: entrants[0] });
  });

  describe("properties", () => {
    it("forms a valid bracket tree for any team count", () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 70 }), fc.boolean(), (n, third) => {
          const ms = generateSingleElimination(seeded(n), { thirdPlaceMatch: third });
          let size = 1;
          while (size < n) size *= 2;
          const rounds = Math.log2(size);
          expect(ms).toHaveLength(size - 1 + (third && size >= 4 ? 1 : 0));
          expect(new Set(ms.map((m) => m.id)).size).toBe(ms.length);
          expect(Math.max(...ms.map((m) => m.round))).toBe(rounds);
          const feeds = new Map<string, number>();
          for (const m of ms.filter((x) => x.round > 1 && x.id !== "3rd")) {
            for (const src of [m.homeSource, m.awaySource]) {
              expect(src?.type).toBe("winner");
              const feeder = byId(ms, (src as { matchId: string }).matchId);
              expect(feeder.round).toBe(m.round - 1);
              feeds.set(feeder.id, (feeds.get(feeder.id) ?? 0) + 1);
            }
          }
          expect([...feeds.values()].every((c) => c === 1)).toBe(true);
          expect(feeds.size).toBe(size - 2);
          const teamsInR1 = ms
            .filter((m) => m.round === 1)
            .flatMap((m) => [m.homeTeamId, m.awayTeamId])
            .filter(Boolean);
          expect(new Set(teamsInR1).size).toBe(n);
        }),
      );
    });

    it("puts seeds 1 and 2 in opposite halves (from 3 teams; with 2 the only match is the final)", () => {
      fc.assert(
        fc.property(fc.integer({ min: 3, max: 70 }), (n) => {
          const r1 = generateSingleElimination(seeded(n)).filter((m) => m.round === 1);
          const half = (team: string) =>
            r1.findIndex((m) => m.homeTeamId === team || m.awayTeamId === team) < r1.length / 2;
          expect(half("s1")).not.toBe(half("s2"));
        }),
      );
    });
  });
});
