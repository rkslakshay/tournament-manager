import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPublicView } from "@/server/services/public-view";
import { recordResult } from "@/server/services/results";
import { createTestDb, type TestDb } from "./test-db";
import { makeTournament, matchesOf, teamIds } from "./fixtures";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.cleanup());

describe("getPublicView", () => {
  it("exposes matches and derived standings but no secrets or internal tournament id", async () => {
    const { id, slug, adminToken } = await makeTournament(t.db, { format: "ROUND_ROBIN" }, 3);
    const names = await teamIds(t.db, id);
    const ms = await matchesOf(t.db, id);
    const first = Object.values(ms)[0]!;
    await recordResult(t.db, id, first.id, { homeScore: 3, awayScore: 1 });

    const view = await getPublicView(t.db, slug);
    const json = JSON.stringify(view);
    const row = await t.db.tournament.findUniqueOrThrow({ where: { id } });
    expect(json).not.toContain(row.adminTokenHash);
    expect(json).not.toContain(adminToken);
    expect(json).not.toContain("adminTokenHash");
    expect(json).not.toContain("editPolicy");
    expect(view.tournament).not.toHaveProperty("id");

    expect(view.tournament).toMatchObject({
      slug,
      name: "Fixture Cup",
      status: "IN_PROGRESS",
      format: "ROUND_ROBIN",
    });
    expect(view.teams.map((x) => x.name)).toEqual(["T1", "T2", "T3"]);
    const table = view.stages[0]!.standings!;
    expect(table[0]).toMatchObject({
      teamId: first.homeTeamId,
      points: 3,
      goalDifference: 2,
      rank: 1,
    });
    expect(table.map((r) => r.teamId).sort()).toEqual([names.T1, names.T2, names.T3].sort());
    expect(view.championTeamId).toBeNull();
  });

  it("derives group tables per group and no table for the knockout", async () => {
    const { slug } = await makeTournament(
      t.db,
      { format: "GROUP_KNOCKOUT", groups: 2, advancePerGroup: 1 },
      6,
    );
    const view = await getPublicView(t.db, slug);
    expect(view.stages.map((s) => [s.type, s.groupLabel, s.standings?.length ?? null])).toEqual([
      ["GROUP", "A", 3],
      ["GROUP", "B", 3],
      ["SINGLE_ELIM", null, null],
    ]);
  });

  it("names the champion of a finished knockout", async () => {
    const { id, slug } = await makeTournament(t.db, { format: "SINGLE_ELIM" }, 2);
    const names = await teamIds(t.db, id);
    await recordResult(t.db, id, `${id}-r1m1`, { homeScore: 0, awayScore: 2 });
    const view = await getPublicView(t.db, slug);
    expect(view.tournament.status).toBe("COMPLETED");
    expect(view.championTeamId).toBe(names.T2);
  });

  it("names the league leader once a round robin is completed", async () => {
    const { id, slug } = await makeTournament(t.db, { format: "ROUND_ROBIN" }, 2);
    const names = await teamIds(t.db, id);
    await recordResult(t.db, id, `${id}-rr-r1m1`, { homeScore: 1, awayScore: 0 });
    const view = await getPublicView(t.db, slug);
    const match = view.stages[0]!.matches[0]!;
    expect(view.championTeamId).toBe(match.homeTeamId);
    expect([names.T1, names.T2]).toContain(view.championTeamId);
  });

  it("handles double-elimination champions with and without the reset", async () => {
    const { id, slug } = await makeTournament(t.db, { format: "DOUBLE_ELIM" }, 2);
    const names = await teamIds(t.db, id);
    await recordResult(t.db, id, `${id}-w1m1`, { homeScore: 1, awayScore: 0 });
    await recordResult(t.db, id, `${id}-gf1`, { homeScore: 0, awayScore: 1 });
    expect((await getPublicView(t.db, slug)).championTeamId).toBeNull();
    await recordResult(t.db, id, `${id}-gf2`, { homeScore: 0, awayScore: 1 });
    expect((await getPublicView(t.db, slug)).championTeamId).toBe(names.T2);

    const other = await makeTournament(t.db, { format: "DOUBLE_ELIM" }, 2);
    const otherNames = await teamIds(t.db, other.id);
    await recordResult(t.db, other.id, `${other.id}-w1m1`, { homeScore: 1, awayScore: 0 });
    await recordResult(t.db, other.id, `${other.id}-gf1`, { homeScore: 1, awayScore: 0 });
    const view = await getPublicView(t.db, other.slug);
    expect(view.tournament.status).toBe("COMPLETED");
    expect(view.championTeamId).toBe(otherNames.T1);
  });

  it("returns NOT_FOUND for unknown slugs and empty stages before the start", async () => {
    await expect(getPublicView(t.db, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
    const { slug } = await makeTournament(t.db, { format: "ROUND_ROBIN" }, 2, { start: false });
    const view = await getPublicView(t.db, slug);
    expect(view.stages).toEqual([]);
    expect(view.championTeamId).toBeNull();
  });
});
