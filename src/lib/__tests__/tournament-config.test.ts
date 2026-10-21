import { describe, expect, it } from "vitest";
import { isLeagueStageType, parseTournamentConfig } from "@/lib/tournament-config";

describe("parseTournamentConfig", () => {
  it("fills defaults", () => {
    expect(parseTournamentConfig({ format: "ROUND_ROBIN" })).toEqual({
      format: "ROUND_ROBIN",
      legs: 1,
      pointsForWin: 3,
      pointsForDraw: 1,
      pointsForLoss: 0,
      tiebreakers: [
        "points",
        "headToHead",
        "goalDifference",
        "goalsFor",
        "wins",
        "seed",
        "alphabetical",
      ],
      thirdPlaceMatch: false,
      grandFinalReset: true,
      editPolicy: "RESET_DOWNSTREAM",
      walkoverScore: { winner: 3, loser: 0 },
    });
  });

  it("requires groups settings for groups + knockout", () => {
    expect(() => parseTournamentConfig({ format: "GROUP_KNOCKOUT" })).toThrow(/groups/);
    expect(
      parseTournamentConfig({ format: "GROUP_KNOCKOUT", groups: 2, advancePerGroup: 2 }).groups,
    ).toBe(2);
  });

  it("rejects unknown formats, bad legs and repeated tiebreakers", () => {
    expect(() => parseTournamentConfig({ format: "LADDER" })).toThrow();
    expect(() => parseTournamentConfig({ format: "ROUND_ROBIN", legs: 3 })).toThrow();
    expect(() =>
      parseTournamentConfig({ format: "ROUND_ROBIN", tiebreakers: ["points", "points"] }),
    ).toThrow(/repeat/);
  });
});

describe("isLeagueStageType", () => {
  it("is true only for round robin and group stages", () => {
    expect(["ROUND_ROBIN", "GROUP", "SINGLE_ELIM", "DOUBLE_ELIM"].map(isLeagueStageType)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});
