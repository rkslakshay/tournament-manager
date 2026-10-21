import { describe, expect, it } from "vitest";
import {
  adminUrl,
  buildCreateRequest,
  defaultWalkoverScore,
  DEFAULT_WIZARD_FORM,
  usesLeagueRules,
} from "@/lib/wizard";

const base = { ...DEFAULT_WIZARD_FORM, name: "Cup", sport: "Chess" };

describe("buildCreateRequest", () => {
  it("keeps only the settings that apply to the format", () => {
    const rr = buildCreateRequest({ ...base, legs: 2, thirdPlaceMatch: true });
    expect(rr).toMatchObject({
      ok: true,
      body: { config: { format: "ROUND_ROBIN", legs: 2, thirdPlaceMatch: false } },
    });
    const se = buildCreateRequest({
      ...base,
      format: "SINGLE_ELIM",
      legs: 2,
      thirdPlaceMatch: true,
    });
    expect(se).toMatchObject({
      ok: true,
      body: { config: { format: "SINGLE_ELIM", legs: 1, thirdPlaceMatch: true } },
    });
    const de = buildCreateRequest({ ...base, format: "DOUBLE_ELIM", grandFinalReset: false });
    expect(de).toMatchObject({ ok: true, body: { config: { grandFinalReset: false } } });
    const gk = buildCreateRequest({
      ...base,
      format: "GROUP_KNOCKOUT",
      groups: 4,
      advancePerGroup: 1,
    });
    expect(gk).toMatchObject({ ok: true, body: { config: { groups: 4, advancePerGroup: 1 } } });
  });

  it("reports field errors", () => {
    const result = buildCreateRequest({ ...base, name: " ", groups: 0, format: "GROUP_KNOCKOUT" });
    expect(result).toEqual({
      ok: false,
      errors: { name: "Name is required", groups: expect.any(String) },
    });
  });
});

describe("helpers", () => {
  it("knows which formats use league rules", () => {
    expect(
      ["ROUND_ROBIN", "SINGLE_ELIM", "DOUBLE_ELIM", "GROUP_KNOCKOUT"].map((f) =>
        usesLeagueRules(f as never),
      ),
    ).toEqual([true, false, false, true]);
  });

  it("builds the admin URL with an encoded token", () => {
    expect(adminUrl("https://x.test", "cup-1", "a+b/c")).toBe(
      "https://x.test/t/cup-1/admin?token=a%2Bb%2Fc",
    );
  });
});

describe("defaultWalkoverScore", () => {
  it("is 1-0 for game-scored sports and 3-0 otherwise, and lands in the request", () => {
    expect(defaultWalkoverScore(" Chess ")).toEqual({ winner: 1, loser: 0 });
    expect(defaultWalkoverScore("Football")).toEqual({ winner: 3, loser: 0 });
    expect(buildCreateRequest({ ...base, sport: "Table tennis" })).toMatchObject({
      ok: true,
      body: { config: { walkoverScore: { winner: 1, loser: 0 } } },
    });
  });
});
