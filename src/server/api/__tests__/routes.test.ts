import { readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as createTournamentRoute } from "@/app/api/tournaments/route";
import { GET as getViewRoute } from "@/app/api/t/[slug]/route";
import { POST as addTeamsRoute } from "@/app/api/t/[slug]/teams/route";
import { DELETE as removeTeamRoute } from "@/app/api/t/[slug]/teams/[teamId]/route";
import { PUT as reorderRoute } from "@/app/api/t/[slug]/teams/order/route";
import { POST as startRoute } from "@/app/api/t/[slug]/start/route";
import { PUT as resultRoute } from "@/app/api/t/[slug]/matches/[matchId]/result/route";
import { POST as scheduleRoute } from "@/app/api/t/[slug]/schedule/route";
import type { PublicTeam, PublicView } from "@/lib/public-view";
import type { TestDb } from "@/server/__tests__/test-db";
import { ctx, request, useApiTestDb } from "./api-test-utils";

/** Route files covered by this suite, relative to src/app/api. */
const TESTED_ROUTES = [
  "tournaments/route.ts",
  "t/[slug]/route.ts",
  "t/[slug]/teams/route.ts",
  "t/[slug]/teams/[teamId]/route.ts",
  "t/[slug]/teams/order/route.ts",
  "t/[slug]/start/route.ts",
  "t/[slug]/matches/[matchId]/result/route.ts",
  "t/[slug]/schedule/route.ts",
  // Covered in events-route.test.ts.
  "t/[slug]/events/route.ts",
];

let t: TestDb;
let ipCounter = 0;
/** A fresh client address per test keeps the per-client rate limits out of the way. */
let ip = "";

beforeAll(async () => {
  t = await useApiTestDb();
});
afterAll(async () => t.cleanup());
beforeEach(() => {
  ipCounter += 1;
  ip = `10.1.0.${ipCounter}`;
});

type Format = "ROUND_ROBIN" | "SINGLE_ELIM";

async function create(format: Format = "ROUND_ROBIN", extra: Record<string, unknown> = {}) {
  const res = await createTournamentRoute(
    request("POST", {
      body: { name: "API Cup", sport: "Football", config: { format, ...extra } },
      ip,
    }),
  );
  return (await res.json()) as { slug: string; adminToken: string };
}

async function withTeams(
  names: string[],
  format: Format = "ROUND_ROBIN",
  extra: Record<string, unknown> = {},
) {
  const tournament = await create(format, extra);
  const res = await addTeamsRoute(
    request("POST", { body: { names }, token: tournament.adminToken, ip }),
    ctx({ slug: tournament.slug }),
  );
  const { teams } = (await res.json()) as { teams: PublicTeam[] };
  return { ...tournament, teams };
}

async function started(
  names: string[],
  format: Format = "ROUND_ROBIN",
  extra: Record<string, unknown> = {},
) {
  const tournament = await withTeams(names, format, extra);
  const res = await startRoute(
    request("POST", { token: tournament.adminToken, ip }),
    ctx({ slug: tournament.slug }),
  );
  return { ...tournament, view: (await res.json()) as PublicView };
}

async function errorOf(res: Response): Promise<{ status: number; code: string }> {
  const body = (await res.json()) as { error: { code: string } };
  return { status: res.status, code: body.error.code };
}

describe("route inventory", () => {
  it("covers every API route file", () => {
    const root = path.join(process.cwd(), "src", "app", "api");
    const found = (readdirSync(root, { recursive: true }) as string[])
      .map((f) => f.split(path.sep).join("/"))
      .filter((f) => f.endsWith("route.ts"));
    expect(found.sort()).toEqual([...TESTED_ROUTES].sort());
  });
});

