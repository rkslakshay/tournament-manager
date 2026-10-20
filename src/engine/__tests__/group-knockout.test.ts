import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  assignGroups,
  generateGroupKnockout,
  groupLabel,
  resolveGroupRankings,
} from "@/engine/group-knockout";
import { propagate } from "@/engine/propagation";
import {
  DEFAULT_STANDINGS_CONFIG,
  type Match,
  type Source,
  type Stage,
  type Team,
} from "@/engine/types";
import { seededTeams, seedOf, withScore } from "./helpers";

const config = DEFAULT_STANDINGS_CONFIG;

/** Teams with their group label applied, as the service stores them. */
function labelled(teams: Team[], groupOf: Record<string, string>): Team[] {
  return teams.map((t) => ({ ...t, groupLabel: groupOf[t.id] ?? null }));
}

/** Play every match in the given stages; the better seed wins 1-0. */
function playStages(stages: Stage[]): Stage[] {
  return stages.map((stage) => ({
    ...stage,
    matches: stage.matches.reduce<Match[]>(
      (ms, m) =>
        m.homeTeamId && m.awayTeamId
          ? withScore(
              ms,
              m.id,
              seedOf(m.homeTeamId) < seedOf(m.awayTeamId) ? 1 : 0,
              seedOf(m.homeTeamId) < seedOf(m.awayTeamId) ? 0 : 1,
            )
          : ms,
      stage.matches,
    ),
  }));
}

const groupRef = (s: Source | null) => (s?.type === "groupRank" ? s.group : null);

describe("groupLabel", () => {
  it("labels groups A, B, ... Z, then AA", () => {
    expect([0, 1, 25, 26].map(groupLabel)).toEqual(["A", "B", "Z", "AA"]);
  });
});

describe("assignGroups", () => {
  it("snake-drafts teams into groups by seed", () => {
    const groups = assignGroups(seededTeams(8), 2);
    expect(groups.A?.map((t) => t.id)).toEqual(["s1", "s4", "s5", "s8"]);
    expect(groups.B?.map((t) => t.id)).toEqual(["s2", "s3", "s6", "s7"]);
  });

  it("property: group sizes differ by at most one and top seeds are spread across groups", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 8 }), fc.integer({ min: 0, max: 30 }), (g, extra) => {
        const n = 2 * g + extra;
        const groups = Object.values(assignGroups(seededTeams(n), g));
        expect(groups).toHaveLength(g);
        const sizes = groups.map((ts) => ts.length);
        expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
        expect(new Set(groups.flat().map((t) => t.id)).size).toBe(n);
        for (const ts of groups) expect(ts.filter((t) => t.seed <= g)).toHaveLength(1);
      }),
    );
  });
});

