import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recordResult } from "@/server/services/results";
import { scheduleTournament } from "@/server/services/schedule";
import { createTestDb, type TestDb } from "./test-db";
import { makeTournament, matchesOf } from "./fixtures";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.cleanup());

const START = "2026-11-01T09:00:00.000Z";

describe("scheduleTournament", () => {
  it("assigns times and venues to every open match", async () => {
    const { id } = await makeTournament(t.db, { format: "ROUND_ROBIN" }, 4);
    const out = await scheduleTournament(t.db, id, {
      venues: ["Court 1", "Court 2"],
      startTime: START,
      slotMinutes: 30,
      minRestSlots: 0,
    });
    expect(out).toEqual({ scheduled: 6, unscheduled: [] });
    const ms = Object.values(await matchesOf(t.db, id));
    const times = ms.map((m) => m.scheduledAt?.toISOString()).sort();
    expect(times).toEqual([
      START,
      START,
      "2026-11-01T09:30:00.000Z",
      "2026-11-01T09:30:00.000Z",
      "2026-11-01T10:00:00.000Z",
      "2026-11-01T10:00:00.000Z",
    ]);
    const venues = await t.db.venue.findMany({ where: { tournamentId: id } });
    expect(venues.map((v) => v.name).sort()).toEqual(["Court 1", "Court 2"]);
    expect(ms.every((m) => venues.some((v) => v.id === m.venueId) && m.version === 1)).toBe(true);
  });

  it("replaces venues on re-run and leaves finished matches alone", async () => {
    const { id } = await makeTournament(t.db, { format: "SINGLE_ELIM" }, 4);
    await recordResult(t.db, id, `${id}-r1m1`, { homeScore: 1, awayScore: 0 });
    await scheduleTournament(t.db, id, {
      venues: ["Old"],
      startTime: START,
      slotMinutes: 60,
      minRestSlots: 0,
    });
    const out = await scheduleTournament(t.db, id, {
      venues: ["New"],
      startTime: START,
      slotMinutes: 60,
      minRestSlots: 1,
    });
    expect(out).toEqual({ scheduled: 2, unscheduled: [] });
    const ms = await matchesOf(t.db, id);
    expect(ms["r1m1"]!.scheduledAt).toBeNull();
    expect(ms["r2m1"]!.scheduledAt!.getTime()).toBeGreaterThan(ms["r1m2"]!.scheduledAt!.getTime());
    expect((await t.db.venue.findMany({ where: { tournamentId: id } })).map((v) => v.name)).toEqual(
      ["New"],
    );
  });

  it("refuses to schedule before fixtures exist", async () => {
    const { id } = await makeTournament(t.db, { format: "ROUND_ROBIN" }, 2, { start: false });
    await expect(
      scheduleTournament(t.db, id, {
        venues: ["A"],
        startTime: START,
        slotMinutes: 30,
        minRestSlots: 0,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
  });
});