describe("POST /api/tournaments", () => {
  it("creates a tournament", async () => {
    const res = await createTournamentRoute(
      request("POST", {
        body: { name: "Cup", sport: "Go", config: { format: "DOUBLE_ELIM" } },
        ip,
      }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      slug: expect.stringMatching(/^cup-/),
      adminToken: expect.any(String),
    });
  });

  it("rejects invalid bodies and malformed JSON", async () => {
    const bad = await createTournamentRoute(
      request("POST", { body: { name: "", sport: "Go", config: { format: "NOPE" } }, ip }),
    );
    expect(await errorOf(bad)).toEqual({ status: 400, code: "VALIDATION" });
    const malformed = await createTournamentRoute(request("POST", { rawBody: "{", ip }));
    expect(await errorOf(malformed)).toEqual({ status: 400, code: "VALIDATION" });
  });
});

describe("GET /api/t/:slug", () => {
  it("returns the public view without auth", async () => {
    const { slug, adminToken } = await withTeams(["A", "B"]);
    const res = await getViewRoute(request("GET"), ctx({ slug }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(adminToken);
    expect((JSON.parse(text) as PublicView).teams.map((x) => x.name)).toEqual(["A", "B"]);
  });

  it("returns 404 for unknown slugs", async () => {
    expect(await errorOf(await getViewRoute(request("GET"), ctx({ slug: "missing" })))).toEqual({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});

describe("admin authentication", () => {
  it("rejects missing and wrong tokens, and tokens for another tournament", async () => {
    const a = await create();
    const b = await create();
    const body = { names: ["X"] };
    expect(
      await errorOf(await addTeamsRoute(request("POST", { body, ip }), ctx({ slug: a.slug }))),
    ).toEqual({ status: 401, code: "UNAUTHORIZED" });
    expect(
      await errorOf(
        await addTeamsRoute(request("POST", { body, token: "nope", ip }), ctx({ slug: a.slug })),
      ),
    ).toEqual({
      status: 401,
      code: "UNAUTHORIZED",
    });
    expect(
      await errorOf(
        await addTeamsRoute(
          request("POST", { body, token: b.adminToken, ip }),
          ctx({ slug: a.slug }),
        ),
      ),
    ).toEqual({
      status: 401,
      code: "UNAUTHORIZED",
    });
    expect(
      await errorOf(
        await addTeamsRoute(
          request("POST", { body, token: a.adminToken, ip }),
          ctx({ slug: "missing" }),
        ),
      ),
    ).toEqual({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("guards every admin route", async () => {
    const { slug, teams } = await withTeams(["A", "B"]);
    const responses = await Promise.all([
      removeTeamRoute(request("DELETE", { ip }), ctx({ slug, teamId: teams[0]!.id })),
      reorderRoute(request("PUT", { body: { teamIds: [] }, ip }), ctx({ slug })),
      startRoute(request("POST", { ip }), ctx({ slug })),
      resultRoute(
        request("PUT", { body: { homeScore: 1, awayScore: 0 }, ip }),
        ctx({ slug, matchId: "x" }),
      ),
      scheduleRoute(request("POST", { body: {}, ip }), ctx({ slug })),
    ]);
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
  });
});

describe("POST /api/t/:slug/teams", () => {
  it("adds teams", async () => {
    const { teams } = await withTeams(["A", "B", "C"]);
    expect(teams.map((x) => [x.name, x.seed])).toEqual([
      ["A", 1],
      ["B", 2],
      ["C", 3],
    ]);
  });

  it("rejects empty lists, duplicates and changes after the start", async () => {
    const { slug, adminToken } = await withTeams(["A", "B"]);
    const add = (names: string[]) =>
      addTeamsRoute(request("POST", { body: { names }, token: adminToken, ip }), ctx({ slug }));
    expect(await errorOf(await add([]))).toEqual({ status: 400, code: "VALIDATION" });
    expect(await errorOf(await add(["a"]))).toEqual({ status: 409, code: "DUPLICATE" });
    await startRoute(request("POST", { token: adminToken, ip }), ctx({ slug }));
    expect(await errorOf(await add(["C"]))).toEqual({ status: 409, code: "INVALID_STATE" });
  });
});

describe("DELETE /api/t/:slug/teams/:teamId", () => {
  it("removes a team and reseeds", async () => {
    const { slug, adminToken, teams } = await withTeams(["A", "B", "C"]);
    const res = await removeTeamRoute(
      request("DELETE", { token: adminToken, ip }),
      ctx({ slug, teamId: teams[0]!.id }),
    );
    expect(res.status).toBe(200);
    expect(
      ((await res.json()) as { teams: PublicTeam[] }).teams.map((x) => [x.name, x.seed]),
    ).toEqual([
      ["B", 1],
      ["C", 2],
    ]);
  });

  it("returns 404 for unknown teams and 409 after the start", async () => {
    const { slug, adminToken, teams } = await withTeams(["A", "B"]);
    const remove = (teamId: string) =>
      removeTeamRoute(request("DELETE", { token: adminToken, ip }), ctx({ slug, teamId }));
    expect(await errorOf(await remove("missing"))).toEqual({ status: 404, code: "NOT_FOUND" });
    await startRoute(request("POST", { token: adminToken, ip }), ctx({ slug }));
    expect(await errorOf(await remove(teams[0]!.id))).toEqual({
      status: 409,
      code: "INVALID_STATE",
    });
  });
});

describe("PUT /api/t/:slug/teams/order", () => {
  it("reseeds teams", async () => {
    const { slug, adminToken, teams } = await withTeams(["A", "B"]);
    const res = await reorderRoute(
      request("PUT", { body: { teamIds: [teams[1]!.id, teams[0]!.id] }, token: adminToken, ip }),
      ctx({ slug }),
    );
    expect(((await res.json()) as { teams: PublicTeam[] }).teams.map((x) => x.name)).toEqual([
      "B",
      "A",
    ]);
  });

  it("rejects partial orders and bad bodies", async () => {
    const { slug, adminToken, teams } = await withTeams(["A", "B"]);
    const put = (body: unknown) =>
      reorderRoute(request("PUT", { body, token: adminToken, ip }), ctx({ slug }));
    expect(await errorOf(await put({ teamIds: [teams[0]!.id] }))).toEqual({
      status: 400,
      code: "VALIDATION",
    });
    expect(await errorOf(await put({ order: "A,B" }))).toEqual({ status: 400, code: "VALIDATION" });
  });
});

describe("POST /api/t/:slug/start", () => {
  it("generates fixtures and returns the view", async () => {
    const { view } = await started(["A", "B", "C", "D"]);
    expect(view.tournament.status).toBe("IN_PROGRESS");
    expect(view.stages[0]!.matches).toHaveLength(6);
  });

  it("needs two teams and cannot run twice", async () => {
    const lonely = await withTeams(["A"]);
    expect(
      await errorOf(
        await startRoute(
          request("POST", { token: lonely.adminToken, ip }),
          ctx({ slug: lonely.slug }),
        ),
      ),
    ).toEqual({
      status: 400,
      code: "VALIDATION",
    });
    const { slug, adminToken } = await started(["A", "B"]);
    expect(
      await errorOf(await startRoute(request("POST", { token: adminToken, ip }), ctx({ slug }))),
    ).toEqual({
      status: 409,
      code: "INVALID_STATE",
    });
  });
});

describe("PUT /api/t/:slug/matches/:matchId/result", () => {
  it("records a result and returns the updated view", async () => {
    const { slug, adminToken, view } = await started(["A", "B", "C", "D"], "SINGLE_ELIM");
    const match = view.stages[0]!.matches[0]!;
    const res = await resultRoute(
      request("PUT", { body: { homeScore: 3, awayScore: 1 }, token: adminToken, ip }),
      ctx({ slug, matchId: match.id }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { changedMatchIds: string[]; view: PublicView };
    expect(body.changedMatchIds).toHaveLength(2);
    expect(body.view.stages[0]!.matches.find((m) => m.round === 2)!.homeTeamId).toBe(
      match.homeTeamId,
    );
  });

  it("rejects bad scores, knockout draws, unknown matches and other tournaments' matches", async () => {
    const { slug, adminToken, view } = await started(["A", "B"], "SINGLE_ELIM");
    const other = await started(["C", "D"], "SINGLE_ELIM");
    const put = (matchId: string, body: unknown) =>
      resultRoute(request("PUT", { body, token: adminToken, ip }), ctx({ slug, matchId }));
    const matchId = view.stages[0]!.matches[0]!.id;
    expect(await errorOf(await put(matchId, { homeScore: -1, awayScore: 0 }))).toEqual({
      status: 400,
      code: "VALIDATION",
    });
    expect(await errorOf(await put(matchId, { homeScore: 1, awayScore: 1 }))).toEqual({
      status: 400,
      code: "VALIDATION",
    });
    expect(await errorOf(await put("missing", { homeScore: 1, awayScore: 0 }))).toEqual({
      status: 404,
      code: "NOT_FOUND",
    });
    expect(
      await errorOf(
        await put(other.view.stages[0]!.matches[0]!.id, { homeScore: 1, awayScore: 0 }),
      ),
    ).toEqual({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("returns 409 for stale versions and for edits that need confirmation", async () => {
    const { slug, adminToken, view } = await started(["A", "B", "C", "D"], "SINGLE_ELIM");
    const put = (matchId: string, body: unknown) =>
      resultRoute(request("PUT", { body, token: adminToken, ip }), ctx({ slug, matchId }));
    const [semi1, semi2, final] = view.stages[0]!.matches;
    await put(semi1!.id, { homeScore: 1, awayScore: 0 });
    expect(
      await errorOf(await put(semi1!.id, { homeScore: 2, awayScore: 0, expectedVersion: 0 })),
    ).toEqual({
      status: 409,
      code: "VERSION_CONFLICT",
    });
    await put(semi2!.id, { homeScore: 1, awayScore: 0 });
    await put(final!.id, { homeScore: 1, awayScore: 0 });
    const res = await put(semi1!.id, { homeScore: 0, awayScore: 1 });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: { code: "CONFIRMATION_REQUIRED", details: { invalidated: [{ id: final!.id }] } },
    });
    const confirmed = await put(semi1!.id, { homeScore: 0, awayScore: 1, confirmReset: true });
    expect(await confirmed.json()).toMatchObject({
      resetMatchIds: [final!.id],
      status: "IN_PROGRESS",
    });
  });
});

describe("POST /api/t/:slug/schedule", () => {
  const body = { venues: ["Court 1"], startTime: "2026-11-01T09:00:00Z", slotMinutes: 45 };

  it("schedules open matches", async () => {
    const { slug, adminToken } = await started(["A", "B", "C"]);
    const res = await scheduleRoute(
      request("POST", { body, token: adminToken, ip }),
      ctx({ slug }),
    );
    expect(await res.json()).toEqual({ scheduled: 3, unscheduled: [] });
    const view = (await (await getViewRoute(request("GET"), ctx({ slug }))).json()) as PublicView;
    expect(view.venues.map((v) => v.name)).toEqual(["Court 1"]);
    expect(
      view.stages[0]!.matches.every(
        (m) => m.scheduledAt !== null && m.venueId === view.venues[0]!.id,
      ),
    ).toBe(true);
  });

  it("validates the body and requires a started tournament", async () => {
    const { slug, adminToken } = await withTeams(["A", "B"]);
    const post = (b: unknown) =>
      scheduleRoute(request("POST", { body: b, token: adminToken, ip }), ctx({ slug }));
    expect(await errorOf(await post({ ...body, slotMinutes: 1 }))).toEqual({
      status: 400,
      code: "VALIDATION",
    });
    expect(await errorOf(await post(body))).toEqual({ status: 409, code: "INVALID_STATE" });
  });
});
