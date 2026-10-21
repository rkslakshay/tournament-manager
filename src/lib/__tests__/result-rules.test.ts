import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { decideResult } from "@/lib/result-rules";

const teams = { homeTeamId: "h", awayTeamId: "a" };

describe("decideResult", () => {
  it("league: higher score wins, level is a draw, nothing but regular time", () => {
    expect(decideResult({ homeScore: 2, awayScore: 1 }, teams, true)).toEqual({
      ok: true,
      winnerTeamId: "h",
      decidedBy: "REGULAR",
    });
    expect(decideResult({ homeScore: 1, awayScore: 1 }, teams, true)).toEqual({
      ok: true,
      winnerTeamId: null,
      decidedBy: "REGULAR",
    });
    expect(
      decideResult(
        { homeScore: 1, awayScore: 1, decidedBy: "PENALTIES", winnerTeamId: "h" },
        teams,
        true,
      ).ok,
    ).toBe(false);
    expect(
      decideResult({ homeScore: 2, awayScore: 1, decidedBy: "EXTRA_TIME" }, teams, true).ok,
    ).toBe(false);
  });

  it("knockout: extra time, penalties, and the default rejection of draws", () => {
    expect(
      decideResult({ homeScore: 1, awayScore: 2, decidedBy: "EXTRA_TIME" }, teams, false),
    ).toEqual({
      ok: true,
      winnerTeamId: "a",
      decidedBy: "EXTRA_TIME",
    });
    expect(
      decideResult(
        { homeScore: 0, awayScore: 0, decidedBy: "PENALTIES", winnerTeamId: "h" },
        teams,
        false,
      ),
    ).toEqual({
      ok: true,
      winnerTeamId: "h",
      decidedBy: "PENALTIES",
    });
    // A level score with a winner but no stated decision is read as penalties.
    expect(
      decideResult({ homeScore: 3, awayScore: 3, winnerTeamId: "a" }, teams, false),
    ).toMatchObject({ ok: true, decidedBy: "PENALTIES" });
    expect(decideResult({ homeScore: 1, awayScore: 1 }, teams, false)).toMatchObject({
      ok: false,
      message: expect.stringMatching(/draws/),
    });
    expect(
      decideResult({ homeScore: 2, awayScore: 1, winnerTeamId: "h" }, teams, false),
    ).toMatchObject({ ok: true, winnerTeamId: "h" });
  });

  it("property: an accepted knockout result always has a winner who is playing", () => {
    fc.assert(
      fc.property(
        fc.nat(5),
        fc.nat(5),
        fc.constantFrom(undefined, "REGULAR" as const, "EXTRA_TIME" as const, "PENALTIES" as const),
        fc.constantFrom(undefined, "h", "a", "x"),
        (homeScore, awayScore, decidedBy, winnerTeamId) => {
          const d = decideResult({ homeScore, awayScore, decidedBy, winnerTeamId }, teams, false);
          if (!d.ok) return;
          expect(["h", "a"]).toContain(d.winnerTeamId);
          if (homeScore !== awayScore)
            expect(d.winnerTeamId).toBe(homeScore > awayScore ? "h" : "a");
          else expect(d.decidedBy).toBe("PENALTIES");
        },
      ),
    );
  });
});
