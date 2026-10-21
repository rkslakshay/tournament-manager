import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateSingleElimination } from "@/engine/single-elimination";
import { propagate } from "@/engine/propagation";
import {
  findTournamentBySlug,
  loadAggregate,
  toMatchCreateData,
} from "@/server/repositories/tournament-repository";
import { createTestDb, type TestDb } from "./test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.cleanup());

describe("tournament repository", () => {
  it("round-trips a tournament with teams, stages and matches", async () => {
    const { db } = t;
    const tournament = await db.tournament.create({
      data: {
        slug: "cup-1",
        name: "Cup",
        sport: "Football",
        adminTokenHash: "x",
        config: { format: "SINGLE_ELIM" },
      },
    });
    const teams = await Promise.all(
      ["Ants", "Bees", "Cats"].map((name, i) =>
        db.team.create({
          data: { tournamentId: tournament.id, name, nameKey: name.toLowerCase(), seed: i + 1 },
        }),
      ),
    );
    const matches = propagate(
      generateSingleElimination(
        teams.map((r) => ({ id: r.id, name: r.name, seed: r.seed })),
        { idPrefix: `${tournament.id}-`, stageId: `${tournament.id}-ko`, thirdPlaceMatch: true },
      ),
    ).matches;
    await db.stage.create({
      data: {
        id: `${tournament.id}-ko`,
        tournamentId: tournament.id,
        order: 1,
        type: "SINGLE_ELIM",
        config: {},
      },
    });
    await db.match.createMany({ data: matches.map(toMatchCreateData) });

    const aggregate = await loadAggregate(db, tournament.id);
    expect(aggregate.tournament).toMatchObject({ slug: "cup-1", status: "REGISTRATION" });
    expect(aggregate.tournament.config).toMatchObject({
      format: "SINGLE_ELIM",
      pointsForWin: 3,
      editPolicy: "RESET_DOWNSTREAM",
    });
    expect(aggregate.teams.map((x) => x.name)).toEqual(["Ants", "Bees", "Cats"]);
    expect(aggregate.stages).toHaveLength(1);
    const stored = aggregate.stages[0]!.matches.map(({ version, scheduledAt, venueId, ...m }) => {
      expect([version, scheduledAt, venueId]).toEqual([0, null, null]);
      return m;
    });
    expect(stored).toEqual(matches);
    expect(aggregate.stages[0]!.groupLabel).toBeNull();
  });

  it("finds tournaments by slug and reports missing ones", async () => {
    await expect(findTournamentBySlug(t.db, "cup-1")).resolves.toMatchObject({ name: "Cup" });
    await expect(findTournamentBySlug(t.db, "nope")).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
    await expect(loadAggregate(t.db, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects case-insensitive duplicate team names at the database level", async () => {
    const tournament = await t.db.tournament.findUniqueOrThrow({ where: { slug: "cup-1" } });
    await expect(
      t.db.team.create({
        data: { tournamentId: tournament.id, name: "ANTS", nameKey: "ants", seed: 9 },
      }),
    ).rejects.toThrow();
  });
});
