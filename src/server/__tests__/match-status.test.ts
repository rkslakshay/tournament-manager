import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eventHub, type TournamentEvent } from "@/server/events";
import { setMatchStatus } from "@/server/services/match-status";
import { recordResult } from "@/server/services/results";
import { createTestDb, type TestDb } from "./test-db";
import { makeTournament, matchesOf } from "./fixtures";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.cleanup());

describe("setMatchStatus", () => {
  it("toggles a scheduled match live and back, bumping the version and notifying viewers", async () => {
    const { id, slug } = await makeTournament(t.db, { format: "ROUND_ROBIN" }, 2);
    const matchId = `${id}-rr-r1m1`;
    const events: TournamentEvent[] = [];
    const off = eventHub.subscribe(slug, (e) => events.push(e));

    expect(await setMatchStatus(t.db, id, matchId, { status: "LIVE", expectedVersion: 0 })).toEqual(
      { status: "LIVE", version: 1 },
    );
    expect((await matchesOf(t.db, id))["rr-r1m1"]).toMatchObject({ status: "LIVE", version: 1 });
    await setMatchStatus(t.db, id, matchId, { status: "SCHEDULED" });
    expect((await matchesOf(t.db, id))["rr-r1m1"]!.status).toBe("SCHEDULED");
    expect(events).toEqual([
      { type: "match_updated", matchIds: [matchId] },
      { type: "match_updated", matchIds: [matchId] },
    ]);
    off();
  });

  it("lets a live match be finished with a result", async () => {
    const { id } = await makeTournament(t.db, { format: "ROUND_ROBIN" }, 2);
    const matchId = `${id}-rr-r1m1`;
    await setMatchStatus(t.db, id, matchId, { status: "LIVE" });
    await recordResult(t.db, id, matchId, { homeScore: 1, awayScore: 0, expectedVersion: 1 });
    expect((await matchesOf(t.db, id))["rr-r1m1"]).toMatchObject({
      status: "FINISHED",
      version: 2,
    });
  });

  it("refuses finished, pending and unknown matches, stale versions and unstarted tournaments", async () => {
    const { id } = await makeTournament(t.db, { format: "SINGLE_ELIM" }, 3);
    await expect(setMatchStatus(t.db, id, `${id}-r1m1`, { status: "LIVE" })).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    await expect(setMatchStatus(t.db, id, `${id}-r2m1`, { status: "LIVE" })).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    await expect(setMatchStatus(t.db, id, "nope", { status: "LIVE" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      setMatchStatus(t.db, id, `${id}-r1m2`, { status: "LIVE", expectedVersion: 7 }),
    ).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
    });
    const notStarted = await makeTournament(t.db, { format: "ROUND_ROBIN" }, 2, { start: false });
    await expect(
      setMatchStatus(t.db, notStarted.id, "x", { status: "LIVE" }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(setMatchStatus(t.db, "missing", "x", { status: "LIVE" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
