import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";
import { hashToken, tokenMatchesHash } from "@/server/security";
import { authorizeAdmin, createTournament } from "@/server/services/tournaments";
import { createTestDb, type TestDb } from "./test-db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.cleanup());

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Summer Cup 2026!")).toBe("summer-cup-2026");
    expect(slugify("  Café — Ligue  ")).toBe("cafe-ligue");
    expect(slugify("!!!")).toBe("tournament");
    expect(slugify("a".repeat(60))).toHaveLength(40);
  });
});

describe("admin tokens", () => {
  it("matches only the original token", () => {
    const hash = hashToken("secret");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenMatchesHash("secret", hash)).toBe(true);
    expect(tokenMatchesHash("Secret", hash)).toBe(false);
    expect(tokenMatchesHash("secret", "abcd")).toBe(false);
  });
});

describe("createTournament", () => {
  it("creates a REGISTRATION tournament with a unique slug and a hashed token", async () => {
    const created = await createTournament(t.db, {
      name: "Summer Cup",
      sport: "Football",
      config: { format: "ROUND_ROBIN" },
    });
    expect(created.slug).toMatch(/^summer-cup-[a-z0-9]{6}$/);
    expect(created.adminToken).toHaveLength(43);
    expect(created.tournament).toMatchObject({
      name: "Summer Cup",
      status: "REGISTRATION",
      config: { format: "ROUND_ROBIN", legs: 1 },
    });
    const row = await t.db.tournament.findUniqueOrThrow({ where: { slug: created.slug } });
    expect(row.adminTokenHash).toBe(hashToken(created.adminToken));
    expect(row.adminTokenHash).not.toContain(created.adminToken);
  });

  it("gives tournaments with the same name different slugs", async () => {
    const input = { name: "Same", sport: "Chess", config: { format: "SINGLE_ELIM" as const } };
    const [a, b] = await Promise.all([
      createTournament(t.db, input),
      createTournament(t.db, input),
    ]);
    expect(a.slug).not.toBe(b.slug);
    expect(a.adminToken).not.toBe(b.adminToken);
  });

  it("validates input", async () => {
    await expect(
      createTournament(t.db, { name: " ", sport: "x", config: { format: "ROUND_ROBIN" } }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      status: 400,
    });
    await expect(
      createTournament(t.db, { name: "Cup", sport: "x", config: { format: "GROUP_KNOCKOUT" } }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("authorizeAdmin", () => {
  it("accepts the right token and rejects missing or wrong ones", async () => {
    const { slug, adminToken } = await createTournament(t.db, {
      name: "Auth",
      sport: "Go",
      config: { format: "ROUND_ROBIN" },
    });
    await expect(authorizeAdmin(t.db, slug, adminToken)).resolves.toMatchObject({ slug });
    await expect(authorizeAdmin(t.db, slug, "wrong")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
    await expect(authorizeAdmin(t.db, slug, undefined)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(authorizeAdmin(t.db, "missing", adminToken)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
