import { describe, expect, it } from "vitest";
import { planStages } from "@/lib/plan-stages";
import type { PublicView } from "@/lib/public-view";
import { parseTournamentConfig, type TournamentConfigInput } from "@/lib/tournament-config";
import {
  configOf,
  indexMatches,
  isWalkover,
  roundsOf,
  slotText,
  stageTitle,
  teamNamer,
  withOptimisticResult,
  allowsDraws,
} from "@/lib/view-model";

/** A public view built from generated fixtures, as the server would return it. */
function viewFor(input: TournamentConfigInput, teamCount: number): PublicView {
  const config = parseTournamentConfig(input);
  const teams = Array.from({ length: teamCount }, (_, i) => ({
    id: `t${i + 1}`,
    name: `Team ${i + 1}`,
    seed: i + 1,
  }));
  const plan = planStages(config, teams, "");
  return {
    tournament: {
      slug: "x",
      name: "X",
      sport: "Football",
      status: "IN_PROGRESS",
      format: config.format,
      rules: {
        legs: config.legs,
        pointsForWin: config.pointsForWin,
        pointsForDraw: config.pointsForDraw,
        pointsForLoss: config.pointsForLoss,
        tiebreakers: config.tiebreakers,
        thirdPlaceMatch: config.thirdPlaceMatch,
        grandFinalReset: config.grandFinalReset,
        groups: config.groups ?? null,
        advancePerGroup: config.advancePerGroup ?? null,
      },
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    teams: teams.map((t) => ({ ...t, groupLabel: plan.groupOf[t.id] ?? null })),
    venues: [],
    stages: plan.stages.map((s) => ({
      ...s,
      standings: null,
      matches: s.matches.map((m) => ({
        ...m,
        decidedBy: null,
        scheduledAt: null,
        venueId: null,
        version: 0,
      })),
    })),
    championTeamId: null,
  };
}

describe("view model", () => {
  it("labels single-elimination rounds and describes pending slots", () => {
    const view = viewFor({ format: "SINGLE_ELIM", thirdPlaceMatch: true }, 6);
    const stage = view.stages[0]!;
    expect(stageTitle(stage)).toBe("Knockout");
    expect(roundsOf(stage).map((r) => [r.title, r.matches.length])).toEqual([
      ["Quarter-finals", 4],
      ["Semi-finals", 2],
      ["Final", 2],
    ]);
    const index = indexMatches(view);
    const semi = stage.matches.find((m) => m.id === "r2m1")!;
    expect(slotText(view, index, semi, "home")).toBe("Team 1");
    expect(slotText(view, index, semi, "away")).toBe("Winner of QF 2");
    const bye = stage.matches.find((m) => m.id === "r1m1")!;
    expect(isWalkover(bye)).toBe(true);
    expect(slotText(view, index, bye, "away")).toBe("Bye");
    expect(index.get("3rd")?.label).toBe("3rd place");
  });

  it("orders double-elimination rounds: winners, losers, then one grand-final group", () => {
    const view = viewFor({ format: "DOUBLE_ELIM" }, 4);
    const titles = roundsOf(view.stages[0]!).map((r) => r.title);
    expect(titles).toEqual([
      "Winners semi-finals",
      "Winners final",
      "Losers round 1",
      "Losers round 2",
      "Grand final",
    ]);
    expect(roundsOf(view.stages[0]!).at(-1)!.matches).toHaveLength(2);
    expect(stageTitle(view.stages[0]!)).toBe("Bracket");
  });

  it("titles groups and describes group-rank slots", () => {
    const view = viewFor({ format: "GROUP_KNOCKOUT", groups: 2, advancePerGroup: 2 }, 8);
    expect(view.stages.map(stageTitle)).toEqual(["Group A", "Group B", "Knockout"]);
    const index = indexMatches(view);
    const ko = view.stages[2]!.matches[0]!;
    expect(slotText(view, index, ko, "home")).toBe("Group A 1st");
    expect(roundsOf(view.stages[0]!)[0]!.title).toBe("Round 1");
  });

  it("names teams and rebuilds the config", () => {
    const view = viewFor({ format: "ROUND_ROBIN", legs: 2, pointsForWin: 2 }, 3);
    expect(stageTitle(view.stages[0]!)).toBe("League");
    expect(teamNamer(view)("t2")).toBe("Team 2");
    expect(teamNamer(view)(null)).toBe("TBD");
    expect(teamNamer(view)("zz")).toBe("Unknown team");
    expect(configOf(view)).toMatchObject({ format: "ROUND_ROBIN", legs: 2, pointsForWin: 2 });
  });
});

describe("withOptimisticResult", () => {
  it("applies one result without touching anything else", () => {
    const view = viewFor({ format: "ROUND_ROBIN" }, 4);
    const target = view.stages[0]!.matches[0]!;
    const next = withOptimisticResult(view, target.id, 0, 2);
    const updated = next.stages[0]!.matches[0]!;
    expect(updated).toMatchObject({
      status: "FINISHED",
      homeScore: 0,
      awayScore: 2,
      winnerTeamId: target.awayTeamId,
    });
    expect(next.stages[0]!.matches.slice(1)).toEqual(view.stages[0]!.matches.slice(1));
    expect(
      withOptimisticResult(view, target.id, 1, 1).stages[0]!.matches[0]!.winnerTeamId,
    ).toBeNull();
    expect(allowsDraws(view.stages[0]!)).toBe(true);
    expect(allowsDraws(viewFor({ format: "SINGLE_ELIM" }, 2).stages[0]!)).toBe(false);
  });
});
