import { describe, expect, it } from "vitest";
import { isThirdPlace, ordinal, roundName, shortMatchLabel, sourceLabel } from "@/lib/match-labels";

const m = (
  round: number,
  position = 1,
  bracket: "WINNERS" | "LOSERS" | "GRAND_FINAL" | null = null,
) => ({
  id: `r${round}m${position}`,
  round,
  position,
  bracket,
});

describe("roundName", () => {
  it("names knockout rounds from the end", () => {
    expect([1, 2, 3, 4, 5].map((r) => roundName("SINGLE_ELIM", m(r), 5))).toEqual([
      "Round of 32",
      "Round of 16",
      "Quarter-finals",
      "Semi-finals",
      "Final",
    ]);
  });

  it("names league, double-elimination and grand-final rounds", () => {
    expect(roundName("ROUND_ROBIN", m(4), 7)).toBe("Round 4");
    expect(roundName("GROUP", m(2), 3)).toBe("Round 2");
    expect(roundName("DOUBLE_ELIM", m(3, 1, "WINNERS"), 3)).toBe("Winners final");
    expect(roundName("DOUBLE_ELIM", m(2, 1, "LOSERS"), 3)).toBe("Losers round 2");
    expect(roundName("DOUBLE_ELIM", m(1, 1, "GRAND_FINAL"), 3)).toBe("Grand final");
    expect(roundName("DOUBLE_ELIM", m(2, 1, "GRAND_FINAL"), 3)).toBe("Grand final (reset)");
  });
});

describe("shortMatchLabel", () => {
  it("labels knockout, bracket and league matches", () => {
    expect(shortMatchLabel("SINGLE_ELIM", m(3), 3)).toBe("Final");
    expect(shortMatchLabel("SINGLE_ELIM", m(2, 2), 3)).toBe("SF 2");
    expect(shortMatchLabel("SINGLE_ELIM", m(1, 4), 3)).toBe("QF 4");
    expect(shortMatchLabel("SINGLE_ELIM", m(1, 4), 5)).toBe("R1 M4");
    expect(shortMatchLabel("SINGLE_ELIM", m(3, 2), 3)).toBe("3rd place");
    expect(shortMatchLabel("DOUBLE_ELIM", m(2, 1, "WINNERS"), 3)).toBe("WB R2 M1");
    expect(shortMatchLabel("DOUBLE_ELIM", m(4, 1, "LOSERS"), 3)).toBe("LB R4 M1");
    expect(shortMatchLabel("DOUBLE_ELIM", m(2, 1, "GRAND_FINAL"), 3)).toBe("GF reset");
    expect(shortMatchLabel("GROUP", m(2, 3), 3)).toBe("R2 M3");
    // Swiss rounds are never "Final" or "SF", even the last ones.
    expect(shortMatchLabel("SWISS", m(4, 3), 4)).toBe("R4 M3");
    expect(shortMatchLabel("SWISS", m(3, 1), 4)).toBe("R3 M1");
  });

  it("only treats position 2 of a knockout final round as the third-place match", () => {
    expect(isThirdPlace("SINGLE_ELIM", m(3, 2), 3)).toBe(true);
    expect(isThirdPlace("ROUND_ROBIN", m(3, 2), 3)).toBe(false);
    expect(isThirdPlace("GROUP", m(3, 2), 3)).toBe(false);
    expect(isThirdPlace("DOUBLE_ELIM", m(3, 2, "WINNERS"), 3)).toBe(false);
  });
});

describe("ordinal", () => {
  it("handles teens and endings", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "101st",
    ]);
  });
});

describe("sourceLabel", () => {
  const label = (id: string) => id.toUpperCase();
  const team = (id: string) => `Team ${id}`;
  it("describes every source type", () => {
    expect(sourceLabel({ type: "winner", matchId: "sf1" }, label, team)).toBe("Winner of SF1");
    expect(sourceLabel({ type: "loser", matchId: "sf2" }, label, team)).toBe("Loser of SF2");
    expect(sourceLabel({ type: "groupRank", group: "B", rank: 2 }, label, team)).toBe(
      "Group B 2nd",
    );
    expect(sourceLabel({ type: "team", teamId: "x" }, label, team)).toBe("Team x");
    expect(sourceLabel({ type: "bye" }, label, team)).toBe("Bye");
    expect(sourceLabel(null, label, team)).toBe("TBD");
  });
});
