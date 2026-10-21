import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recordResult } from "@/server/services/results";
import { createTestDb, type TestDb } from "./test-db";
import { makeTournament, matchesOf, teamIds } from "./fixtures";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.cleanup());

describe("knockout results decided after regular time", () => {
  it("accepts a level score won on penalties and advances the chosen winner", async () => {
    const { id } = await makeTournament(t.db, { format: "SINGLE_ELIM" }, 4);
    const names = await teamIds(t.db, id);
    await recordResult(t.db, id, `${id}-r1m1`, {
      homeScore: 1,
      awayScore: 1,
      decidedBy: "PENALTIES",
      winnerTeamId: names.T4,
    });
    const ms = await matchesOf(t.db, id);
    expect(ms["r1m1"]).toMatchObject({
      homeScore: 1,
      awayScore: 1,
      winnerTeamId: names.T4,
      decidedBy: "PENALTIES",
    });
    expect(ms["r2m1"]!.homeTeamId).toBe(names.T4);
  });

  it("records extra time with the score deciding the winner", async () => {
    const { id } = await makeTournament(t.db, { format: "SINGLE_ELIM" }, 2);
    const names = await teamIds(t.db, id);
    const out = await recordResult(t.db, id, `${id}-r1m1`, {
      homeScore: 2,
      awayScore: 3,
      decidedBy: "EXTRA_TIME",
    });
    expect(out.status).toBe("COMPLETED");
    expect((await matchesOf(t.db, id))["r1m1"]).toMatchObject({
      winnerTeamId: names.T2,
      decidedBy: "EXTRA_TIME",
    });
  });

  it("keeps rejecting a plain knockout draw, and inconsistent combinations", async () => {
    const { id } = await makeTournament(t.db, { format: "SINGLE_ELIM" }, 2);
    const names = await teamIds(t.db, id);
    const m = `${id}-r1m1`;
    const expectInvalid = (input: Parameters<typeof recordResult>[3], message: RegExp) =>
      expect(recordResult(t.db, id, m, input)).rejects.toMatchObject({
        code: "VALIDATION",
        message: expect.stringMatching(message),
      });

    await expectInvalid({ homeScore: 1, awayScore: 1 }, /penalties/);
    await expectInvalid({ homeScore: 1, awayScore: 1, decidedBy: "EXTRA_TIME" }, /penalties/);
    await expectInvalid({ homeScore: 1, awayScore: 1, decidedBy: "PENALTIES" }, /who won/);
    await expectInvalid(
      { homeScore: 1, awayScore: 1, decidedBy: "PENALTIES", winnerTeamId: "someone" },
      /not playing/,
    );
    await expectInvalid(
      { homeScore: 2, awayScore: 1, decidedBy: "PENALTIES", winnerTeamId: names.T1 },
      /level/,
    );
    await expectInvalid({ homeScore: 2, awayScore: 1, winnerTeamId: names.T2 }, /score/);
  });

  it("allows only regular-time results in league stages, where draws stay draws", async () => {
    const { id } = await makeTournament(t.db, { format: "ROUND_ROBIN" }, 2);
    const names = await teamIds(t.db, id);
    const m = `${id}-rr-r1m1`;
    await expect(
      recordResult(t.db, id, m, {
        homeScore: 1,
        awayScore: 1,
        decidedBy: "PENALTIES",
        winnerTeamId: names.T1,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION", message: expect.stringMatching(/league/i) });
    await recordResult(t.db, id, m, { homeScore: 1, awayScore: 1, decidedBy: "REGULAR" });
    expect((await matchesOf(t.db, id))["rr-r1m1"]).toMatchObject({
      winnerTeamId: null,
      decidedBy: "REGULAR",
    });
  });
});