describe("generateGroupKnockout", () => {
  it("creates a round-robin stage per group plus a knockout stage", () => {
    const { stages, groupOf } = generateGroupKnockout(seededTeams(8), {
      groups: 2,
      advancePerGroup: 2,
      idPrefix: "t-",
    });
    expect(stages.map((s) => [s.id, s.type, s.groupLabel, s.order])).toEqual([
      ["t-group-A", "GROUP", "A", 1],
      ["t-group-B", "GROUP", "B", 2],
      ["t-ko", "SINGLE_ELIM", null, 3],
    ]);
    expect(stages[0]?.matches).toHaveLength(6);
    expect(
      stages[0]?.matches.every((m) => m.stageId === "t-group-A" && m.status === "SCHEDULED"),
    ).toBe(true);
    expect(groupOf).toMatchObject({ s1: "A", s2: "B", s3: "B", s4: "A" });
    expect(new Set(stages.flatMap((s) => s.matches.map((m) => m.id))).size).toBe(6 + 6 + 3);
  });

  it("crosses groups in round one: A1 vs B2 and B1 vs A2", () => {
    const { stages } = generateGroupKnockout(seededTeams(8), { groups: 2, advancePerGroup: 2 });
    const ko = stages.find((s) => s.type === "SINGLE_ELIM") as Stage;
    const r1 = ko.matches.filter((m) => m.round === 1);
    expect(r1.map((m) => [m.homeSource, m.awaySource])).toEqual([
      [
        { type: "groupRank", group: "A", rank: 1 },
        { type: "groupRank", group: "B", rank: 2 },
      ],
      [
        { type: "groupRank", group: "B", rank: 1 },
        { type: "groupRank", group: "A", rank: 2 },
      ],
    ]);
  });

  it("supports two legs and a third-place match", () => {
    const { stages } = generateGroupKnockout(seededTeams(8), {
      groups: 2,
      advancePerGroup: 2,
      legs: 2,
      thirdPlaceMatch: true,
    });
    expect(stages[0]?.matches).toHaveLength(12);
    expect(stages[2]?.matches.some((m) => m.id === "3rd")).toBe(true);
  });

  it("validates the configuration", () => {
    expect(() => generateGroupKnockout(seededTeams(8), { groups: 0, advancePerGroup: 1 })).toThrow(
      /at least 1 group/,
    );
    expect(() => generateGroupKnockout(seededTeams(5), { groups: 3, advancePerGroup: 1 })).toThrow(
      /at least 2 teams/,
    );
    expect(() => generateGroupKnockout(seededTeams(8), { groups: 2, advancePerGroup: 5 })).toThrow(
      /advance/,
    );
    expect(() => generateGroupKnockout(seededTeams(8), { groups: 1, advancePerGroup: 1 })).toThrow(
      /at least 2 qualifiers/,
    );
  });

  it("property: no round-one knockout match pairs two teams from the same group", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }),
        fc.constantFrom(1, 2),
        fc.integer({ min: 0, max: 16 }),
        (g, k, extra) => {
          const { stages } = generateGroupKnockout(seededTeams(2 * g + extra), {
            groups: g,
            advancePerGroup: k,
          });
          const ko = stages.find((s) => s.type === "SINGLE_ELIM") as Stage;
          const entrants = ko.matches
            .filter((m) => m.round === 1)
            .flatMap((m) => [m.homeSource, m.awaySource]);
          expect(entrants.filter((s) => s?.type === "groupRank")).toHaveLength(g * k);
          for (const m of ko.matches.filter(
            (x) => x.round === 1 && x.awaySource?.type === "groupRank",
          )) {
            expect(groupRef(m.homeSource)).not.toBe(groupRef(m.awaySource));
          }
        },
      ),
    );
  });
});

describe("resolveGroupRankings", () => {
  it("ranks only groups whose matches are all finished", () => {
    const { stages, groupOf } = generateGroupKnockout(seededTeams(8), {
      groups: 2,
      advancePerGroup: 2,
    });
    const teams = labelled(seededTeams(8), groupOf);
    const groupStages = stages.filter((s) => s.type === "GROUP");
    expect(resolveGroupRankings(groupStages, teams, config)).toEqual({});
    const onlyA = [playStages([groupStages[0] as Stage])[0] as Stage, groupStages[1] as Stage];
    expect(resolveGroupRankings(onlyA, teams, config)).toEqual({ A: ["s1", "s4", "s5", "s8"] });
  });

  it("fills the knockout once the groups are played", () => {
    const { stages, groupOf } = generateGroupKnockout(seededTeams(8), {
      groups: 2,
      advancePerGroup: 2,
    });
    const teams = labelled(seededTeams(8), groupOf);
    const groups = playStages(stages.filter((s) => s.type === "GROUP"));
    const rankings = resolveGroupRankings(groups, teams, config);
    const ko = propagate((stages[2] as Stage).matches, { groupRankings: rankings }).matches;
    expect(ko.filter((m) => m.round === 1).map((m) => [m.homeTeamId, m.awayTeamId])).toEqual([
      ["s1", "s3"],
      ["s2", "s4"],
    ]);
  });
});
