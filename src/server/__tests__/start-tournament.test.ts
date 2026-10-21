import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TournamentConfigInput } from "@/lib/tournament-config";
import { startTournament } from "@/server/services/start-tournament";
import { addTeams } from "@/server/services/teams";
import { createTournament } from "@/server/services/tournaments";
import { createTestDb, type TestDb } from "./test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.cleanup());

async function setup(config: TournamentConfigInput, teamCount: number) {
  const { tournament } = await createTournament(t.db, { name: "Start", sport: "Football", config });
  if (teamCount > 0) {
    await addTeams(
      t.db,
      tournament.id,
      Array.from({ length: teamCount }, (_, i) => `Team ${i + 1}`),
    );
  }
  return tournament.id;
}

describe("startTournament", () => {
  it("generates a round robin and moves to IN_PROGRESS", async () => {
    const id = await setup({ format: "ROUND_ROBIN", legs: 2 }, 4);
    const result = await startTournament(t.db, id);
    expect(result.tournament.status).toBe("IN_PROGRESS");
    expect(result.stages).toHaveLength(1);
    expect(result.stages[0]).toMatchObject({ type: "ROUND_ROBIN", groupLabel: null });
    expect(result.stages[0]!.matches).toHaveLength(12);
    expect(
      result.stages[0]!.matches.every((m) => m.status === "SCHEDULED" && m.id.startsWith(`${id}-`)),
    ).toBe(true);
  });

  it("propagates byes in a single-elimination bracket", async () => {
    const id = await setup({ format: "SINGLE_ELIM", thirdPlaceMatch: true }, 6);
    const { stages, teams } = await startTournament(t.db, id);
    const matches = stages[0]!.matches;
    expect(matches).toHaveLength(8);
    const r2m1 = matches.find((m) => m.id === `${id}-r2m1`);
    expect(r2m1?.homeTeamId).toBe(teams[0]!.id);
  });

  it("generates double elimination", async () => {
    const id = await setup({ format: "DOUBLE_ELIM" }, 5);
    const { stages } = await startTournament(t.db, id);
    expect(stages[0]!.type).toBe("DOUBLE_ELIM");
    expect(stages[0]!.matches.filter((m) => m.bracket === "GRAND_FINAL")).toHaveLength(2);
  });

  it("generates groups + knockout and stores group labels", async () => {
    const id = await setup({ format: "GROUP_KNOCKOUT", groups: 2, advancePerGroup: 2 }, 8);
    const { stages, teams } = await startTournament(t.db, id);
    expect(stages.map((s) => [s.type, s.groupLabel])).toEqual([
      ["GROUP", "A"],
      ["GROUP", "B"],
      ["SINGLE_ELIM", null],
    ]);
    expect(teams.map((x) => x.groupLabel)).toEqual(["A", "B", "B", "A", "A", "B", "B", "A"]);
  });

  it("refuses to start with fewer than 2 teams, twice, or from the wrong state", async () => {
    const lonely = await setup({ format: "ROUND_ROBIN" }, 1);
    await expect(startTournament(t.db, lonely)).rejects.toMatchObject({ code: "VALIDATION" });

    const id = await setup({ format: "ROUND_ROBIN" }, 3);
    await startTournament(t.db, id);
    await expect(startTournament(t.db, id)).rejects.toMatchObject({ code: "INVALID_STATE" });

    const draft = await setup({ format: "ROUND_ROBIN" }, 3);
    await t.db.tournament.update({ where: { id: draft }, data: { status: "DRAFT" } });
    await expect(startTournament(t.db, draft)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("rolls back everything when the configuration cannot be generated", async () => {
    // 3 groups need at least 6 teams.
    const id = await setup({ format: "GROUP_KNOCKOUT", groups: 3, advancePerGroup: 1 }, 5);
    await expect(startTournament(t.db, id)).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/at least 2 teams/),
    });
    const row = await t.db.tournament.findUniqueOrThrow({
      where: { id },
      include: { stages: true },
    });
    expect(row.status).toBe("REGISTRATION");
    expect(row.stages).toEqual([]);
  });
});
