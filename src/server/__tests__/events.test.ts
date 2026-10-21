import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eventHub, type TournamentEvent } from "@/server/events";
import { recordResult } from "@/server/services/results";
import { addTeams } from "@/server/services/teams";
import { startTournament } from "@/server/services/start-tournament";
import { createTestDb, type TestDb } from "./test-db";
import { makeTournament } from "./fixtures";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.cleanup());

describe("eventHub", () => {
  it("delivers events to subscribers of that slug only, until they unsubscribe", () => {
    const a: TournamentEvent[] = [];
    const b: TournamentEvent[] = [];
    const offA = eventHub.subscribe("hub-a", (e) => a.push(e));
    const offB = eventHub.subscribe("hub-b", (e) => b.push(e));
    eventHub.publish("hub-a", { type: "tournament_updated" });
    expect(a).toEqual([{ type: "tournament_updated" }]);
    expect(b).toEqual([]);
    offA();
    eventHub.publish("hub-a", { type: "tournament_updated" });
    expect(a).toHaveLength(1);
    expect(eventHub.subscriberCount("hub-a")).toBe(0);
    offB();
  });

  it("keeps delivering when one listener throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const seen: TournamentEvent[] = [];
    const off1 = eventHub.subscribe("hub-c", () => {
      throw new Error("boom");
    });
    const off2 = eventHub.subscribe("hub-c", (e) => seen.push(e));
    eventHub.publish("hub-c", { type: "tournament_updated" });
    expect(seen).toHaveLength(1);
    off1();
    off2();
    spy.mockRestore();
  });
});

describe("services publish after commit", () => {
  it("publishes team changes, the start and results; nothing for failed writes", async () => {
    const { id, slug } = await makeTournament(t.db, { format: "SINGLE_ELIM" }, 0, { start: false });
    const events: TournamentEvent[] = [];
    const off = eventHub.subscribe(slug, (e) => events.push(e));

    await addTeams(t.db, id, ["A", "B"]);
    await expect(addTeams(t.db, id, ["a"])).rejects.toMatchObject({ code: "DUPLICATE" });
    await startTournament(t.db, id);
    await expect(
      recordResult(t.db, id, `${id}-r1m1`, { homeScore: 1, awayScore: 1 }),
    ).rejects.toBeDefined();
    await recordResult(t.db, id, `${id}-r1m1`, { homeScore: 1, awayScore: 0 });

    expect(events).toEqual([
      { type: "tournament_updated" },
      { type: "tournament_updated" },
      { type: "match_updated", matchIds: [`${id}-r1m1`] },
    ]);
    off();
  });
});
