import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_TOURNAMENTS } from "@/lib/demo";
import { getPublicView } from "@/server/services/public-view";
import { seedDemo } from "@/server/seed";
import { createTestDb, type TestDb } from "./test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.cleanup());

describe("seedDemo", () => {
  it(
    "creates the three linked demo tournaments in their documented shapes",
    { timeout: 60_000 },
    async () => {
      const demos = await seedDemo(t.db);
      expect(demos.map((d) => d.slug)).toEqual(DEMO_TOURNAMENTS.map((d) => d.slug));

      const league = await getPublicView(t.db, "demo-league");
      expect(league.tournament.format).toBe("ROUND_ROBIN");
      expect(league.teams).toHaveLength(8);
      const leagueMatches = league.stages[0]!.matches;
      expect(leagueMatches.filter((m) => m.homeScore !== null)).toHaveLength(20);
      expect(leagueMatches.filter((m) => m.status === "LIVE")).toHaveLength(1);
      expect(league.stages[0]!.standings![0]!.played).toBeGreaterThan(0);

      const cup = await getPublicView(t.db, "demo-cup");
      expect(cup.teams).toHaveLength(12);
      const byes = cup.stages[0]!.matches.filter(
        (m) => m.status === "FINISHED" && m.homeScore === null,
      );
      expect(byes).toHaveLength(4);

      const world = await getPublicView(t.db, "demo-world-cup");
      expect(world.teams).toHaveLength(16);
      expect(world.stages.map((s) => s.type)).toEqual([
        "GROUP",
        "GROUP",
        "GROUP",
        "GROUP",
        "SINGLE_ELIM",
      ]);
      expect(
        world.stages.slice(0, 4).every((s) => s.matches.every((m) => m.status === "FINISHED")),
      ).toBe(true);
      // Quarter-finals played, semi-finals ready.
      const knockout = world.stages[4]!.matches;
      expect(knockout.filter((m) => m.round === 1).every((m) => m.status === "FINISHED")).toBe(
        true,
      );
      expect(knockout.filter((m) => m.round === 2).every((m) => m.status === "SCHEDULED")).toBe(
        true,
      );
      expect(
        world.stages
          .flatMap((s) => s.matches)
          .every((m) => m.scheduledAt !== null || m.status === "FINISHED"),
      ).toBe(true);
    },
  );

  it(
    "is repeatable: re-running replaces the demos with identical results",
    { timeout: 60_000 },
    async () => {
      const before = await getPublicView(t.db, "demo-league");
      await seedDemo(t.db);
      const after = await getPublicView(t.db, "demo-league");
      expect(await t.db.tournament.count({ where: { slug: "demo-league" } })).toBe(1);
      const scores = (v: typeof before) =>
        v.stages[0]!.matches.map((m) => [m.homeScore, m.awayScore]);
      expect(scores(after)).toEqual(scores(before));
    },
  );
});
