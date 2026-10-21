import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recordResult } from "@/server/services/results";
import { createTestDb, type TestDb } from "./test-db";
import { makeTournament, matchesOf } from "./fixtures";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.cleanup());

describe("optimistic concurrency", () => {
  it("accepts a write with the current version and bumps it", async () => {
    const { id } = await makeTournament(t.db, { format: "ROUND_ROBIN" }, 2);
    const matchId = `${id}-rr-r1m1`;
    await recordResult(t.db, id, matchId, { homeScore: 1, awayScore: 0, expectedVersion: 0 });
    expect((await matchesOf(t.db, id))["rr-r1m1"]!.version).toBe(1);
    await recordResult(t.db, id, matchId, { homeScore: 2, awayScore: 0, expectedVersion: 1 });
    expect((await matchesOf(t.db, id))["rr-r1m1"]).toMatchObject({ version: 2, homeScore: 2 });
  });

  it("refuses a stale version with a clear message and leaves the match untouched", async () => {
    const { id } = await makeTournament(t.db, { format: "ROUND_ROBIN" }, 2);
    const matchId = `${id}-rr-r1m1`;
    await recordResult(t.db, id, matchId, { homeScore: 1, awayScore: 0, expectedVersion: 0 });
    await expect(
      recordResult(t.db, id, matchId, { homeScore: 0, awayScore: 5, expectedVersion: 0 }),
    ).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
      status: 409,
      message: expect.stringMatching(/changed by someone else/),
      details: { matchId, currentVersion: 1 },
    });
    expect((await matchesOf(t.db, id))["rr-r1m1"]).toMatchObject({ homeScore: 1, version: 1 });
  });

  it("falls back to last-write-wins when no version is sent", async () => {
    const { id } = await makeTournament(t.db, { format: "ROUND_ROBIN" }, 2);
    const matchId = `${id}-rr-r1m1`;
    await recordResult(t.db, id, matchId, { homeScore: 1, awayScore: 0 });
    await recordResult(t.db, id, matchId, { homeScore: 0, awayScore: 1 });
    expect((await matchesOf(t.db, id))["rr-r1m1"]).toMatchObject({ awayScore: 1, version: 2 });
  });

  it("lets only one of two simultaneous writers with the same version win", async () => {
    const { id } = await makeTournament(t.db, { format: "ROUND_ROBIN" }, 2);
    const matchId = `${id}-rr-r1m1`;
    const results = await Promise.allSettled([
      recordResult(t.db, id, matchId, { homeScore: 1, awayScore: 0, expectedVersion: 0 }),
      recordResult(t.db, id, matchId, { homeScore: 0, awayScore: 1, expectedVersion: 0 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "VERSION_CONFLICT" });
    expect((await matchesOf(t.db, id))["rr-r1m1"]!.version).toBe(1);
  });
});
