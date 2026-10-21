import { generateDoubleElimination } from "@/engine/double-elimination";
import { generateGroupKnockout } from "@/engine/group-knockout";
import { propagate } from "@/engine/propagation";
import { orderBySeed } from "@/engine/seeding";
import { roundRobinMatches } from "@/engine/round-robin";
import { generateSingleElimination } from "@/engine/single-elimination";
import { pairSwissRound } from "@/engine/swiss";
import type { Stage, Team, TeamId } from "@/engine/types";
import { standingsConfigOf, type TournamentConfig } from "./tournament-config";

export interface StagePlan {
  stages: Stage[];
  /** Group label per team, for groups + knockout. Empty for other formats. */
  groupOf: Record<TeamId, string>;
}

/**
 * Generate every stage and match for a tournament from its config and seeded teams, with byes
 * already propagated. Pure: used by the server to start a tournament and by the admin UI to
 * preview fixtures. Ids are prefixed with `idPrefix` so they are unique across tournaments.
 *
 * @example
 * planStages({ format: "SINGLE_ELIM", ... }, teams, "t1-").stages[0].type; // "SINGLE_ELIM"
 */
export function planStages(
  config: TournamentConfig,
  teams: readonly Team[],
  idPrefix: string,
): StagePlan {
  const bySeed = orderBySeed(teams);
  const plan = rawPlan(config, bySeed, idPrefix);
  const all = propagate(plan.stages.flatMap((s) => s.matches)).matches;
  const byId = new Map(all.map((m) => [m.id, m]));
  return {
    groupOf: plan.groupOf,
    stages: plan.stages.map((s) => ({ ...s, matches: s.matches.map((m) => byId.get(m.id) ?? m) })),
  };
}

function rawPlan(config: TournamentConfig, teams: Team[], prefix: string): StagePlan {
  switch (config.format) {
    case "ROUND_ROBIN": {
      const stageId = `${prefix}rr`;
      const matches = roundRobinMatches(
        teams.map((t) => t.id),
        { legs: config.legs },
        stageId,
        (r, p) => `${prefix}rr-r${r}m${p}`,
      );
      return {
        stages: [{ id: stageId, order: 1, type: "ROUND_ROBIN", groupLabel: null, matches }],
        groupOf: {},
      };
    }
    case "SINGLE_ELIM": {
      const stageId = `${prefix}ko`;
      const matches = generateSingleElimination(teams, {
        idPrefix: prefix,
        stageId,
        thirdPlaceMatch: config.thirdPlaceMatch,
      });
      return {
        stages: [{ id: stageId, order: 1, type: "SINGLE_ELIM", groupLabel: null, matches }],
        groupOf: {},
      };
    }
    case "DOUBLE_ELIM": {
      const stageId = `${prefix}de`;
      const matches = generateDoubleElimination(teams, {
        idPrefix: prefix,
        stageId,
        grandFinalReset: config.grandFinalReset,
      });
      return {
        stages: [{ id: stageId, order: 1, type: "DOUBLE_ELIM", groupLabel: null, matches }],
        groupOf: {},
      };
    }
    case "SWISS": {
      const stageId = `${prefix}sw`;
      const { matches } = pairSwissRound(teams, [], standingsConfigOf(config), {
        round: 1,
        stageId,
        idPrefix: prefix,
      });
      return {
        stages: [{ id: stageId, order: 1, type: "SWISS", groupLabel: null, matches }],
        groupOf: {},
      };
    }
    case "GROUP_KNOCKOUT":
      return generateGroupKnockout(teams, {
        groups: config.groups ?? 1,
        advancePerGroup: config.advancePerGroup ?? 1,
        legs: config.legs,
        thirdPlaceMatch: config.thirdPlaceMatch,
        idPrefix: prefix,
      });
  }
}
