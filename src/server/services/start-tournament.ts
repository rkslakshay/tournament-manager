import { MIN_TEAMS } from "@/lib/tournament-config";
import { planStages, type StagePlan } from "@/lib/plan-stages";
import type { Db } from "../db";
import { ServiceError } from "../errors";
import { assertTransition } from "../lifecycle";
import {
  loadAggregate,
  toMatchCreateData,
  type TournamentAggregate,
} from "../repositories/tournament-repository";

/**
 * Generate fixtures and lock the teams: runs the generator for the configured format,
 * persists stages and matches, stores group labels and moves the tournament to IN_PROGRESS,
 * all in one transaction.
 */
export async function startTournament(db: Db, tournamentId: string): Promise<TournamentAggregate> {
  return db.$transaction(async (tx) => {
    const { tournament, teams } = await loadAggregate(tx, tournamentId);
    assertTransition(tournament.status, "IN_PROGRESS");
    if (teams.length < MIN_TEAMS) {
      throw new ServiceError("VALIDATION", `At least ${MIN_TEAMS} teams are needed to start`);
    }

    const plan = generatePlan(() => planStages(tournament.config, teams, `${tournament.id}-`));
    for (const stage of plan.stages) {
      await tx.stage.create({
        data: {
          id: stage.id,
          tournamentId,
          order: stage.order,
          type: stage.type,
          config: { groupLabel: stage.groupLabel },
        },
      });
      await tx.match.createMany({ data: stage.matches.map(toMatchCreateData) });
    }
    for (const [teamId, groupLabel] of Object.entries(plan.groupOf)) {
      await tx.team.update({ where: { id: teamId }, data: { groupLabel } });
    }
    await tx.tournament.update({ where: { id: tournamentId }, data: { status: "IN_PROGRESS" } });
    return loadAggregate(tx, tournamentId);
  });
}

/** Engine generators throw plain errors for impossible configurations; surface them as 400s. */
function generatePlan(generate: () => StagePlan): StagePlan {
  try {
    return generate();
  } catch (error) {
    throw new ServiceError(
      "VALIDATION",
      error instanceof Error ? error.message : "Could not generate fixtures",
    );
  }
}
