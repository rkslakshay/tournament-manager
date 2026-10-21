import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPublicView } from "@/server/services/public-view";
import { recordResult } from "@/server/services/results";
import { startTournament } from "@/server/services/start-tournament";
import type { Db } from "@/server/db";
import { createTestDb, type TestDb } from "./test-db";
import { makeTournament, matchesOf } from "./fixtures";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.cleanup());

/** Play every open match of the latest round, home team winning. */
async function playOpenMatches(db: Db, tournamentId: string): Promise<void> {
  const open = Object.values(await matchesOf(db, tournamentId)).filter(
    (m) => m.status === "SCHEDULED",
  );
  for (const m of open) await recordResult(db, tournamentId, m.id, { homeScore: 1, awayScore: 0 });
}

describe("Swiss tournaments", () => {
  it("starts with round one, fixes the round count, and gives an odd team out a bye", async () => {
    const { id } = await makeTournament(t.db, { format: "SWISS" }, 5);
    const row = await t.db.tournament.findUniqueOrThrow({ where: { id } });
    expect(row.config).toMatchObject({ swissRounds: 3 });
    const ms = Object.values(await matchesOf(t.db, id));
    expect(ms.every((m) => m.round === 1)).toBe(true);
    expect(ms.filter((m) => m.status === "SCHEDULED")).toHaveLength(2);
    expect(ms.filter((m) => m.status === "FINISHED" && m.awayTeamId === null)).toHaveLength(1);
  });

  it("pairs the next round when the current one completes, until the last round", async () => {
    const { id, slug } = await makeTournament(t.db, { format: "SWISS", swissRounds: 3 }, 6);
    for (let round = 1; round <= 3; round++) {
      const before = Object.values(await matchesOf(t.db, id));
      expect(Math.max(...before.map((m) => m.round))).toBe(round);
      await playOpenMatches(t.db, id);
    }
    const all = Object.values(await matchesOf(t.db, id));
    expect(all).toHaveLength(9);
    const pairs = all.map((m) => [m.homeTeamId, m.awayTeamId].sort().join("|"));
    expect(new Set(pairs).size).toBe(9);

    const view = await getPublicView(t.db, slug);
    expect(view.tournament.status).toBe("COMPLETED");
    const table = view.stages[0]!.standings!;
    // Nine decisive matches at 3 points each, and a table sorted by points.
    expect(table.reduce((sum, r) => sum + r.points, 0)).toBe(27);
    expect(table.map((r) => r.points)).toEqual(
      [...table.map((r) => r.points)].sort((x, y) => y - x),
    );
    expect(table.every((r) => typeof r.buchholz === "number")).toBe(true);
    expect(view.championTeamId).toBe(table[0]!.teamId);
  });

  it("announces the new round's matches in the changed list", async () => {
    const { id } = await makeTournament(t.db, { format: "SWISS" }, 4);
    const [first, second] = Object.values(await matchesOf(t.db, id));
    await recordResult(t.db, id, first!.id, { homeScore: 2, awayScore: 2 });
    const out = await recordResult(t.db, id, second!.id, { homeScore: 0, awayScore: 1 });
    expect(out.changedMatchIds).toHaveLength(3);
    expect(out.changedMatchIds.filter((m) => m.includes("sw-r2"))).toHaveLength(2);
  });

  it("keeps existing pairings when an earlier result is edited", async () => {
    const { id } = await makeTournament(t.db, { format: "SWISS" }, 4);
    await playOpenMatches(t.db, id);
    const round2 = Object.values(await matchesOf(t.db, id)).filter((m) => m.round === 2);
    const first = Object.values(await matchesOf(t.db, id)).find((m) => m.round === 1)!;
    await recordResult(t.db, id, first.id, { homeScore: 0, awayScore: 5 });
    const after = Object.values(await matchesOf(t.db, id)).filter((m) => m.round === 2);
    expect(after.map((m) => [m.id, m.homeTeamId, m.awayTeamId])).toEqual(
      round2.map((m) => [m.id, m.homeTeamId, m.awayTeamId]),
    );
  });

  it("refuses more rounds than there are opponents", async () => {
    const { id } = await makeTournament(t.db, { format: "SWISS", swissRounds: 4 }, 4, {
      start: false,
    });
    await expect(startTournament(t.db, id)).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/at most 3 rounds/),
    });
  });
});
