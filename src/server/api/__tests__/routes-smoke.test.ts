import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as createTournament } from "@/app/api/tournaments/route";
import { GET as getView } from "@/app/api/t/[slug]/route";
import { POST as addTeams } from "@/app/api/t/[slug]/teams/route";
import { POST as start } from "@/app/api/t/[slug]/start/route";
import { PUT as putResult } from "@/app/api/t/[slug]/matches/[matchId]/result/route";
import type { PublicView } from "@/lib/public-view";
import type { TestDb } from "@/server/__tests__/test-db";
import { ctx, request, useApiTestDb } from "./api-test-utils";

let t: TestDb;
beforeAll(async () => {
  t = await useApiTestDb();
});
afterAll(async () => t.cleanup());

describe("API happy path", () => {
  it("creates, fills, starts and scores a tournament", async () => {
    const created = await createTournament(
      request("POST", {
        body: { name: "Smoke Cup", sport: "Football", config: { format: "SINGLE_ELIM" } },
      }),
    );
    expect(created.status).toBe(201);
    const { slug, adminToken } = (await created.json()) as { slug: string; adminToken: string };

    const teams = await addTeams(
      request("POST", { body: { names: ["A", "B"] }, token: adminToken }),
      ctx({ slug }),
    );
    expect(teams.status).toBe(201);

    const started = await start(request("POST", { token: adminToken }), ctx({ slug }));
    const view = (await started.json()) as PublicView;
    const final = view.stages[0]!.matches[0]!;

    const scored = await putResult(
      request("PUT", {
        body: { homeScore: 2, awayScore: 1, expectedVersion: final.version },
        token: adminToken,
      }),
      ctx({ slug, matchId: final.id }),
    );
    expect(scored.status).toBe(200);
    expect(await scored.json()).toMatchObject({
      status: "COMPLETED",
      view: { championTeamId: final.homeTeamId },
    });

    const publicView = await getView(request("GET"), ctx({ slug }));
    expect(publicView.headers.get("cache-control")).toBe("no-store");
    expect(((await publicView.json()) as PublicView).tournament.status).toBe("COMPLETED");
  });
});
