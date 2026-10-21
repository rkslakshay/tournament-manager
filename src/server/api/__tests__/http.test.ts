import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { addTeamsBody, createTournamentBody, resultBody, scheduleBody } from "@/lib/api-schemas";
import { bearerToken, errorResponse, handle, parseBody } from "@/server/api/http";
import { ServiceError } from "@/server/errors";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://test/api", { method: "POST", body, headers });

describe("errorResponse", () => {
  it("maps service errors to their status and the standard body", async () => {
    const res = errorResponse(
      new ServiceError("CONFIRMATION_REQUIRED", "Confirm", { invalidated: [] }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: { code: "CONFIRMATION_REQUIRED", message: "Confirm", details: { invalidated: [] } },
    });
  });

  it("omits details when there are none and sets Retry-After for rate limits", async () => {
    expect(await errorResponse(new ServiceError("NOT_FOUND", "Gone")).json()).toEqual({
      error: { code: "NOT_FOUND", message: "Gone" },
    });
    const limited = errorResponse(
      new ServiceError("RATE_LIMITED", "Slow down", { retryAfterSeconds: 30 }),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("30");
  });

  it("maps zod errors to 400 and unknown errors to a generic 500", async () => {
    const zodError = z.object({ a: z.string() }).safeParse({}).error;
    expect(errorResponse(zodError).status).toBe(400);
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = errorResponse(new Error("database exploded"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("exploded");
    spy.mockRestore();
  });
});

describe("parseBody", () => {
  it("validates JSON bodies", async () => {
    await expect(parseBody(post('{"names":["A"]}'), addTeamsBody)).resolves.toEqual({
      names: ["A"],
    });
    await expect(parseBody(post("{nope"), addTeamsBody)).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/JSON/),
    });
    await expect(parseBody(post('{"names":[]}'), addTeamsBody)).rejects.toMatchObject({
      code: "VALIDATION",
      details: expect.anything(),
    });
  });
});

describe("handle", () => {
  it("passes responses through and converts thrown errors", async () => {
    expect((await handle(async () => new Response("ok"))).status).toBe(200);
    expect(
      (await handle(async () => Promise.reject(new ServiceError("UNAUTHORIZED", "no")))).status,
    ).toBe(401);
  });
});

describe("bearerToken", () => {
  it("reads Authorization: Bearer tokens", () => {
    expect(bearerToken(post("", { Authorization: "Bearer abc" }))).toBe("abc");
    expect(bearerToken(post("", { Authorization: "bearer  xyz " }))).toBe("xyz");
    expect(bearerToken(post("", { Authorization: "Basic abc" }))).toBeNull();
    expect(bearerToken(post(""))).toBeNull();
  });
});

describe("request schemas", () => {
  it("accept valid bodies and fill defaults", () => {
    expect(
      createTournamentBody.parse({
        name: " Cup ",
        sport: "Chess",
        config: { format: "SINGLE_ELIM" },
      }),
    ).toMatchObject({
      name: "Cup",
      config: { thirdPlaceMatch: false },
    });
    expect(
      scheduleBody.parse({
        venues: ["Court 1"],
        startTime: "2026-11-01T09:00:00Z",
        slotMinutes: 30,
      }).minRestSlots,
    ).toBe(0);
    expect(resultBody.parse({ homeScore: 1, awayScore: 0 })).toEqual({
      homeScore: 1,
      awayScore: 0,
    });
  });

  it("reject invalid bodies", () => {
    expect(resultBody.safeParse({ homeScore: 1.5, awayScore: 0 }).success).toBe(false);
    expect(resultBody.safeParse({ homeScore: "1", awayScore: 0 }).success).toBe(false);
    expect(
      scheduleBody.safeParse({ venues: [], startTime: "2026-11-01T09:00:00Z", slotMinutes: 30 })
        .success,
    ).toBe(false);
    expect(
      scheduleBody.safeParse({ venues: ["A"], startTime: "tomorrow", slotMinutes: 30 }).success,
    ).toBe(false);
    expect(addTeamsBody.safeParse({ names: ["  "] }).success).toBe(false);
  });
});
