import { describe, expect, it } from "vitest";
import { createMatch, hasResult, isBye, loserOf } from "@/engine/match";
import { DEFAULT_STANDINGS_CONFIG, DEFAULT_TIEBREAKERS } from "@/engine/types";

const base = createMatch({ id: "m1", stageId: "s1", round: 1, position: 1 });

describe("createMatch", () => {
  it("defaults to PENDING with no teams or result", () => {
    expect(base).toMatchObject({
      status: "PENDING",
      bracket: null,
      homeTeamId: null,
      awayTeamId: null,
      homeSource: null,
      awaySource: null,
      homeScore: null,
      awayScore: null,
      winnerTeamId: null,
    });
  });

  it("is SCHEDULED when both teams are known", () => {
    const m = createMatch({
      id: "m",
      stageId: "s",
      round: 1,
      position: 1,
      homeTeamId: "a",
      awayTeamId: "b",
    });
    expect(m.status).toBe("SCHEDULED");
  });

  it("is PENDING when only one team is known", () => {
    const m = createMatch({ id: "m", stageId: "s", round: 1, position: 1, homeTeamId: "a" });
    expect(m.status).toBe("PENDING");
  });
});

describe("match helpers", () => {
  const played = {
    ...base,
    homeTeamId: "a",
    awayTeamId: "b",
    status: "FINISHED" as const,
    homeScore: 1,
    awayScore: 3,
    winnerTeamId: "b",
  };

  it("hasResult needs both scores", () => {
    expect(hasResult(played)).toBe(true);
    expect(hasResult({ ...played, awayScore: null })).toBe(false);
  });

  it("isBye detects auto-finished matches with an empty slot", () => {
    expect(isBye({ ...base, status: "FINISHED", homeTeamId: "a", winnerTeamId: "a" })).toBe(true);
    expect(isBye({ ...base, status: "FINISHED" })).toBe(true);
    expect(isBye(played)).toBe(false);
    expect(isBye({ ...base, homeTeamId: "a" })).toBe(false);
  });

  it("loserOf returns the other team of a finished match", () => {
    expect(loserOf(played)).toBe("a");
    expect(loserOf({ ...played, winnerTeamId: "a" })).toBe("b");
    expect(loserOf({ ...played, status: "LIVE", winnerTeamId: null })).toBeNull();
    expect(loserOf({ ...base, status: "FINISHED", homeTeamId: "a", winnerTeamId: "a" })).toBeNull();
  });
});

describe("defaults", () => {
  it("uses the documented tiebreaker chain and 3-1-0 points", () => {
    expect(DEFAULT_TIEBREAKERS).toEqual([
      "points",
      "headToHead",
      "goalDifference",
      "goalsFor",
      "wins",
      "seed",
      "alphabetical",
    ]);
    expect(DEFAULT_STANDINGS_CONFIG).toMatchObject({
      pointsForWin: 3,
      pointsForDraw: 1,
      pointsForLoss: 0,
    });
  });
});
