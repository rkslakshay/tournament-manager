import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPublicView } from "@/server/services/public-view";
import { forfeitMatch, recordResult } from "@/server/services/results";
import { createTestDb, type TestDb } from "./test-db";
import { makeTournament, matchesOf, teamIds } from "./fixtures";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.cleanup());

describe("forfeitMatch", () => {
  it("gives the opponent a 3-0 walkover by default, counted in the standings", async () => {
    const { id, slug } = await makeTournament(t.db, { format: "ROUND_ROBIN" }, 2);
    const match = (await matchesOf(t.db, id))["rr-r1m1"]!;
    const outcome = await forfeitMatch(t.db, id, match.id, {
      teamId: match.homeTeamId!,
      expectedVersion: 0,
    });
    expect(outcome.changedMatchIds).toEqual([match.id]);
    expect((await matchesOf(t.db, id))["rr-r1m1"]).toMatchObject({
      status: "FINISHED",
      homeScore: 0,
      awayScore: 3,
      winnerTeamId: match.awayTeamId,
      decidedBy: "WALKOVER",
    });
    const view = await getPublicView(t.db, slug);
    expect(view.stages[0]!.standings![0]).toMatchObject({
      teamId: match.awayTeamId,
      points: 3,
      goalsFor: 3,
    });
    expect(view.stages[0]!.matches[0]!.decidedBy).toBe("WALKOVER");
  });

  it("uses the configured walkover score", async () => {
    const { id } = await makeTournament(
      t.db,
      { format: "ROUND_ROBIN", walkoverScore: { winner: 1, loser: 0 } },
      2,
    );
    const match = (await matchesOf(t.db, id))["rr-r1m1"]!;
    await forfeitMatch(t.db, id, match.id, { teamId: match.awayTeamId! });
    expect((await matchesOf(t.db, id))["rr-r1m1"]).toMatchObject({ homeScore: 1, awayScore: 0 });
  });

  it("propagates through a bracket like any result", async () => {
    const { id } = await makeTournament(t.db, { format: "SINGLE_ELIM" }, 4);
    const names = await teamIds(t.db, id);
    await forfeitMatch(t.db, id, `${id}-r1m1`, { teamId: names.T1! });
    expect((await matchesOf(t.db, id))["r2m1"]).toMatchObject({ homeTeamId: names.T4 });
  });

  it("follows the edit policy when it changes who advanced", async () => {
    const { id } = await makeTournament(t.db, { format: "SINGLE_ELIM" }, 4);
    const names = await teamIds(t.db, id);
    await recordResult(t.db, id, `${id}-r1m1`, { homeScore: 2, awayScore: 0 });
    await recordResult(t.db, id, `${id}-r1m2`, { homeScore: 2, awayScore: 0 });
    await recordResult(t.db, id, `${id}-r2m1`, { homeScore: 1, awayScore: 0 });
    await expect(forfeitMatch(t.db, id, `${id}-r1m1`, { teamId: names.T1! })).rejects.toMatchObject(
      {
        code: "CONFIRMATION_REQUIRED",
      },
    );
    await forfeitMatch(t.db, id, `${id}-r1m1`, { teamId: names.T1!, confirmReset: true });
    expect((await matchesOf(t.db, id))["r2m1"]).toMatchObject({
      homeTeamId: names.T4,
      homeScore: null,
      decidedBy: null,
    });
  });

  it("clears the walkover marker when a regular result replaces it", async () => {
    const { id } = await makeTournament(t.db, { format: "ROUND_ROBIN" }, 2);
    const match = (await matchesOf(t.db, id))["rr-r1m1"]!;
    await forfeitMatch(t.db, id, match.id, { teamId: match.homeTeamId! });
    await recordResult(t.db, id, match.id, { homeScore: 3, awayScore: 0 });
    expect((await matchesOf(t.db, id))["rr-r1m1"]).toMatchObject({
      homeScore: 3,
      decidedBy: "REGULAR",
    });
  });

  it("rejects teams that are not in the match, byes, and stale versions", async () => {
    const { id } = await makeTournament(t.db, { format: "SINGLE_ELIM" }, 3);
    const names = await teamIds(t.db, id);
    await expect(forfeitMatch(t.db, id, `${id}-r1m2`, { teamId: names.T1! })).rejects.toMatchObject(
      { code: "VALIDATION" },
    );
    await expect(forfeitMatch(t.db, id, `${id}-r1m1`, { teamId: names.T1! })).rejects.toMatchObject(
      { code: "INVALID_STATE" },
    );
    await expect(
      forfeitMatch(t.db, id, `${id}-r1m2`, { teamId: names.T2!, expectedVersion: 9 }),
    ).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
    });
  });
});
