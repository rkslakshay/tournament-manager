import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as createTournament } from "@/app/api/tournaments/route";
import { POST as addTeams } from "@/app/api/t/[slug]/teams/route";
import { clientKey, enforceRateLimit, RateLimiter } from "@/server/api/rate-limit";
import type { TestDb } from "@/server/__tests__/test-db";
import { ctx, request, useApiTestDb } from "./api-test-utils";

describe("RateLimiter", () => {
  it("allows up to the limit per window, then reports when to retry", () => {
    let now = 0;
    const limiter = new RateLimiter({ limit: 2, windowMs: 10_000, now: () => now });
    expect(limiter.hit("a")).toEqual({ allowed: true, remaining: 1, retryAfterSeconds: 0 });
    expect(limiter.hit("a").allowed).toBe(true);
    now = 2_500;
    expect(limiter.hit("a")).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 8 });
    expect(limiter.hit("b").allowed).toBe(true);
    now = 10_000;
    expect(limiter.hit("a").allowed).toBe(true);
  });

  it("prunes expired windows once it tracks many keys", () => {
    let now = 0;
    const limiter = new RateLimiter({ limit: 1, windowMs: 1_000, now: () => now });
    for (let i = 0; i < 10_000; i++) limiter.hit(`k${i}`);
    now = 5_000;
    expect(limiter.hit("k1").allowed).toBe(true);
  });
});

describe("clientKey", () => {
  it("uses the first forwarded address, then x-real-ip", () => {
    const req = (headers: Record<string, string>) => new Request("http://x", { headers });
    expect(clientKey(req({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientKey(req({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientKey(req({}))).toBe("unknown");
  });
});

describe("enforceRateLimit", () => {
  it("throws RATE_LIMITED with retry details", () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 });
    const req = request("POST", { ip: "9.9.9.9" });
    enforceRateLimit(req, limiter);
    expect(() => enforceRateLimit(req, limiter)).toThrow(
      expect.objectContaining({ code: "RATE_LIMITED", details: { retryAfterSeconds: 60 } }),
    );
  });
});

describe("rate-limited routes", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await useApiTestDb();
  });
  afterAll(async () => t.cleanup());

  const body = { name: "Limited", sport: "Chess", config: { format: "ROUND_ROBIN" } };

  it("limits tournament creation to 10 per hour per client", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++)
      statuses.push((await createTournament(request("POST", { body, ip: "20.0.0.1" }))).status);
    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
    const limited = await createTournament(request("POST", { body, ip: "20.0.0.1" }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(await limited.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
    expect((await createTournament(request("POST", { body, ip: "20.0.0.2" }))).status).toBe(201);
  });

  it("limits admin writes before checking the token", async () => {
    const created = await createTournament(request("POST", { body, ip: "30.0.0.1" }));
    const { slug } = (await created.json()) as { slug: string };
    const statuses: number[] = [];
    for (let i = 0; i < 121; i++) {
      statuses.push(
        (
          await addTeams(
            request("POST", { body: { names: ["X"] }, token: "wrong", ip: "30.0.0.9" }),
            ctx({ slug }),
          )
        ).status,
      );
    }
    expect(statuses.slice(0, 120).every((s) => s === 401)).toBe(true);
    expect(statuses[120]).toBe(429);
  });
});
