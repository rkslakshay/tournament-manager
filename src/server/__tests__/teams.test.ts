import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_TEAMS, TOURNAMENT_STATUSES } from "@/lib/tournament-config";
import { assertTransition, canTransition } from "@/server/lifecycle";
import { addTeams, nameKey, removeTeam, reorderTeams } from "@/server/services/teams";
import { createTournament } from "@/server/services/tournaments";
import { createTestDb, type TestDb } from "./test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.cleanup());

async function newTournament() {
  const { tournament } = await createTournament(t.db, {
    name: "Teams",
    sport: "Football",
    config: { format: "ROUND_ROBIN" },
  });
  return tournament.id;
}

describe("lifecycle", () => {
  it("allows only the documented transitions", () => {
    const legal = TOURNAMENT_STATUSES.flatMap((from) =>
      TOURNAMENT_STATUSES.filter((to) => canTransition(from, to)).map((to) => `${from}->${to}`),
    );
    expect(legal.sort()).toEqual(
      [
        "DRAFT->REGISTRATION",
        "DRAFT->ARCHIVED",
        "REGISTRATION->IN_PROGRESS",
        "REGISTRATION->ARCHIVED",
        "IN_PROGRESS->COMPLETED",
        "IN_PROGRESS->ARCHIVED",
        "COMPLETED->IN_PROGRESS",
        "COMPLETED->ARCHIVED",
      ].sort(),
    );
    expect(() => assertTransition("ARCHIVED", "IN_PROGRESS")).toThrow(/Cannot move/);
    expect(() => assertTransition("DRAFT", "IN_PROGRESS")).toThrow(/Cannot move/);
  });
});

describe("team management", () => {
  it("adds teams with consecutive seeds and trimmed names", async () => {
    const id = await newTournament();
    await addTeams(t.db, id, ["  Ants ", "Bees"]);
    const teams = await addTeams(t.db, id, ["Cats"]);
    expect(teams.map((x) => [x.name, x.seed])).toEqual([
      ["Ants", 1],
      ["Bees", 2],
      ["Cats", 3],
    ]);
  });

  it("rejects case-insensitive duplicates within a batch and against existing teams", async () => {
    const id = await newTournament();
    await addTeams(t.db, id, ["Ants"]);
    await expect(addTeams(t.db, id, ["ANTS"])).rejects.toMatchObject({
      code: "DUPLICATE",
      details: { names: ["ANTS"] },
    });
    await expect(addTeams(t.db, id, ["Bees", "bees  "])).rejects.toMatchObject({
      code: "DUPLICATE",
    });
    expect(nameKey("  Red   Lions ")).toBe("red lions");
  });

  it("rejects empty names, empty batches and more than the maximum", async () => {
    const id = await newTournament();
    await expect(addTeams(t.db, id, ["ok", "  "])).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/#2/),
    });
    await expect(addTeams(t.db, id, [])).rejects.toMatchObject({ code: "VALIDATION" });
    const many = Array.from({ length: MAX_TEAMS + 1 }, (_, i) => `Team ${i}`);
    await expect(addTeams(t.db, id, many)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("removes a team and closes the seed gap", async () => {
    const id = await newTournament();
    const teams = await addTeams(t.db, id, ["A", "B", "C"]);
    const left = await removeTeam(t.db, id, teams[1]!.id);
    expect(left.map((x) => [x.name, x.seed])).toEqual([
      ["A", 1],
      ["C", 2],
    ]);
    await expect(removeTeam(t.db, id, "missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("reorders seeds from a full permutation only", async () => {
    const id = await newTournament();
    const [a, b, c] = await addTeams(t.db, id, ["A", "B", "C"]);
    const reordered = await reorderTeams(t.db, id, [c!.id, a!.id, b!.id]);
    expect(reordered.map((x) => x.name)).toEqual(["C", "A", "B"]);
    await expect(reorderTeams(t.db, id, [a!.id, b!.id])).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(reorderTeams(t.db, id, [a!.id, a!.id, b!.id])).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(reorderTeams(t.db, id, [a!.id, b!.id, "x"])).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("blocks every team change once the tournament has started", async () => {
    const id = await newTournament();
    const [a, b] = await addTeams(t.db, id, ["A", "B"]);
    await t.db.tournament.update({ where: { id }, data: { status: "IN_PROGRESS" } });
    const blocked = { code: "INVALID_STATE", message: expect.stringMatching(/forfeit/) };
    await expect(addTeams(t.db, id, ["C"])).rejects.toMatchObject(blocked);
    await expect(removeTeam(t.db, id, a!.id)).rejects.toMatchObject(blocked);
    await expect(reorderTeams(t.db, id, [b!.id, a!.id])).rejects.toMatchObject(blocked);
  });

  it("reports unknown tournaments", async () => {
    await expect(addTeams(t.db, "missing", ["A"])).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
